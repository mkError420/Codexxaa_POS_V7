<?php
/**
 * Master Supplier Product Controller
 * Handles Super Admin catalog of products uploaded supplier-wise
 * and serves suggestions for Shop Admins during Purchase Order creation.
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class MasterSupplierProductController {

    private static function ensureTableExists() {
        try {
            $pdo = DB::getConnection();
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `master_supplier_products` (
                    `id` INT AUTO_INCREMENT PRIMARY KEY,
                    `supplier_name` VARCHAR(255) NOT NULL,
                    `product_name` VARCHAR(255) NOT NULL,
                    `category` VARCHAR(255) NULL,
                    `unit` VARCHAR(100) NULL,
                    `unit_size` VARCHAR(100) NULL,
                    `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX `idx_supplier_name` (`supplier_name`),
                    INDEX `idx_product_name` (`product_name`),
                    INDEX `idx_category` (`category`),
                    UNIQUE KEY `unique_supplier_product` (`supplier_name`(191), `product_name`(191))
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // Ensure category, unit, unit_size, price columns exist for existing installations
            $columnsToCheck = [
                'category' => "VARCHAR(255) NULL AFTER `product_name`",
                'unit' => "VARCHAR(100) NULL AFTER `category`",
                'unit_size' => "VARCHAR(100) NULL AFTER `unit`",
                'price' => "DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER `unit_size`"
            ];
            foreach ($columnsToCheck as $col => $colDef) {
                $stmt = $pdo->query("SHOW COLUMNS FROM `master_supplier_products` LIKE '$col'");
                if ($stmt->rowCount() === 0) {
                    $pdo->exec("ALTER TABLE `master_supplier_products` ADD COLUMN `$col` $colDef");
                }
            }
            // NOTE: Auto-seeding removed intentionally — seeding prevented deletions from persisting.
            // Products can be added manually or via CSV Bulk Upload.
        } catch (\Exception $e) {
            error_log("Failed to ensure master_supplier_products table: " . $e->getMessage());
        }
    }

    /**
     * List master supplier products
     * Query parameters:
     * - search: string
     * - supplier_name: string
     * - category: string
     * - page: int (optional)
     * - limit: int (optional)
     */
    public static function list() {
        Auth::authenticate();
        self::ensureTableExists();

        try {
            $pdo = DB::getConnection();

            $search = isset($_GET['search']) ? trim($_GET['search']) : '';
            $supplierName = isset($_GET['supplier_name']) ? trim($_GET['supplier_name']) : '';
            $category = isset($_GET['category']) ? trim($_GET['category']) : '';
            $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : null;
            $limit = isset($_GET['limit']) ? max(1, (int)$_GET['limit']) : null;

            $whereClauses = [];
            $params = [];

            if (!empty($search)) {
                $whereClauses[] = '(supplier_name LIKE ? OR product_name LIKE ? OR category LIKE ? OR unit LIKE ? OR unit_size LIKE ?)';
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
                $params[] = "%$search%";
            }

            if (!empty($supplierName)) {
                $whereClauses[] = 'LOWER(supplier_name) = LOWER(?)';
                $params[] = $supplierName;
            }

            if (!empty($category)) {
                $whereClauses[] = 'LOWER(category) = LOWER(?)';
                $params[] = $category;
            }

            $whereSql = !empty($whereClauses) ? ' WHERE ' . implode(' AND ', $whereClauses) : '';

            // If only IDs are requested (for select all across all pages)
            if (isset($_GET['ids_only']) && ($_GET['ids_only'] === '1' || $_GET['ids_only'] === 'true')) {
                $sql = "SELECT id FROM master_supplier_products $whereSql ORDER BY supplier_name ASC, product_name ASC";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $ids = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

                header('Content-Type: application/json');
                echo json_encode([
                    'ids' => $ids,
                    'total' => count($ids)
                ], JSON_UNESCAPED_UNICODE);
                return;
            }

            // If pagination requested
            if ($page !== null && $limit !== null) {
                // Count total
                $countStmt = $pdo->prepare("SELECT COUNT(*) FROM master_supplier_products $whereSql");
                $countStmt->execute($params);
                $total = (int)$countStmt->fetchColumn();

                $offset = ($page - 1) * $limit;
                $sql = "SELECT id, supplier_name, product_name, category, unit, unit_size, price, created_at, updated_at 
                        FROM master_supplier_products $whereSql 
                        ORDER BY supplier_name ASC, product_name ASC 
                        LIMIT $limit OFFSET $offset";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

                header('Content-Type: application/json');
                echo json_encode([
                    'data' => $items,
                    'total' => $total,
                    'page' => $page,
                    'limit' => $limit,
                    'totalPages' => ceil($total / $limit)
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            } else {
                // Return all matching
                $sql = "SELECT id, supplier_name, product_name, category, unit, unit_size, price, created_at, updated_at 
                        FROM master_supplier_products $whereSql 
                        ORDER BY supplier_name ASC, product_name ASC";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

                header('Content-Type: application/json');
                echo json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }

        } catch (\Exception $e) {
            error_log('List master supplier products error: ' . $e->getMessage());
            Auth::jsonError('Failed to fetch supplier products: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get distinct supplier names in the master catalog
     */
    public static function getDistinctSuppliers() {
        Auth::authenticate();
        self::ensureTableExists();

        try {
            $pdo = DB::getConnection();
            $stmt = $pdo->query("SELECT DISTINCT supplier_name FROM master_supplier_products WHERE supplier_name IS NOT NULL AND supplier_name != '' ORDER BY supplier_name ASC");
            $suppliers = $stmt->fetchAll(PDO::FETCH_COLUMN);

            header('Content-Type: application/json');
            echo json_encode($suppliers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\Exception $e) {
            error_log('Get distinct master suppliers error: ' . $e->getMessage());
            Auth::jsonError('Failed to fetch suppliers: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get distinct categories in the master catalog
     */
    public static function getDistinctCategories() {
        Auth::authenticate();
        self::ensureTableExists();

        try {
            $pdo = DB::getConnection();
            $stmt = $pdo->query("SELECT DISTINCT category FROM master_supplier_products WHERE category IS NOT NULL AND category != '' ORDER BY category ASC");
            $categories = $stmt->fetchAll(PDO::FETCH_COLUMN);

            header('Content-Type: application/json');
            echo json_encode($categories, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\Exception $e) {
            error_log('Get distinct master categories error: ' . $e->getMessage());
            Auth::jsonError('Failed to fetch categories: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Create single master supplier product
     */
    public static function create($requestData) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);
        self::ensureTableExists();

        $supplierName = isset($requestData['supplier_name']) ? trim($requestData['supplier_name']) : '';
        $productName = isset($requestData['product_name']) ? trim($requestData['product_name']) : '';
        $category = isset($requestData['category']) && trim($requestData['category']) !== '' ? trim($requestData['category']) : null;
        $unit = isset($requestData['unit']) && trim($requestData['unit']) !== '' ? trim($requestData['unit']) : null;
        $unitSize = isset($requestData['unit_size']) && trim($requestData['unit_size']) !== '' ? trim($requestData['unit_size']) : null;
        $price = isset($requestData['price']) && is_numeric($requestData['price']) ? (float)$requestData['price'] : 0.00;

        if (empty($supplierName)) {
            Auth::jsonError('Supplier name is required.', 400);
        }
        if (empty($productName)) {
            Auth::jsonError('Product name is required.', 400);
        }

        try {
            $pdo = DB::getConnection();

            // Check if already exists (case-insensitive)
            $checkStmt = $pdo->prepare("SELECT id, supplier_name, product_name, category, unit, unit_size, price FROM master_supplier_products WHERE LOWER(supplier_name) = LOWER(?) AND LOWER(product_name) = LOWER(?)");
            $checkStmt->execute([$supplierName, $productName]);
            $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                // Update existing with newly provided fields
                $upStmt = $pdo->prepare("UPDATE master_supplier_products SET 
                    category = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE category END,
                    unit = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE unit END,
                    unit_size = CASE WHEN ? IS NOT NULL AND ? != '' THEN ? ELSE unit_size END,
                    price = CASE WHEN ? > 0 THEN ? ELSE price END
                    WHERE id = ?");
                $upStmt->execute([
                    $category, $category, $category,
                    $unit, $unit, $unit,
                    $unitSize, $unitSize, $unitSize,
                    $price, $price,
                    $existing['id']
                ]);

                http_response_code(200);
                header('Content-Type: application/json');
                echo json_encode([
                    'message' => 'Product already existed for this supplier and was updated.',
                    'id' => (int)$existing['id'],
                    'supplier_name' => $supplierName,
                    'product_name' => $productName,
                    'category' => $category ?: $existing['category'],
                    'unit' => $unit ?: $existing['unit'],
                    'unit_size' => $unitSize ?: $existing['unit_size'],
                    'price' => $price > 0 ? $price : (float)$existing['price']
                ], JSON_UNESCAPED_UNICODE);
                return;
            }

            $insertStmt = $pdo->prepare("INSERT INTO master_supplier_products (supplier_name, product_name, category, unit, unit_size, price) VALUES (?, ?, ?, ?, ?, ?)");
            $insertStmt->execute([$supplierName, $productName, $category, $unit, $unitSize, $price]);
            $id = (int)$pdo->lastInsertId();

            http_response_code(201);
            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Supplier product added successfully.',
                'id' => $id,
                'supplier_name' => $supplierName,
                'product_name' => $productName,
                'category' => $category,
                'unit' => $unit,
                'unit_size' => $unitSize,
                'price' => $price
            ], JSON_UNESCAPED_UNICODE);

        } catch (\Exception $e) {
            error_log('Create master supplier product error: ' . $e->getMessage());
            Auth::jsonError('Failed to add supplier product: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Bulk Upload master supplier products (JSON array)
     * Supports format:
     * product_name, category(optional), supplier_name, unit(Optional), unit_size, price
     */
    public static function bulkUpload($requestData) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);
        self::ensureTableExists();

        $items = $requestData['items'] ?? $requestData;
        if (!is_array($items) || empty($items)) {
            Auth::jsonError('No items provided for bulk upload.', 400);
        }

        try {
            $pdo = DB::getConnection();
            $pdo->beginTransaction();

            $insertedCount = 0;
            $updatedCount = 0;
            $skippedCount = 0;
            $errors = [];

            $insertStmt = $pdo->prepare("
                INSERT INTO master_supplier_products (supplier_name, product_name, category, unit, unit_size, price) 
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    category = CASE WHEN VALUES(category) IS NOT NULL AND VALUES(category) != '' THEN VALUES(category) ELSE category END,
                    unit = CASE WHEN VALUES(unit) IS NOT NULL AND VALUES(unit) != '' THEN VALUES(unit) ELSE unit END,
                    unit_size = CASE WHEN VALUES(unit_size) IS NOT NULL AND VALUES(unit_size) != '' THEN VALUES(unit_size) ELSE unit_size END,
                    price = CASE WHEN VALUES(price) > 0 THEN VALUES(price) ELSE price END
            ");

            foreach ($items as $idx => $item) {
                // Support keys: product_name, category, supplier_name, unit, unit_size, price
                $prod = trim($item['product_name'] ?? $item['name'] ?? $item['product'] ?? '');
                $sup = trim($item['supplier_name'] ?? $item['supplier'] ?? '');
                $cat = isset($item['category']) && trim($item['category']) !== '' ? trim($item['category']) : null;
                $unit = isset($item['unit']) && trim($item['unit']) !== '' ? trim($item['unit']) : null;
                $unitSize = isset($item['unit_size']) && trim($item['unit_size']) !== '' ? trim($item['unit_size']) : ($item['size'] ?? null);
                $price = isset($item['price']) && is_numeric($item['price']) ? (float)$item['price'] : 0.00;

                if (empty($prod) || empty($sup)) {
                    $skippedCount++;
                    $errors[] = "Row " . ($idx + 1) . ": Product name and Supplier name are required.";
                    continue;
                }

                $insertStmt->execute([$sup, $prod, $cat, $unit, $unitSize, $price]);
                $affected = $insertStmt->rowCount();
                if ($affected === 1) {
                    $insertedCount++;
                } else if ($affected === 2) {
                    $updatedCount++;
                } else {
                    $skippedCount++; // Duplicate without change
                }
            }

            $pdo->commit();

            header('Content-Type: application/json');
            echo json_encode([
                'message' => "Bulk upload complete. {$insertedCount} inserted, {$updatedCount} updated, {$skippedCount} skipped/duplicates.",
                'total_processed' => count($items),
                'inserted' => $insertedCount,
                'updated' => $updatedCount,
                'skipped' => $skippedCount,
                'errors' => $errors
            ], JSON_UNESCAPED_UNICODE);

        } catch (\Exception $e) {
            if ($pdo && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('Bulk upload master supplier products error: ' . $e->getMessage());
            Auth::jsonError('Failed to bulk upload supplier products: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Update a master supplier product
     */
    public static function update($id, $requestData) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);
        self::ensureTableExists();

        $supplierName = isset($requestData['supplier_name']) ? trim($requestData['supplier_name']) : '';
        $productName = isset($requestData['product_name']) ? trim($requestData['product_name']) : '';
        $category = isset($requestData['category']) && trim($requestData['category']) !== '' ? trim($requestData['category']) : null;
        $unit = isset($requestData['unit']) && trim($requestData['unit']) !== '' ? trim($requestData['unit']) : null;
        $unitSize = isset($requestData['unit_size']) && trim($requestData['unit_size']) !== '' ? trim($requestData['unit_size']) : null;
        $price = isset($requestData['price']) && is_numeric($requestData['price']) ? (float)$requestData['price'] : 0.00;

        if (empty($supplierName)) {
            Auth::jsonError('Supplier name is required.', 400);
        }
        if (empty($productName)) {
            Auth::jsonError('Product name is required.', 400);
        }

        try {
            $pdo = DB::getConnection();

            // Check if duplicate exists for other ID
            $checkStmt = $pdo->prepare("SELECT id FROM master_supplier_products WHERE LOWER(supplier_name) = LOWER(?) AND LOWER(product_name) = LOWER(?) AND id != ?");
            $checkStmt->execute([$supplierName, $productName, (int)$id]);
            if ($checkStmt->fetch()) {
                Auth::jsonError('Another entry already exists with this supplier and product name.', 409);
            }

            $stmt = $pdo->prepare("UPDATE master_supplier_products SET 
                supplier_name = ?, 
                product_name = ?, 
                category = ?, 
                unit = ?, 
                unit_size = ?, 
                price = ? 
                WHERE id = ?");
            $stmt->execute([$supplierName, $productName, $category, $unit, $unitSize, $price, (int)$id]);

            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Supplier product updated successfully.',
                'id' => (int)$id,
                'supplier_name' => $supplierName,
                'product_name' => $productName,
                'category' => $category,
                'unit' => $unit,
                'unit_size' => $unitSize,
                'price' => $price
            ], JSON_UNESCAPED_UNICODE);

        } catch (\Exception $e) {
            error_log('Update master supplier product error: ' . $e->getMessage());
            Auth::jsonError('Failed to update supplier product: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Delete single master supplier product
     */
    public static function delete($id) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);
        self::ensureTableExists();

        try {
            $pdo = DB::getConnection();
            $stmt = $pdo->prepare("DELETE FROM master_supplier_products WHERE id = ?");
            $stmt->execute([(int)$id]);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Supplier product deleted successfully.']);
        } catch (\Exception $e) {
            error_log('Delete master supplier product error: ' . $e->getMessage());
            Auth::jsonError('Failed to delete supplier product: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Bulk delete master supplier products
     */
    public static function bulkDelete($requestData) {
        Auth::authenticate();
        Auth::authorize(['super_admin']);
        self::ensureTableExists();

        $ids = $requestData['ids'] ?? [];
        if (!is_array($ids) || empty($ids)) {
            Auth::jsonError('No IDs provided for deletion.', 400);
        }

        try {
            $pdo = DB::getConnection();
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stmt = $pdo->prepare("DELETE FROM master_supplier_products WHERE id IN ($placeholders)");
            $stmt->execute(array_map('intval', $ids));

            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Selected supplier products deleted successfully.',
                'deleted_count' => $stmt->rowCount()
            ]);
        } catch (\Exception $e) {
            error_log('Bulk delete master supplier products error: ' . $e->getMessage());
            Auth::jsonError('Failed to bulk delete supplier products: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Export all master supplier products to CSV
     */
    public static function exportCsv() {
        Auth::authenticate();
        self::ensureTableExists();

        try {
            $pdo = DB::getConnection();
            $stmt = $pdo->query("SELECT id, product_name, category, supplier_name, unit, unit_size, price, created_at FROM master_supplier_products ORDER BY supplier_name ASC, product_name ASC");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename=master_supplier_products_' . date('Y-m-d') . '.csv');

            $output = fopen('php://output', 'w');
            // Add UTF-8 BOM for Excel compatibility
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
            fputcsv($output, ['ID', 'Product Name', 'Category', 'Supplier Name', 'Unit', 'Unit Size', 'Price', 'Created At']);

            foreach ($rows as $row) {
                fputcsv($output, [
                    $row['id'],
                    $row['product_name'],
                    $row['category'] ?? '',
                    $row['supplier_name'],
                    $row['unit'] ?? '',
                    $row['unit_size'] ?? '',
                    $row['price'] ?? '0.00',
                    $row['created_at']
                ]);
            }
            fclose($output);
            exit;

        } catch (\Exception $e) {
            error_log('Export CSV master supplier products error: ' . $e->getMessage());
            Auth::jsonError('Failed to export CSV: ' . $e->getMessage(), 500);
        }
    }
}