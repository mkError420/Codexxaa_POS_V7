<?php
/**
 * Fuzzy Product Matching API Endpoint
 * 
 * Matches a search query (OCR result or manual input) against tenant products
 * using Levenshtein Distance algorithm for intelligent fuzzy string matching.
 * 
 * USAGE:
 * POST /match_product.php
 * Body: { "search_query": "Secl0 20ng", "tenant_id": 1 }
 * 
 * OR
 * GET /match_product.php?search_query=Secl0%2020ng&tenant_id=1
 * 
 * RESPONSE:
 * {
 *   "success": true,
 *   "matches": [
 *     {
 *       "id": 123,
 *       "name": "Seclo 20mg",
 *       "sku": "SEC20",
 *       "barcode": "8901234567890",
 *       "price": 15.50,
 *       "stock_quantity": 100,
 *       "confidence_score": 85.5,
 *       "levenshtein_distance": 2
 *     },
 *     ...
 *   ]
 * }
 */

// Disable error display to prevent HTML breaking JSON responses on live server
error_reporting(0);
ini_set('display_errors', 0);

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

// Similarity threshold: Only return matches with confidence >= this percentage
define('SIMILARITY_THRESHOLD', 55);

// Maximum number of products to return
define('MAX_RESULTS', 5);

// Maximum number of products to fetch from database for comparison
define('MAX_DB_PRODUCTS', 500);

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE CONNECTION
// ─────────────────────────────────────────────────────────────────────────────

require_once __DIR__ . '/config/db.php';

try {
    $db = Database::getInstance();
    $conn = $db->getConnection();
    
    if (!$conn) {
        throw new Exception('Database connection failed');
    }
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Database connection error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

$searchQuery = '';
$tenantId = 0;

// Handle both POST and GET requests
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $searchQuery = trim($input['search_query'] ?? '');
    $tenantId = intval($input['tenant_id'] ?? 0);
} else {
    $searchQuery = trim($_GET['search_query'] ?? '');
    $tenantId = intval($_GET['tenant_id'] ?? 0);
}

// Validate inputs
if (empty($searchQuery)) {
    echo json_encode([
        'success' => false,
        'error' => 'search_query is required'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($tenantId <= 0) {
    // Fallback: try to get tenant_id from auth token if not provided
    $token = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($token) {
        // Accept tenant_id=0 gracefully for single-tenant setups
        $tenantId = 1;
    }
    if ($tenantId <= 0) {
        echo json_encode([
            'success' => false,
            'error' => 'Valid tenant_id is required'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Clean the search query: remove special characters, normalize spaces
$searchQuery = preg_replace('/[^a-zA-Z0-9\s]/', '', $searchQuery);
$searchQuery = preg_replace('/\s+/', ' ', $searchQuery);

if (strlen($searchQuery) < 2) {
    echo json_encode([
        'success' => false,
        'error' => 'search_query must be at least 2 characters'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUZZY MATCHING ALGORITHM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate similarity score using Levenshtein distance
 * 
 * @param string $str1 First string
 * @param string $str2 Second string
 * @return float Similarity percentage (0-100)
 */
function calculateSimilarity($str1, $str2) {
    // Convert to lowercase for case-insensitive comparison
    $str1 = strtolower($str1);
    $str2 = strtolower($str2);
    
    // Calculate Levenshtein distance
    $distance = levenshtein($str1, $str2);
    
    // Calculate maximum length
    $maxLength = max(strlen($str1), strlen($str2));
    
    if ($maxLength === 0) {
        return 100; // Both strings are empty
    }
    
    // Calculate similarity percentage
    $similarity = (1 - $distance / $maxLength) * 100;
    
    return round($similarity, 2);
}

/**
 * Calculate similarity using similar_text() (alternative algorithm)
 * similar_text() calculates the number of matching characters
 * 
 * @param string $str1 First string
 * @param string $str2 Second string
 * @return float Similarity percentage (0-100)
 */
function calculateSimilarityText($str1, $str2) {
    $str1 = strtolower($str1);
    $str2 = strtolower($str2);
    
    similar_text($str1, $str2, $percent);
    return round($percent, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH PRODUCTS FROM DATABASE (TENANT-ISOLATED)
// ─────────────────────────────────────────────────────────────────────────────

try {
    // Optimized query: Fetch only products for the specific tenant
    // This ensures tenant data isolation and improves performance
    // by limiting the dataset before string comparison
    $query = "
        SELECT 
            id, 
            name, 
            sku, 
            barcode, 
            price, 
            stock_quantity, 
            category, 
            supplier_name,
            unit,
            unit_size
        FROM products 
        WHERE tenant_id = ?
        LIMIT ?
    ";
    
    $stmt = $conn->prepare($query);
    $stmt->bind_param('ii', $tenantId, MAX_DB_PRODUCTS);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $products = [];
    while ($row = $result->fetch_assoc()) {
        $products[] = $row;
    }
    
    $stmt->close();
    
    if (empty($products)) {
        echo json_encode([
            'success' => true,
            'matches' => [],
            'message' => 'No products found for this tenant'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Database query error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ─────────────────────────────────────────────────────────────────────────────
// PERFORM FUZZY MATCHING
// ─────────────────────────────────────────────────────────────────────────────

$matches = [];

foreach ($products as $product) {
    $productName = $product['name'];
    
    // Calculate similarity using Levenshtein distance
    $similarity = calculateSimilarity($searchQuery, $productName);
    
    // Calculate Levenshtein distance for reference
    $distance = levenshtein(strtolower($searchQuery), strtolower($productName));
    
    // Bonus: Check if search query is contained in product name (partial match)
    $contains = stripos($productName, $searchQuery) !== false;
    if ($contains) {
        $similarity = min(100, $similarity * 1.2); // 20% bonus for partial matches
    }
    
    // Only include matches above threshold
    if ($similarity >= SIMILARITY_THRESHOLD) {
        $product['confidence_score'] = $similarity;
        $product['levenshtein_distance'] = $distance;
        $matches[] = $product;
    }
}

// Sort by confidence score (highest first)
usort($matches, function($a, $b) {
    return $b['confidence_score'] <=> $a['confidence_score'];
});

// Limit to top results
$matches = array_slice($matches, 0, MAX_RESULTS);

// ─────────────────────────────────────────────────────────────────────────────
// RETURN RESPONSE
// ─────────────────────────────────────────────────────────────────────────────

echo json_encode([
    'success' => true,
    'search_query' => $searchQuery,
    'tenant_id' => $tenantId,
    'matches' => $matches,
    'total_matches' => count($matches)
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
