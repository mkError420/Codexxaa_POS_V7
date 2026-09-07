<?php
/**
 * Google Cloud Vision OCR with MySQL Fuzzy Matching
 * 
 * Receives cropped base64 image from React, processes with Google Cloud Vision API,
 * extracts text, cleans noise, and performs MySQL LIKE + levenshtein() fuzzy matching
 * to auto-select product from inventory.
 * 
 * REQUIREMENTS:
 * - Run: composer require google/cloud-vision vlucas/phpdotenv
 * - Set GOOGLE_CLOUD_CREDENTIALS_PATH in .env file
 * - Enable Cloud Vision API in Google Cloud Console
 */

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/config/db.php';

use Google\Cloud\Vision\V1\ImageAnnotatorClient;

class GoogleVisionOcrMatcher {
    
    private $db;
    private $tenantId;
    
    public function __construct($tenantId) {
        $this->db = Database::getInstance();
        $this->tenantId = $tenantId;
    }
    
    /**
     * Decode Base64 image data to binary
     */
    private function decodeBase64Image($imageData) {
        if (!is_string($imageData) || $imageData === '') {
            return false;
        }
        
        // Strip optional data-URI header
        if (preg_match('/^data:image\/[a-zA-Z0-9.+\-]+;base64,(.*)$/s', $imageData, $matches)) {
            $imageData = $matches[1];
        }
        
        $binary = base64_decode($imageData, true);
        if ($binary === false || strlen($binary) > 10 * 1024 * 1024) {
            return false;
        }
        
        return $binary;
    }
    
    /**
     * Extract text using Google Cloud Vision TEXT_DETECTION
     */
    private function extractTextWithGoogleVision($imageBinary) {
        // Set Google Cloud credentials from environment variable
        $credentialsPath = getenv('GOOGLE_CLOUD_CREDENTIALS_PATH');
        if (!$credentialsPath) {
            throw new Exception('GOOGLE_CLOUD_CREDENTIALS_PATH environment variable not set');
        }
        
        putenv('GOOGLE_APPLICATION_CREDENTIALS=' . $credentialsPath);
        
        try {
            $imageAnnotator = new ImageAnnotatorClient();
            
            // Create image object from binary data
            $image = $imageAnnotator->createImageObject($imageBinary);
            
            // Perform TEXT_DETECTION
            $response = $imageAnnotator->textDetection($image);
            $texts = $response->getTextAnnotations();
            
            $imageAnnotator->close();
            
            if (empty($texts)) {
                return '';
            }
            
            // Extract all detected text (first annotation is the full text)
            $fullText = $texts[0]->getDescription();
            
            return $fullText;
            
        } catch (Exception $e) {
            error_log('Google Cloud Vision Error: ' . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Clean OCR text by removing noise and filtering words
     */
    private function cleanOcrText($rawText) {
        if (!is_string($rawText) || trim($rawText) === '') {
            return '';
        }
        
        // 1. Keep only alphanumeric characters and spaces
        $cleanText = preg_replace('/[^a-zA-Z0-9\s]/', '', $rawText);
        
        // 2. Split into words
        $words = explode(' ', $cleanText);
        
        // 3. Filter out words with less than 3 characters
        $validWords = array_filter($words, function($word) {
            return strlen(trim($word)) >= 3;
        });
        
        // 4. Rejoin valid words
        return implode(' ', $validWords);
    }
    
    /**
     * Perform MySQL LIKE search with levenshtein() fuzzy matching
     */
    private function findProductWithFuzzyMatch($searchText) {
        if (empty($searchText)) {
            return null;
        }
        
        $conn = $this->db->getConnection();
        
        // Step 1: Parameterized LIKE search for exact/partial matches
        $likeQuery = "SELECT id, name, sku, barcode, price, stock_quantity, category, supplier_name, unit, unit_size 
                      FROM products 
                      WHERE tenant_id = ? 
                      AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)
                      LIMIT 10";
        
        $searchPattern = '%' . addslashes($searchText) . '%';
        $stmt = $conn->prepare($likeQuery);
        $stmt->bind_param('isss', $this->tenantId, $searchPattern, $searchPattern, $searchPattern);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $candidates = [];
        while ($row = $result->fetch_assoc()) {
            $candidates[] = $row;
        }
        $stmt->close();
        
        // If exact/partial match found, return best candidate
        if (!empty($candidates)) {
            return $candidates[0];
        }
        
        // Step 2: Fuzzy matching with levenshtein() for all products
        $fuzzyQuery = "SELECT id, name, sku, barcode, price, stock_quantity, category, supplier_name, unit, unit_size 
                      FROM products 
                      WHERE tenant_id = ?
                      LIMIT 200";
        
        $stmt = $conn->prepare($fuzzyQuery);
        $stmt->bind_param('i', $this->tenantId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $allProducts = [];
        while ($row = $result->fetch_assoc()) {
            $allProducts[] = $row;
        }
        $stmt->close();
        
        // Calculate levenshtein distance for each product
        $bestMatch = null;
        $bestScore = 0;
        $bestDistance = PHP_INT_MAX;
        
        foreach ($allProducts as $product) {
            $productName = strtolower($product['name']);
            $searchLower = strtolower($searchText);
            
            // Calculate levenshtein distance
            $distance = levenshtein($productName, $searchLower);
            
            // Check if search text is contained in product name (partial match bonus)
            $contains = strpos($productName, $searchLower) !== false;
            
            // Calculate similarity score (0-100)
            $maxLength = max(strlen($productName), strlen($searchLower));
            $similarity = $maxLength > 0 ? (1 - $distance / $maxLength) * 100 : 0;
            
            // Adjust score: partial match gets 1.5x bonus
            $adjustedScore = $contains ? $similarity * 1.5 : $similarity;
            
            if ($adjustedScore > $bestScore) {
                $bestScore = $adjustedScore;
                $bestDistance = $distance;
                $bestMatch = $product;
            }
        }
        
        // Only return match if similarity is reasonable (> 25%)
        if ($bestMatch && $bestScore > 25) {
            $bestMatch['similarity_score'] = round($bestScore, 2);
            $bestMatch['levenshtein_distance'] = $bestDistance;
            return $bestMatch;
        }
        
        return null;
    }
    
    /**
     * Main processing function
     */
    public function processImageAndMatchProduct($base64Image) {
        header('Content-Type: application/json');
        
        try {
            // Decode base64 image
            $imageBinary = $this->decodeBase64Image($base64Image);
            if (!$imageBinary) {
                throw new Exception('Invalid base64 image data');
            }
            
            // Extract text with Google Cloud Vision
            $rawText = $this->extractTextWithGoogleVision($imageBinary);
            
            if (empty($rawText)) {
                echo json_encode([
                    'success' => false,
                    'error' => 'No text detected in image'
                ], JSON_UNESCAPED_UNICODE);
                return;
            }
            
            // Clean OCR text
            $cleanedText = $this->cleanOcrText($rawText);
            
            if (empty($cleanedText)) {
                echo json_encode([
                    'success' => false,
                    'raw_text' => $rawText,
                    'error' => 'No valid text after cleaning'
                ], JSON_UNESCAPED_UNICODE);
                return;
            }
            
            // Find matching product with fuzzy logic
            $matchedProduct = $this->findProductWithFuzzyMatch($cleanedText);
            
            if ($matchedProduct) {
                echo json_encode([
                    'success' => true,
                    'raw_text' => $rawText,
                    'cleaned_text' => $cleanedText,
                    'product' => $matchedProduct
                ], JSON_UNESCAPED_UNICODE);
            } else {
                echo json_encode([
                    'success' => false,
                    'raw_text' => $rawText,
                    'cleaned_text' => $cleanedText,
                    'error' => 'No matching product found in inventory'
                ], JSON_UNESCAPED_UNICODE);
            }
            
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'error' => 'Processing failed: ' . $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }
    }
}

// Example usage (uncomment to test):
/*
// Get base64 image from POST request
$input = json_decode(file_get_contents('php://input'), true);
$base64Image = $input['image'] ?? '';
$tenantId = 1; // Get from authentication

$matcher = new GoogleVisionOcrMatcher($tenantId);
$matcher->processImageAndMatchProduct($base64Image);
*/
