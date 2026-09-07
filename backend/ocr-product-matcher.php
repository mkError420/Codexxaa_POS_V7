<?php
/**
 * OCR Product Matcher Function
 * 
 * Cleans messy OCR text and performs fuzzy matching against MySQL products table
 * using PHP levenshtein() distance algorithm.
 */

require_once __DIR__ . '/config/db.php';

/**
 * Clean OCR text by removing special characters and filtering short words
 * 
 * @param string $rawOcrText Raw OCR output (e.g., "am mn fatisestic Sout Viodin")
 * @return string Cleaned text (e.g., "fatisestic Sout Viodin")
 */
function cleanOcrText($rawOcrText) {
    if (!is_string($rawOcrText) || trim($rawOcrText) === '') {
        return '';
    }
    
    // 1. Keep only alphanumeric characters and spaces
    $cleanText = preg_replace('/[^a-zA-Z0-9\s]/', '', $rawOcrText);
    
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
 * Find the closest matching product using levenshtein() fuzzy matching
 * 
 * @param string $searchText Cleaned OCR text to search for
 * @param int $tenantId Tenant ID for multi-tenant isolation
 * @return array|null Matched product data or null if no match found
 */
function findMatchingProduct($searchText, $tenantId) {
    if (empty($searchText)) {
        return null;
    }
    
    $db = Database::getInstance();
    $conn = $db->getConnection();
    
    // First, try exact LIKE match for faster results
    $likeQuery = "SELECT id, name, sku, barcode, price, stock_quantity, category, supplier_name, unit, unit_size 
                  FROM products 
                  WHERE tenant_id = ? 
                  AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)
                  LIMIT 10";
    
    $searchPattern = '%' . addslashes($searchText) . '%';
    $stmt = $conn->prepare($likeQuery);
    $stmt->bind_param('isss', $tenantId, $searchPattern, $searchPattern, $searchPattern);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $candidates = [];
    while ($row = $result->fetch_assoc()) {
        $candidates[] = $row;
    }
    $stmt->close();
    
    // If we found exact matches, return the best one
    if (!empty($candidates)) {
        return $candidates[0];
    }
    
    // If no exact match, perform fuzzy matching with levenshtein()
    $fuzzyQuery = "SELECT id, name, sku, barcode, price, stock_quantity, category, supplier_name, unit, unit_size 
                  FROM products 
                  WHERE tenant_id = ?
                  LIMIT 100";
    
    $stmt = $conn->prepare($fuzzyQuery);
    $stmt->bind_param('i', $tenantId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $allProducts = [];
    while ($row = $result->fetch_assoc()) {
        $allProducts[] = $row;
    }
    $stmt->close();
    
    // Calculate levenshtein distance for each product name
    $bestMatch = null;
    $bestDistance = PHP_INT_MAX;
    $bestScore = 0;
    
    foreach ($allProducts as $product) {
        $productName = strtolower($product['name']);
        $searchLower = strtolower($searchText);
        
        // Calculate levenshtein distance
        $distance = levenshtein($productName, $searchLower);
        
        // Also check if search text is contained in product name (partial match bonus)
        $contains = strpos($productName, $searchLower) !== false;
        
        // Calculate similarity score (0-100)
        $maxLength = max(strlen($productName), strlen($searchLower));
        $similarity = $maxLength > 0 ? (1 - $distance / $maxLength) * 100 : 0;
        
        // Adjust score: partial match gets bonus
        $adjustedScore = $contains ? $similarity * 1.5 : $similarity;
        
        if ($adjustedScore > $bestScore) {
            $bestScore = $adjustedScore;
            $bestDistance = $distance;
            $bestMatch = $product;
        }
    }
    
    // Only return match if similarity is reasonable (> 30%)
    if ($bestMatch && $bestScore > 30) {
        $bestMatch['similarity_score'] = round($bestScore, 2);
        $bestMatch['levenshtein_distance'] = $bestDistance;
        return $bestMatch;
    }
    
    return null;
}

/**
 * Process OCR text and return matched product as JSON
 * 
 * @param string $rawOcrText Raw OCR output
 * @param int $tenantId Tenant ID
 * @return void Outputs JSON response
 */
function processOcrAndMatchProduct($rawOcrText, $tenantId) {
    header('Content-Type: application/json');
    
    try {
        // Clean the OCR text
        $cleanedText = cleanOcrText($rawOcrText);
        
        if (empty($cleanedText)) {
            echo json_encode([
                'success' => false,
                'error' => 'No valid text found after cleaning'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }
        
        // Find matching product
        $matchedProduct = findMatchingProduct($cleanedText, $tenantId);
        
        if ($matchedProduct) {
            echo json_encode([
                'success' => true,
                'raw_text' => $rawOcrText,
                'cleaned_text' => $cleanedText,
                'product' => $matchedProduct
            ], JSON_UNESCAPED_UNICODE);
        } else {
            echo json_encode([
                'success' => false,
                'raw_text' => $rawOcrText,
                'cleaned_text' => $cleanedText,
                'error' => 'No matching product found'
            ], JSON_UNESCAPED_UNICODE);
        }
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'error' => 'Processing failed: ' . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
    }
}

// Example usage (uncomment to test):
/*
$rawOcrText = "am mn fatisestic Sout Viodin";
$tenantId = 1; // Replace with actual tenant ID
processOcrAndMatchProduct($rawOcrText, $tenantId);
*/
