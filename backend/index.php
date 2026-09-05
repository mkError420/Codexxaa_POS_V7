<?php
// Prevent PHP warnings/notices from outputting HTML and breaking JSON responses
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Set default timezone to Bangladesh Standard Time
date_default_timezone_set('Asia/Dhaka');

/**
 * PHP Front Controller & Router for POS Backend (Fixed for Subfolder Hosting)
 */

// Handle dynamic CORS origin requirements for Allow-Credentials
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
} else {
    header("Access-Control-Allow-Origin: *");
}
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Auth-Token");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Credentials: true");

// Disable caching for all API responses
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Expires: Wed, 11 Jan 1984 05:00:00 GMT");

// Handle OPTIONS requests (CORS preflight) immediately before running router logic
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Load Environment Variables
function loadEnv() {
    $paths = [
        __DIR__ . '/.env',
        dirname(__DIR__) . '/backend/.env',
        __DIR__ . '/.env.example'
    ];
    foreach ($paths as $path) {
        if (file_exists($path)) {
            $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line) || strpos($line, '#') === 0) continue;
                if (strpos($line, '=') !== false) {
                    list($name, $value) = explode('=', $line, 2);
                    $name = trim($name);
                    $value = trim($value);
                    if (preg_match('/^["\'](.*)["\']$/', $value, $matches)) {
                        $value = $matches[1];
                    }
                    putenv("$name=$value");
                    $_ENV[$name] = $value;
                }
            }
            break;
        }
    }
}
loadEnv();

// Include Controllers
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/ProductController.php';
require_once __DIR__ . '/controllers/CustomerController.php';
require_once __DIR__ . '/controllers/SupplierController.php';
require_once __DIR__ . '/controllers/SaleController.php';
require_once __DIR__ . '/controllers/AnalyticsController.php';
require_once __DIR__ . '/controllers/HeldBillController.php';
require_once __DIR__ . '/controllers/ManualOrderController.php';
require_once __DIR__ . '/controllers/OtherController.php';
require_once __DIR__ . '/controllers/OtherSalesController.php';
require_once __DIR__ . '/controllers/TransactionController.php';
require_once __DIR__ . '/controllers/AttendanceController.php';
require_once __DIR__ . '/controllers/SalaryController.php';
require_once __DIR__ . '/controllers/InvestmentController.php';
require_once __DIR__ . '/controllers/WebsiteContentController.php';
require_once __DIR__ . '/controllers/BackupController.php';
require_once __DIR__ . '/controllers/MasterSupplierProductController.php';

// Parse Request URI and Method
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = trim($requestUri, '/');

// FIX: Dynamic directory normalization. Strips 'backend/', 'api/', or 'index.php' matching your subfolder setup.
$prefixesToRemove = ['backend/api', 'backend', 'api'];
foreach ($prefixesToRemove as $prefix) {
    if (strpos($uri, $prefix . '/') === 0) {
        $uri = substr($uri, strlen($prefix) + 1);
        break;
    } else if ($uri === $prefix) {
        $uri = '';
        break;
    }
}

// Remove trailing index.php references if hit directly
if (strpos($uri, 'index.php/') === 0) {
    $uri = substr($uri, 10);
} else if ($uri === 'index.php') {
    $uri = '';
}

$method = $_SERVER['REQUEST_METHOD'];

// Parse Request Body (JSON)
$requestData = [];
if ($method === 'POST' || $method === 'PUT') {
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        $decoded = json_decode($rawInput, true);
        if (is_array($decoded)) {
            $requestData = $decoded;
        }
    }
}

// Global Exception Handler
set_exception_handler(function($e) {
    error_log("Unhandled Exception: " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Something went wrong on the server: ' . $e->getMessage()]);
    exit;
});

// Routing Table
$routes = [
    'GET' => [
        // Root / Welcome
        '/^$/' => function() {
            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Multi-Tenant POS PHP Backend is running',
                'status' => 'healthy',
                'timestamp' => date('c')
            ]);
        },
        // Health
        '/^health$/' => function() {
            header('Content-Type: application/json');
            echo json_encode(['status' => 'healthy', 'timestamp' => date('c')]);
        },
        // Public Logo Endpoint (no authentication required)
        '/^public\/logo$/' => function() {
            require_once __DIR__ . '/config/db.php';
            try {
                // Fetch logo from super admin (role = 'super_admin')
                $stmt = DB::query(
                    'SELECT logo FROM users WHERE role = ? AND status = ? LIMIT 1',
                    ['super_admin', 'active']
                );
                $result = $stmt->fetch();
                
                header('Content-Type: application/json');
                header('Cache-Control: public, max-age=3600'); // Cache for 1 hour
                if ($result && !empty($result['logo'])) {
                    echo json_encode(['logo' => $result['logo']]);
                } else {
                    echo json_encode(['logo' => null]);
                }
            } catch (\Exception $e) {
                error_log('Logo fetch error: ' . $e->getMessage());
                header('Content-Type: application/json');
                echo json_encode(['logo' => null]);
            }
        },
        // Public Hero Slides Endpoint (no authentication required)
        '/^public\/hero-slides$/' => function() {
            $controller = new WebsiteContentController();
            $controller->getAllHeroSlides();
        },
        // Public Team Members Endpoint (no authentication required)
        '/^public\/team-members$/' => function() {
            $controller = new WebsiteContentController();
            $controller->getAllTeamMembers();
        },
        // Public Contact Information Endpoint (no authentication required)
        '/^public\/contact-information$/' => function() {
            $controller = new WebsiteContentController();
            $controller->getContactInformation();
        },
        // Public Pricing Plans Endpoint (no authentication required)
        '/^public\/pricing-plans$/' => function() {
            $controller = new WebsiteContentController();
            $controller->getAllPricingPlans();
        },
        // Public Payment Numbers Endpoint (no authentication required)
        '/^public\/payment-numbers$/' => function() {
            $controller = new WebsiteContentController();
            $controller->getPublicPaymentNumbers();
        },
        // Public Videos Endpoint (no authentication required)
        '/^public\/videos$/' => function() {
            $controller = new WebsiteContentController();
            $controller->getAllVideos();
        },
        // Public More Services Endpoint (no authentication required)
        '/^public\/more-services$/' => function() {
            $controller = new WebsiteContentController();
            $controller->getAllServicesPublic();
        },
        // Diagnostics
        '/^diagnostic$/' => function() {
            header('Content-Type: text/plain');
            try {
                $pdo = DB::getConnection();
                echo "==================================================\n";
                echo "DATABASE DIAGNOSTICS FOR LIVE/LOCAL CONFIGURATION\n";
                echo "==================================================\n\n";

                // 1. Check Shops
                echo "--- Shops in Database ---\n";
                $stmt = $pdo->query("SELECT id, name, status FROM shops");
                $shops = $stmt->fetchAll(PDO::FETCH_ASSOC);
                if (empty($shops)) {
                    echo "No shops found in the database.\n";
                } else {
                    foreach ($shops as $shop) {
                        echo "Shop ID: {$shop['id']} | Name: {$shop['name']} | Status: {$shop['status']}\n";
                    }
                }
                echo "\n";

                // 2. Check Users
                echo "--- Users in Database ---\n";
                $stmt = $pdo->query("SELECT id, shop_id, name, email, role, status FROM users");
                $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
                if (empty($users)) {
                    echo "No users found in the database.\n";
                } else {
                    foreach ($users as $user) {
                        $shop_id = $user['shop_id'] !== null ? $user['shop_id'] : 'NULL (Super Admin)';
                        echo "User ID: {$user['id']} | Email: {$user['email']} | Role: {$user['role']} | Shop ID: $shop_id | Status: {$user['status']}\n";
                    }
                }
                echo "\n";

                // 3. Count products by shop_id
                echo "--- Data Counts grouped by shop_id ---\n";
                $tables = ['products', 'customers', 'sales', 'suppliers', 'purchase_orders', 'other_costs', 'wastages', 'held_bills', 'manual_orders'];
                
                foreach ($tables as $table) {
                    try {
                        $stmt = $pdo->query("SELECT shop_id, COUNT(*) as count FROM `$table` GROUP BY shop_id");
                        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        echo "Table `$table`:\n";
                        if (empty($results)) {
                            echo "  No data found.\n";
                        } else {
                            foreach ($results as $res) {
                                echo "  Shop ID: {$res['shop_id']} -> Count: {$res['count']}\n";
                            }
                        }
                    } catch (\Exception $ex) {
                        echo "Table `$table` failed to query: " . $ex->getMessage() . "\n";
                    }
                }
                echo "\n";

                // 4. Products Table Columns Inspection
                echo "--- Products Table Columns ---\n";
                try {
                    $stmt = $pdo->query("DESCRIBE products");
                    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($columns as $col) {
                        echo "Field: {$col['Field']} | Type: {$col['Type']} | Null: {$col['Null']} | Default: {$col['Default']}\n";
                    }
                } catch (\Exception $e) {
                    echo "Failed to describe products: " . $e->getMessage() . "\n";
                }
                echo "\n";

                // 5. Simulate listProducts Query
                echo "--- Simulating products query for Shop ID 2 ---\n";
                try {
                    $sql = "SELECT p.*, s.name AS supplier_name, sh.name AS shop_name
                            FROM products p
                            LEFT JOIN suppliers s ON p.supplier_id = s.id
                            LEFT JOIN shops sh ON p.shop_id = sh.id
                            WHERE p.shop_id = ?";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute([2]);
                    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    echo "Query succeeded! Returned " . count($results) . " products.\n";
                } catch (\Exception $e) {
                    echo "QUERY FAILED: " . $e->getMessage() . "\n";
                }
                
                echo "\n==================================================\n";

            } catch (\Exception $e) {
                echo "CRITICAL: Database connection failed: " . $e->getMessage() . "\n";
            }
            exit;
        },
        // Auth
        '/^auth\/me$/' => function() { AuthController::getMe(); },
        // Products
        '/^products$/' => function() { ProductController::listProducts(); },
        '/^products\/(\d+)\/stock-sales-history$/' => function($args) { ProductController::getProductStockSalesHistory($args[0]); },
        '/^products\/(\d+)\/batches$/' => function($args) { ProductController::getProductBatches($args[0]); },
        '/^products\/(\d+)\/batches\/(\d+)$/' => function($args) { ProductController::getProductBatch($args[0], $args[1]); },
        '/^products\/(\d+)$/' => function($args) { ProductController::getProduct($args[0]); },
        // Customers
        '/^customers$/' => function() { CustomerController::listCustomers(); },
        '/^customers\/export\/csv$/' => function() { CustomerController::exportCSV(); },
        '/^customers\/(\d+)\/history$/' => function($args) { CustomerController::getCustomerHistory($args[0]); },
        // Suppliers
        '/^suppliers$/' => function() { SupplierController::listSuppliers(); },
        '/^suppliers\/purchase-orders$/' => function() { SupplierController::listPurchaseOrders(); },
        '/^suppliers\/purchase-orders\/filtered-items$/' => function() { SupplierController::getFilteredPOItems(); },
        '/^suppliers\/purchase-orders\/create$/' => function() { SupplierController::createPurchaseOrder(Request::json()); },
        '/^suppliers\/cost-price-logs$/' => function() { SupplierController::listCostPriceLogs(); },
        '/^suppliers\/cost-price-logs\/(\d+)$/' => function($args) { SupplierController::getCostPriceLog($args[0]); },
        '/^suppliers\/cost-price-logs\/export\/csv$/' => function() { SupplierController::exportCostPriceLogsCSV(); },
        // Master Supplier Products (catalog)
        '/^master-supplier-products$/' => function() { MasterSupplierProductController::list(); },
        '/^master-supplier-products\/suppliers$/' => function() { MasterSupplierProductController::getDistinctSuppliers(); },
        '/^master-supplier-products\/export$/' => function() { MasterSupplierProductController::exportCsv(); },
        '/^suppliers\/purchase-orders\/export\/csv$/' => function() { SupplierController::exportPurchaseOrdersCSV(); },
        '/^suppliers\/purchase-orders\/(\d+)$/' => function($args) { SupplierController::getPurchaseOrder($args[0]); },
        '/^suppliers\/(\d+)\/profile$/' => function($args) { SupplierController::getSupplierProfile($args[0]); },
        // Sales
        '/^sales$/' => function() { SaleController::listSales(); },
        '/^sales\/(\d+)$/' => function($args) { SaleController::getSale($args[0]); },
        // Analytics
        '/^analytics\/revenue$/' => function() { AnalyticsController::getRevenueBreakdown(); },
        '/^analytics$/' => function() { AnalyticsController::getDashboardData(); },
        '/^analytics\/daily-products$/' => function() { AnalyticsController::getDailyProductSales(); },
        '/^analytics\/filtered-profit$/' => function() { AnalyticsController::getFilteredProfitBreakdown(); },
        '/^analytics\/sales-due-breakdown$/' => function() { AnalyticsController::getSalesDueBreakdown(); },
        // Held Bills
        '/^held-bills$/' => function() { HeldBillController::listHeldBills(); },
        // Manual Orders
        '/^manual-orders$/' => function() { ManualOrderController::listManualOrders(); },
        '/^manual-orders\/(\d+)$/' => function($args) { ManualOrderController::getManualOrder($args[0]); },
        '/^manual-orders\/sales-history$/' => function() { ManualOrderController::listSalesHistory(); },
        // Other Costs
        '/^other-costs$/' => function() { OtherController::listOtherCosts(); },
        // Other Sales
        '/^other-sales$/' => function() { OtherSalesController::listOtherSales(); },
        // Transactions
        '/^transactions$/' => function() { TransactionController::listTransactions(); },
        '/^transactions\/([A-Z]+-\d+)$/' => function($args) { TransactionController::deleteTransaction($args[0]); },
        // Wastages
        '/^wastages$/' => function() { OtherController::listWastages(); },
        // Returns
        '/^returns$/' => function() { OtherController::listReturns(); },
        // Adjustments
        '/^adjustments$/' => function() { OtherController::listAdjustments(); },
        // Shops
        '/^shops$/' => function() { OtherController::listShops(); },
        '/^shops\/database-backup$/' => function() { BackupController::exportShopDatabase(); },
        '/^shops\/backup-stats$/' => function() { BackupController::getShopBackupStats('all'); },
        '/^shops\/(\d+)\/database-backup$/' => function($args) { BackupController::exportShopDatabase($args[0]); },
        '/^shops\/(\d+)\/backup-stats$/' => function($args) { BackupController::getShopBackupStats($args[0]); },
        '/^shops\/my-shop$/' => function() { OtherController::getMyShop(); },
        '/^shops\/(\d+)\/users$/' => function($args) { OtherController::listShopUsers($args[0]); },
        // Users
        '/^users$/' => function() { OtherController::listUsers(); },
        '/^users\/staff$/' => function() { OtherController::listStaff(); },
        // Attendance
        '/^attendance$/' => function() { AttendanceController::listAttendance(); },
        '/^attendance\/my$/' => function() { AttendanceController::getMyAttendance(); },
        '/^attendance\/today$/' => function() { AttendanceController::getTodayAttendance(); },
        '/^attendance\/archive$/' => function() { AttendanceController::archiveOldAttendance(); },
        '/^attendance\/monthly-report$/' => function() { AttendanceController::getMonthlyStaffReport(); },
        // Salaries
        '/^salaries$/' => function() { SalaryController::listSalaries(); },
        '/^salaries\/calculate$/' => function() { SalaryController::calculateSalary(); },
        // Investments
        '/^investments$/' => function() { InvestmentController::getInvestments(); },
        '/^investments\/summary$/' => function() { InvestmentController::getInvestmentSummary(); },
        // Hero Slides (authenticated)
        '/^hero-slides$/' => function() {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->getAllHeroSlides();
            });
        },
        '/^hero-slides\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->getHeroSlideById($args[0]);
            });
        },
        // Videos (authenticated)
        '/^videos$/' => function() {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->getAllVideos();
            });
        },
        '/^videos\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->getVideoById($args[0]);
            });
        },
        // Team Members (authenticated)
        '/^team-members$/' => function() {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->getAllTeamMembers();
            });
        },
        // Contact Information (authenticated)
        '/^contact-information$/' => function() {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->getContactInformation();
            });
        },
        // Pricing Plans (authenticated)
        '/^pricing-plans$/' => function() {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->getAllPricingPlans();
            });
        },
        '/^pricing-plans\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->getPricingPlanById($args[0]);
            });
        },
        '/^pricing-plans\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->getPricingPlanById($args[0]);
            });
        },
        // Contact Messages (authenticated)
        '/^contact-messages$/' => function() {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->getAllContactMessages();
            });
        },
        '/^contact-messages\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->getContactMessageById($args[0]);
            });
        },
        '/^team-members\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->getTeamMemberById($args[0]);
            });
        },
        // Subscriptions (authenticated)
        '/^subscriptions$/' => function() {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->getAllSubscriptions();
            });
        },
        '/^subscriptions\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->getSubscriptionById($args[0]);
            });
        },
        // More Services (authenticated)
        '/^more-services$/' => function() {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->getAllServices();
            });
        },
        '/^more-services\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->getServiceById($args[0]);
            });
        },
        // Static Uploads Serving Route
        '/^uploads\/(.+)$/' => function($args) {
            $subPath = $args[0];
            $candidates = [
                __DIR__ . '/uploads/' . $subPath,
                dirname(__DIR__) . '/uploads/' . $subPath,
                __DIR__ . '/../uploads/' . $subPath
            ];
            $found = null;
            foreach ($candidates as $candidate) {
                if (file_exists($candidate) && is_file($candidate)) {
                    $found = $candidate;
                    break;
                }
            }
            if (!$found) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Uploaded file not found', 'requested' => $subPath]);
                return;
            }
            $ext = strtolower(pathinfo($found, PATHINFO_EXTENSION));
            $mimeTypes = [
                'jpg'  => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'png'  => 'image/png',
                'gif'  => 'image/gif',
                'webp' => 'image/webp',
                'svg'  => 'image/svg+xml',
                'pdf'  => 'application/pdf',
                'txt'  => 'text/plain'
            ];
            $mime = $mimeTypes[$ext] ?? mime_content_type($found) ?? 'application/octet-stream';
            header('Content-Type: ' . $mime);
            header('Content-Length: ' . filesize($found));
            readfile($found);
            exit;
        },
    ],
    'POST' => [
        // Auth
        '/^auth\/login$/' => function($args, $data) { AuthController::login($data); },
        '/^auth\/register-shop$/' => function($args, $data) { AuthController::registerShop($data); },
        // Products
        '/^products$/' => function($args, $data) { ProductController::createProduct($data); },
        '/^products\/bulk-delete$/' => function($args, $data) { ProductController::bulkDeleteProducts($data); },
        '/^products\/bulk-upload$/' => function($args, $data) { ProductController::bulkUploadProducts(); },
        '/^products\/(\d+)\/batches$/' => function($args, $data) { ProductController::createProductBatch($args[0], $data); },
        // Customers
        '/^customers$/' => function($args, $data) { CustomerController::createCustomer($data); },
        '/^customers\/bulk-delete$/' => function($args, $data) { CustomerController::bulkDeleteCustomers($data); },
        '/^customers\/bulk-upload$/' => function($args, $data) { CustomerController::bulkUpload(); },
        // Suppliers
        '/^suppliers$/' => function($args, $data) { SupplierController::createSupplier($data); },
        // Master Supplier Products
        '/^master-supplier-products$/' => function($args, $data) { MasterSupplierProductController::create($data); },
        '/^master-supplier-products\/bulk-upload$/' => function($args, $data) { MasterSupplierProductController::bulkUpload($data); },
        '/^master-supplier-products\/bulk-delete$/' => function($args, $data) { MasterSupplierProductController::bulkDelete($data); },
        '/^suppliers\/bulk-delete$/' => function($args, $data) { SupplierController::bulkDeleteSuppliers($data); },
        '/^suppliers\/purchase-orders$/' => function($args, $data) { SupplierController::createPurchaseOrder($data); },
        '/^suppliers\/purchase-orders\/bulk-delete$/' => function($args, $data) { SupplierController::bulkDeletePurchaseOrders($data); },
        '/^suppliers\/(\d+)\/returns\/bulk$/' => function($args, $data) { SupplierController::bulkCreateSupplierReturns($args[0], $data); },
        '/^suppliers\/(\d+)\/returns$/' => function($args, $data) { SupplierController::createSupplierReturn($args[0], $data); },
        // Sales
        '/^sales$/' => function($args, $data) { SaleController::createSale($data); },
        '/^sales\/import$/' => function($args, $data) { SaleController::importCsv(); },
        '/^sales\/bulk-delete$/' => function($args, $data) { SaleController::bulkDeleteSales($data); },
        // Held Bills
        '/^held-bills$/' => function($args, $data) { HeldBillController::createHeldBill($data); },
        '/^held-bills\/(\d+)\/pay-due$/' => function($args, $data) { HeldBillController::payHeldBillDue($args[0], $data); },
        // Manual Orders
        '/^manual-orders$/' => function($args, $data) { ManualOrderController::createManualOrder($data); },
        '/^manual-orders\/(\d+)\/confirm$/' => function($args, $data) { ManualOrderController::confirmManualOrder($args[0]); },
        '/^manual-orders\/(\d+)\/hold$/' => function($args, $data) { ManualOrderController::holdManualOrder($args[0]); },
        '/^manual-orders\/(\d+)\/unhold$/' => function($args, $data) { ManualOrderController::unholdManualOrder($args[0]); },
        '/^manual-orders\/sales\/(\d+)\/pay-due$/' => function($args, $data) { ManualOrderController::payManualOrderSaleDue($args[0], $data); },
        // Other Costs
        '/^other-costs$/' => function($args, $data) { OtherController::createOtherCost($data); },
        // Other Sales
        '/^other-sales$/' => function($args, $data) { OtherSalesController::createOtherSale($data); },
        // Wastages
        '/^wastages$/' => function($args, $data) { OtherController::createWastage($data); },
        // Returns
        '/^returns$/' => function($args, $data) { OtherController::createReturn($data); },
        // Adjustments
        '/^adjustments$/' => function($args, $data) { OtherController::createAdjustment($data); },
        // Users
        '/^users$/' => function($args, $data) { OtherController::createUser($data); },
        '/^users\/staff$/' => function($args, $data) { OtherController::createStaff($data); },
        // Attendance
        '/^attendance$/' => function($args, $data) { AttendanceController::createAttendance($data); },
        // Salaries
        '/^salaries$/' => function($args, $data) { SalaryController::createSalary($data); },
        // Investments
        '/^investments$/' => function($args, $data) { InvestmentController::createInvestment(); },
        // Hero Slides
        '/^hero-slides$/' => function($args, $data) {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->createHeroSlide();
            });
        },
        '/^hero-slides\/(\d+)$/' => function($args, $data) {
            AuthController::requireAuth(function() use ($args) {
                // Check for _method override
                if (isset($_POST['_method']) && $_POST['_method'] === 'PUT') {
                    $controller = new WebsiteContentController();
                    $controller->updateHeroSlide($args[0]);
                } else {
                    http_response_code(405);
                    header('Content-Type: application/json');
                    echo json_encode(['error' => 'Method not allowed']);
                }
            });
        },
        // Videos
        '/^videos$/' => function($args, $data) {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->createVideo();
            });
        },
        '/^videos\/(\d+)$/' => function($args, $data) {
            AuthController::requireAuth(function() use ($args) {
                // Check for _method override
                if (isset($_POST['_method']) && $_POST['_method'] === 'PUT') {
                    $controller = new WebsiteContentController();
                    $controller->updateVideo($args[0]);
                } else {
                    http_response_code(405);
                    header('Content-Type: application/json');
                    echo json_encode(['error' => 'Method not allowed']);
                }
            });
        },
        // Team Members
        '/^team-members$/' => function($args, $data) {
            AuthController::requireAuth(function() use ($data) {
                $controller = new WebsiteContentController();
                $controller->createTeamMember();
            });
        },
        '/^team-members\/(\d+)$/' => function($args, $data) {
            AuthController::requireAuth(function() use ($args) {
                // Check for _method override
                if (isset($_POST['_method']) && $_POST['_method'] === 'PUT') {
                    $controller = new WebsiteContentController();
                    $controller->updateTeamMember($args[0]);
                } else {
                    http_response_code(405);
                    header('Content-Type: application/json');
                    echo json_encode(['error' => 'Method not allowed']);
                }
            });
        },
        // Pricing Plans
        '/^pricing-plans$/' => function($args, $data) {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->createPricingPlan();
            });
        },
        // Public Contact Message Submission (no authentication required)
        '/^public\/contact-messages$/' => function($args, $data) {
            $controller = new WebsiteContentController();
            $controller->createContactMessage();
        },
        // Public Subscription Submission (no authentication required)
        '/^public\/subscriptions$/' => function($args, $data) {
            $controller = new WebsiteContentController();
            $controller->createPublicSubscription();
        },
        // Subscriptions Management (authenticated)
        '/^subscriptions$/' => function($args, $data) {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->createSubscription();
            });
        },
        // More Services Management (authenticated)
        '/^more-services$/' => function($args, $data) {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->createService();
            });
        },
        '/^more-services\/(\d+)$/' => function($args, $data) {
            AuthController::requireAuth(function() use ($args) {
                if (isset($_POST['_method']) && $_POST['_method'] === 'PUT') {
                    $controller = new WebsiteContentController();
                    $controller->updateService($args[0]);
                } else {
                    http_response_code(405);
                    header('Content-Type: application/json');
                    echo json_encode(['error' => 'Method not allowed']);
                }
            });
        },
    ],
    'PUT' => [
        // Auth
        '/^auth\/me$/' => function($args, $data) { AuthController::updateMe($data); },
        // Products
        '/^products\/(\d+)$/' => function($args, $data) { ProductController::updateProduct($args[0], $data); },
        '/^products\/(\d+)\/batches\/(\d+)$/' => function($args, $data) { ProductController::updateProductBatch($args[0], $args[1], $data); },
        // Customers
        '/^customers\/(\d+)$/' => function($args, $data) { CustomerController::updateCustomer($args[0], $data); },
        // Sales
        '/^sales\/(\d+)$/' => function($args, $data) { SaleController::updateSale($args[0], $data); },
        // Suppliers
        '/^suppliers\/purchase-orders\/(\d+)$/' => function($args, $data) { SupplierController::updatePurchaseOrder($args[0], $data); },
        '/^suppliers\/purchase-orders\/(\d+)\/status$/' => function($args, $data) { SupplierController::updatePurchaseOrderStatus($args[0], $data); },
        '/^suppliers\/purchase-orders\/(\d+)\/pay$/' => function($args, $data) { SupplierController::payPurchaseOrder($args[0], $data); },
        '/^suppliers\/returns\/(\d+)$/' => function($args, $data) { SupplierController::updateSupplierReturn($args[0], $data); },
        '/^suppliers\/(\d+)$/' => function($args, $data) { SupplierController::updateSupplier($args[0], $data); },
        // Adjustments
        '/^adjustments\/(\d+)$/' => function($args, $data) { OtherController::updateAdjustment($args[0], $data); },
        // Held Bills
        '/^held-bills\/(\d+)$/' => function($args, $data) { HeldBillController::updateHeldBill($args[0], $data); },
        // Manual Orders
        '/^manual-orders\/(\d+)$/' => function($args, $data) { ManualOrderController::updateManualOrder($args[0], $data); },
        // Other Costs
        '/^other-costs\/(\d+)$/' => function($args, $data) { OtherController::updateOtherCost($args[0], $data); },
        // Other Sales
        '/^other-sales\/(\d+)$/' => function($args, $data) { OtherSalesController::updateOtherSale($args[0], $data); },
        // Wastages
        '/^wastages\/(\d+)$/' => function($args, $data) { OtherController::updateWastage($args[0], $data); },
        // Shops
        '/^shops\/my-shop$/' => function($args, $data) { OtherController::updateMyShop($data); },
        '/^shops\/my-shop\/standard-hours$/' => function($args, $data) { OtherController::updateMyShopStandardHours($data); },
        '/^shops\/(\d+)\/status$/' => function($args, $data) { OtherController::updateShopStatus($args[0], $data); },
        '/^shops\/(\d+)$/' => function($args, $data) { OtherController::updateShop($args[0], $data); },
        '/^shops\/(\d+)\/users\/(\d+)\/reset-password$/' => function($args, $data) { OtherController::resetShopUserPassword($args[0], $args[1], $data); },
        '/^shops\/(\d+)\/users\/(\d+)\/status$/' => function($args, $data) { OtherController::updateShopUserStatus($args[0], $args[1], $data); },
        // Users
        '/^users\/(\d+)$/' => function($args, $data) { OtherController::updateUser($args[0], $data); },
        '/^users\/staff\/(\d+)$/' => function($args, $data) { OtherController::updateStaff($args[0], $data); },
        // Attendance
        '/^attendance$/' => function($args, $data) { AttendanceController::updateAttendance($data); },
        // Salaries
        '/^salaries\/(\d+)$/' => function($args, $data) { SalaryController::updateSalary($args[0], $data); },
        // Investments
        '/^investments\/(\d+)$/' => function($args, $data) { InvestmentController::updateInvestment($args[0]); },
        // Hero Slides
        '/^hero-slides\/(\d+)$/' => function($args, $data) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->updateHeroSlide($args[0]);
            });
        },
        // Team Members
        '/^team-members\/(\d+)$/' => function($args, $data) {
            AuthController::requireAuth(function() use ($args, $data) {
                $controller = new WebsiteContentController();
                $controller->updateTeamMember($args[0]);
            });
        },
        // Pricing Plans
        '/^pricing-plans\/(\d+)$/' => function($args, $data) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->updatePricingPlan($args[0]);
            });
        },
        // Contact Information
        '/^contact-information$/' => function($args, $data) {
            AuthController::requireAuth(function() {
                $controller = new WebsiteContentController();
                $controller->updateContactInformation();
            });
        },
        // Contact Messages
        '/^contact-messages\/(\d+)$/' => function($args, $data) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->updateContactMessageStatus($args[0]);
            });
        },
        // Subscriptions
        '/^subscriptions\/(\d+)$/' => function($args, $data) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->updateSubscription($args[0]);
            });
        },
        // Master Supplier Products
        '/^master-supplier-products\/(\d+)$/' => function($args, $data) { MasterSupplierProductController::update($args[0], $data); },
        // More Services
        '/^more-services\/(\d+)$/' => function($args, $data) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->updateService($args[0]);
            });
        },
    ],
    'DELETE' => [
        // Products
        '/^products\/(\d+)$/' => function($args) { ProductController::deleteProduct($args[0]); },
        '/^products\/(\d+)\/batches\/(\d+)$/' => function($args) { ProductController::deleteProductBatch($args[0], $args[1]); },
        // Customers
        '/^customers\/(\d+)$/' => function($args) { CustomerController::deleteCustomer($args[0]); },
        // Suppliers
        '/^suppliers\/purchase-orders\/(\d+)$/' => function($args) { SupplierController::deletePurchaseOrder($args[0]); },
        '/^suppliers\/purchase-orders\/(\d+)\/items\/(\d+)$/' => function($args) { SupplierController::deletePurchaseOrderItem($args[0], $args[1]); },
        '/^suppliers\/cost-price-logs\/(\d+)$/' => function($args) { SupplierController::deleteCostPriceLog($args[0]); },
        '/^suppliers\/returns\/(\d+)$/' => function($args) { SupplierController::deleteSupplierReturn($args[0]); },
        '/^suppliers\/(\d+)$/' => function($args) { SupplierController::deleteSupplier($args[0]); },
        // Master Supplier Products
        '/^master-supplier-products\/(\d+)$/' => function($args) { MasterSupplierProductController::delete($args[0]); },
        // Sales
        '/^sales\/(\d+)$/' => function($args) { SaleController::deleteSale($args[0]); },
        // Held Bills
        '/^held-bills\/(\d+)$/' => function($args) { HeldBillController::deleteHeldBill($args[0]); },
        // Manual Orders
        '/^manual-orders\/(\d+)$/' => function($args) { ManualOrderController::deleteManualOrder($args[0]); },
        // Other Costs
        '/^other-costs\/(\d+)$/' => function($args) { OtherController::deleteOtherCost($args[0]); },
        // Other Sales
        '/^other-sales\/(\d+)$/' => function($args) { OtherSalesController::deleteOtherSale($args[0]); },
        // Wastages
        '/^wastages\/(\d+)$/' => function($args) { OtherController::deleteWastage($args[0]); },
        // Returns
        '/^returns\/(\d+)$/' => function($args) { OtherController::deleteReturn($args[0]); },
        // Adjustments
        '/^adjustments\/(\d+)$/' => function($args) { OtherController::deleteAdjustment($args[0]); },
        // Shops
        '/^shops\/(\d+)$/' => function($args) { OtherController::deleteShop($args[0]); },
        // Users
        '/^users\/(\d+)$/' => function($args) { OtherController::deleteUser($args[0]); },
        '/^users\/staff\/(\d+)$/' => function($args) { OtherController::deleteStaff($args[0]); },
        // Attendance
        '/^attendance\/(\d+)$/' => function($args) { AttendanceController::deleteAttendance($args[0]); },
        // Salaries
        '/^salaries\/(\d+)$/' => function($args) { SalaryController::deleteSalary($args[0]); },
        // Investments
        '/^investments\/(\d+)$/' => function($args) { InvestmentController::deleteInvestment($args[0]); },
        // Hero Slides
        '/^hero-slides\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->deleteHeroSlide($args[0]);
            });
        },
        // Videos
        '/^videos\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->deleteVideo($args[0]);
            });
        },
        // Contact Messages
        '/^contact-messages\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->deleteContactMessage($args[0]);
            });
        },
        // Team Members
        '/^team-members\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->deleteTeamMember($args[0]);
            });
        },
        // Pricing Plans
        '/^pricing-plans\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->deletePricingPlan($args[0]);
            });
        },
        // Subscriptions
        '/^subscriptions\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->deleteSubscription($args[0]);
            });
        },
        // More Services
        '/^more-services\/(\d+)$/' => function($args) {
            AuthController::requireAuth(function() use ($args) {
                $controller = new WebsiteContentController();
                $controller->deleteService($args[0]);
            });
        },
    ]
];

// Match Route
if (isset($routes[$method])) {
    foreach ($routes[$method] as $pattern => $handler) {
        if (preg_match($pattern, $uri, $matches)) {
            // Shift off the full match
            array_shift($matches);
            // Execute handler
            $handler($matches, $requestData);
            exit;
        }
    }
}

// 404 Route Not Found
http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => "Route $method /$uri not found on PHP backend."]);