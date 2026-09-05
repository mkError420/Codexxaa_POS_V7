<?php
/**
 * Product Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class ProductController {

    public static function listProducts() {
        Auth::authenticate();
        Auth::enforceTenant();

        @ini_set('memory_limit', '512M');

        $search = $_GET['search'] ?? null;
        $low_stock = $_GET['low_stock'] ?? null;
        $expiring = $_GET['expiring'] ?? null;
        $supplierIdParam = $_GET['supplier_id'] ?? null;
        $categoryParam = $_GET['category'] ?? null;
        $purchasedOnly = ($_GET['purchased_only'] ?? null) === 'true';
        $excludeExpired = ($_GET['exclude_expired'] ?? null) === 'true';
        $batchLevel = ($_GET['batch_level'] ?? null) === 'true';
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : null;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $shopId = Auth::$shopId;
        $userRole = Auth::$role ?? (Auth::$user['role'] ?? null);
        if ($userRole === 'super_admin' && !empty($_GET['shop_id'])) {
            $shopId = (int)$_GET['shop_id'];
        }
        $hasShop = $shopId !== null;

        try {
            if ($batchLevel) {
                // Return SKU-level data with separate expiry dates from batches
                // Each SKU with different expiry dates appears as separate items
                $sql = "SELECT 
                            p.id,
                            p.shop_id,
                            p.name,
                            p.sku,
                            p.price,
                            p.cost_price,
                            p.low_stock_threshold,
                            p.unit,
                            p.supplier_id,
                            p.category,
                            s.name AS supplier_name,
                            sh.name AS shop_name,
                            ib.id as batch_id,
                            ib.batch_number,
                            ib.quantity as stock_quantity,
                            ib.expiry_date,
                            ib.received_date,
                            ib.status as batch_status
                        FROM products p
                        LEFT JOIN inventory_batches ib ON p.id = ib.product_id AND ib.status = 'active'
                        LEFT JOIN suppliers s ON p.supplier_id = s.id
                        LEFT JOIN shops sh ON p.shop_id = sh.id
                        WHERE " . ($hasShop ? "p.shop_id = ?" : "1=1");
                
                $params = $hasShop ? [$shopId] : [];

                if ($purchasedOnly) {
                    if ($hasShop) {
                        $sql .= " AND EXISTS (SELECT 1 FROM purchase_order_items poi WHERE poi.product_id = p.id AND poi.shop_id = ?)";
                        $params[] = $shopId;
                    } else {
                        $sql .= " AND EXISTS (SELECT 1 FROM purchase_order_items poi WHERE poi.product_id = p.id)";
                    }
                }

                if (!empty($search)) {
                    $sql .= " AND (p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ? OR s.name LIKE ?)";
                    $params[] = "%$search%";
                    $params[] = "%$search%";
                    $params[] = "%$search%";
                    $params[] = "%$search%";
                }

                if ($supplierIdParam !== null && $supplierIdParam !== '') {
                    if ($supplierIdParam === 'null' || $supplierIdParam === 'none' || $supplierIdParam === '0') {
                        $sql .= " AND (p.supplier_id IS NULL OR p.supplier_id = 0)";
                    } else {
                        $sql .= " AND p.supplier_id = ?";
                        $params[] = (int)$supplierIdParam;
                    }
                }

                if (!empty($categoryParam)) {
                    $sql .= " AND p.category = ?";
                    $params[] = $categoryParam;
                }

                if ($excludeExpired) {
                    $sql .= " AND (CASE WHEN ib.id IS NOT NULL THEN (ib.expiry_date IS NULL OR ib.expiry_date = '' OR ib.expiry_date >= CURRENT_DATE()) ELSE (p.expiry_date IS NULL OR p.expiry_date = '' OR p.expiry_date >= CURRENT_DATE()) END)";
                }

                $alertConditions = [];

                if ($low_stock === 'true') {
                    // For products without batches, use product stock. For products with batches, use batch stock
                    $alertConditions[] = "((ib.id IS NULL AND p.stock_quantity <= p.low_stock_threshold AND p.stock_quantity > 0) OR (ib.id IS NOT NULL AND ib.quantity <= p.low_stock_threshold AND ib.quantity > 0))";
                }

                if ($expiring === 'true') {
                    // For products without batches, use product expiry. For products with batches, use batch expiry
                    $alertConditions[] = "((ib.id IS NULL AND p.expiry_date IS NOT NULL AND p.expiry_date != '' AND p.expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY) AND p.stock_quantity > 0) OR (ib.id IS NOT NULL AND ib.expiry_date IS NOT NULL AND ib.expiry_date != '' AND ib.expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY) AND ib.quantity > 0))";
                }

                if (!empty($alertConditions)) {
                    $sql .= " AND (" . implode(" OR ", $alertConditions) . ")";
                }

                $latest = $_GET['latest'] ?? null;
                if ($latest !== null) {
                    $sql .= " ORDER BY COALESCE(ib.created_at, p.created_at) DESC, COALESCE(ib.id, p.id) DESC LIMIT " . (int)$latest;
                } else {
                    // Priority: Items expiring earliest come first, items with no expiry date come after
                    $sql .= " ORDER BY CASE WHEN COALESCE(ib.expiry_date, p.expiry_date) IS NOT NULL AND COALESCE(ib.expiry_date, p.expiry_date) != '' THEN 0 ELSE 1 END ASC, COALESCE(ib.expiry_date, p.expiry_date) ASC, p.sku ASC, p.name ASC";
                    if ($limit !== null && $limit > 0) {
                        $sql .= " LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
                    }
                }

                $stmt = DB::query($sql, $params);
                $products = $stmt->fetchAll();

                // Cast numeric fields appropriately and handle null batches
                foreach ($products as &$p) {
                    $p['id'] = (int)$p['id'];
                    $p['batch_id'] = $p['batch_id'] !== null ? (int)$p['batch_id'] : null;
                    $p['shop_id'] = (int)$p['shop_id'];
                    $p['price'] = (float)$p['price'];
                    $p['cost_price'] = (float)$p['cost_price'];
                    
                    // Use batch quantity if available, otherwise use product stock
                    if ($p['batch_id'] !== null) {
                        $p['stock_quantity'] = (int)$p['stock_quantity'];
                        $p['expiry_date'] = $p['expiry_date'];
                        $p['is_batch'] = true;
                    } else {
                        $p['stock_quantity'] = (int)$p['stock_quantity'];
                        // Keep product expiry_date as is
                        $p['is_batch'] = false;
                    }
                    
                    $p['low_stock_threshold'] = (int)$p['low_stock_threshold'];
                    $p['supplier_id'] = $p['supplier_id'] !== null ? (int)$p['supplier_id'] : null;
                }
            } else {
                // Original product-level query
                $sql = "SELECT p.id, p.shop_id, p.name, p.sku, p.price, p.cost_price, p.stock_quantity, p.low_stock_threshold, p.unit, p.expiry_date, p.supplier_id, p.category, s.name AS supplier_name, sh.name AS shop_name
                        FROM products p
                        LEFT JOIN suppliers s ON p.supplier_id = s.id
                        LEFT JOIN shops sh ON p.shop_id = sh.id
                        WHERE " . ($hasShop ? "p.shop_id = ?" : "1=1");
                
                $params = $hasShop ? [$shopId] : [];

                if ($purchasedOnly) {
                    if ($hasShop) {
                        $sql .= " AND EXISTS (SELECT 1 FROM purchase_order_items poi WHERE poi.product_id = p.id AND poi.shop_id = ?)";
                        $params[] = $shopId;
                    } else {
                        $sql .= " AND EXISTS (SELECT 1 FROM purchase_order_items poi WHERE poi.product_id = p.id)";
                    }
                }

                if (!empty($search)) {
                    $sql .= " AND (p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ? OR s.name LIKE ?)";
                    $params[] = "%$search%";
                    $params[] = "%$search%";
                    $params[] = "%$search%";
                    $params[] = "%$search%";
                }

                if ($supplierIdParam !== null && $supplierIdParam !== '') {
                    if ($supplierIdParam === 'null' || $supplierIdParam === 'none' || $supplierIdParam === '0') {
                        $sql .= " AND (p.supplier_id IS NULL OR p.supplier_id = 0)";
                    } else {
                        $sql .= " AND p.supplier_id = ?";
                        $params[] = (int)$supplierIdParam;
                    }
                }

                if (!empty($categoryParam)) {
                    $sql .= " AND p.category = ?";
                    $params[] = $categoryParam;
                }

                if ($excludeExpired) {
                    $sql .= " AND (p.expiry_date IS NULL OR p.expiry_date = '' OR p.expiry_date >= CURRENT_DATE())";
                }

                $alertConditions = [];

                if ($low_stock === 'true') {
                    $alertConditions[] = "(p.stock_quantity <= p.low_stock_threshold AND p.stock_quantity > 0)";
                }

                if ($expiring === 'true') {
                    $alertConditions[] = "(p.expiry_date IS NOT NULL AND p.expiry_date != '' AND p.expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY) AND p.stock_quantity > 0)";
                }

                if (!empty($alertConditions)) {
                    $sql .= " AND (" . implode(" OR ", $alertConditions) . ")";
                }

                $latest = $_GET['latest'] ?? null;
                if ($latest !== null) {
                    $sql .= " ORDER BY p.created_at DESC, p.id DESC LIMIT " . (int)$latest;
                } else {
                    // Priority: Items expiring earliest come first, items with no expiry date come after
                    $sql .= " ORDER BY CASE WHEN p.expiry_date IS NOT NULL AND p.expiry_date != '' THEN 0 ELSE 1 END ASC, p.expiry_date ASC, p.name ASC";
                    if ($limit !== null && $limit > 0) {
                        $sql .= " LIMIT " . (int)$limit . " OFFSET " . (int)$offset;
                    }
                }

                $stmt = DB::query($sql, $params);
                $products = $stmt->fetchAll();

                // Cast numeric fields appropriately
                foreach ($products as &$p) {
                    $p['id'] = (int)$p['id'];
                    $p['shop_id'] = (int)$p['shop_id'];
                    $p['price'] = (float)$p['price'];
                    $p['cost_price'] = (float)$p['cost_price'];
                    $p['stock_quantity'] = (float)$p['stock_quantity'];
                    $p['low_stock_threshold'] = (int)$p['low_stock_threshold'];
                    $p['supplier_id'] = $p['supplier_id'] !== null ? (int)$p['supplier_id'] : null;
                    $p['is_batch'] = false; // Flag to indicate this is product-level data
                }
            }

            header('Content-Type: application/json');
            $jsonOutput = json_encode($products, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($jsonOutput === false) {
                $jsonError = json_last_error_msg();
                error_log('JSON encoding error: ' . $jsonError);
                Auth::jsonError('Server error encoding product data: ' . $jsonError, 500);
            }
            
            echo $jsonOutput;

        } catch (\Exception $e) {
            error_log('Fetch products error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving products: ' . $e->getMessage(), 500);
        }
    }

    public static function getProduct($id) {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;
        $hasShop = $shopId !== null;

        try {
            $sql = "SELECT p.*, s.name AS supplier_name 
                    FROM products p
                    LEFT JOIN suppliers s ON p.supplier_id = s.id
                    WHERE p.id = ?";
            
            $params = [(int)$id];

            if ($hasShop) {
                $sql .= " AND p.shop_id = ?";
                $params[] = $shopId;
            }

            $stmt = DB::query($sql, $params);
            $product = $stmt->fetch();

            if (!$product) {
                Auth::jsonError('Product not found or access denied.', 404);
            }

            $product['id'] = (int)$product['id'];
            $product['shop_id'] = (int)$product['shop_id'];
            $product['price'] = (float)$product['price'];
            $product['cost_price'] = (float)$product['cost_price'];
            $product['stock_quantity'] = (float)$product['stock_quantity'];
            $product['low_stock_threshold'] = (int)$product['low_stock_threshold'];
            $product['supplier_id'] = $product['supplier_id'] !== null ? (int)$product['supplier_id'] : null;

            header('Content-Type: application/json');
            $jsonOutput = json_encode($product, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($jsonOutput === false) {
                $jsonError = json_last_error_msg();
                error_log('JSON encoding error: ' . $jsonError);
                Auth::jsonError('Server error encoding product data: ' . $jsonError, 500);
            }
            
            echo $jsonOutput;

        } catch (\Exception $e) {
            error_log('Fetch product by ID error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving product.', 500);
        }
    }

    public static function getProductBatches($productId) {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;

        try {
            // Verify product belongs to shop
            $stmt = DB::query('SELECT id FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Product not found or access denied.', 404);
            }

            // Fetch all batches for this product (simplified query without joins)
            $stmt = DB::query(
                'SELECT id, shop_id, product_id, purchase_order_item_id, batch_number, quantity, cost_price, expiry_date, received_date, status, created_at, updated_at
                 FROM inventory_batches
                 WHERE product_id = ? AND shop_id = ?
                 ORDER BY 
                    CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
                    expiry_date ASC,
                    received_date DESC',
                [$productId, $shopId]
            );
            $batches = $stmt->fetchAll();

            foreach ($batches as &$batch) {
                $batch['id'] = (int)$batch['id'];
                $batch['product_id'] = (int)$batch['product_id'];
                $batch['quantity'] = (int)$batch['quantity'];
                $batch['cost_price'] = (float)$batch['cost_price'];
                $batch['purchase_order_item_id'] = $batch['purchase_order_item_id'] !== null ? (int)$batch['purchase_order_item_id'] : null;
            }

            header('Content-Type: application/json');
            $jsonOutput = json_encode($batches, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($jsonOutput === false) {
                $jsonError = json_last_error_msg();
                error_log('JSON encoding error: ' . $jsonError);
                Auth::jsonError('Server error encoding batch data: ' . $jsonError, 500);
            }
            
            echo $jsonOutput;

        } catch (\Exception $e) {
            error_log('Fetch product batches error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving product batches: ' . $e->getMessage(), 500);
        }
    }

    public static function getProductBatch($productId, $batchId) {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;

        try {
            $stmt = DB::query(
                'SELECT ib.*, s.name as supplier_name
                 FROM inventory_batches ib
                 LEFT JOIN suppliers s ON ib.supplier_id = s.id
                 WHERE ib.id = ? AND ib.product_id = ? AND ib.shop_id = ?',
                [(int)$batchId, (int)$productId, $shopId]
            );
            $batch = $stmt->fetch();

            if (!$batch) {
                Auth::jsonError('Batch not found.', 404);
            }

            $batch['id'] = (int)$batch['id'];
            $batch['product_id'] = (int)$batch['product_id'];
            $batch['quantity'] = (int)$batch['quantity'];
            $batch['cost_price'] = (float)$batch['cost_price'];

            header('Content-Type: application/json');
            $jsonOutput = json_encode($batch, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($jsonOutput === false) {
                $jsonError = json_last_error_msg();
                error_log('JSON encoding error: ' . $jsonError);
                Auth::jsonError('Server error encoding batch data: ' . $jsonError, 500);
            }
            
            echo $jsonOutput;
        } catch (\Exception $e) {
            error_log('Get product batch error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving batch.', 500);
        }
    }

    public static function createProductBatch($productId, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;
        $quantity = isset($requestData['quantity']) ? (int)$requestData['quantity'] : 0;
        $cost_price = isset($requestData['cost_price']) ? (float)$requestData['cost_price'] : null;
        $expiry_date = !empty($requestData['expiry_date']) ? $requestData['expiry_date'] : null;
        $received_date = !empty($requestData['received_date']) ? $requestData['received_date'] : date('Y-m-d');
        $notes = $requestData['notes'] ?? null;
        $supplier_id = !empty($requestData['supplier_id']) ? (int)$requestData['supplier_id'] : null;

        if ($quantity <= 0) {
            Auth::jsonError('Quantity must be greater than zero.', 400);
        }
        if ($cost_price === null || $cost_price < 0) {
            Auth::jsonError('A valid cost price is required.', 400);
        }

        try {
            DB::beginTransaction();

            // Verify product belongs to shop
            $stmt = DB::query('SELECT id FROM products WHERE id = ? AND shop_id = ? FOR UPDATE', [(int)$productId, $shopId]);
            if (!$stmt->fetch()) {
                DB::rollBack();
                Auth::jsonError('Product not found or access denied.', 404);
            }

            // Generate unique batch number
            $batchNumber = 'BT-' . strtoupper(substr(md5(uniqid((string)$productId, true)), 0, 8)) . '-' . date('ymd');

            // Check for column existence (supplier_id, notes may or may not exist)
            $hasSupplierCol = false;
            $hasNotesCol = false;
            try {
                $col1 = DB::query("SHOW COLUMNS FROM inventory_batches LIKE 'supplier_id'");
                $hasSupplierCol = (bool)$col1->fetch();
            } catch (\Exception $e) {}
            try {
                $col2 = DB::query("SHOW COLUMNS FROM inventory_batches LIKE 'notes'");
                $hasNotesCol = (bool)$col2->fetch();
            } catch (\Exception $e) {}

            if ($hasSupplierCol && $hasNotesCol) {
                DB::query(
                    'INSERT INTO inventory_batches (shop_id, product_id, batch_number, quantity, cost_price, expiry_date, received_date, status, supplier_id, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, \'active\', ?, ?)',
                    [$shopId, (int)$productId, $batchNumber, $quantity, $cost_price, $expiry_date, $received_date, $supplier_id, $notes]
                );
            } elseif ($hasSupplierCol) {
                DB::query(
                    'INSERT INTO inventory_batches (shop_id, product_id, batch_number, quantity, cost_price, expiry_date, received_date, status, supplier_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, \'active\', ?)',
                    [$shopId, (int)$productId, $batchNumber, $quantity, $cost_price, $expiry_date, $received_date, $supplier_id]
                );
            } else {
                DB::query(
                    'INSERT INTO inventory_batches (shop_id, product_id, batch_number, quantity, cost_price, expiry_date, received_date, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, \'active\')',
                    [$shopId, (int)$productId, $batchNumber, $quantity, $cost_price, $expiry_date, $received_date]
                );
            }

            $newBatchId = DB::lastInsertId();

            // Add quantity to product's total stock_quantity
            DB::query(
                'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND shop_id = ?',
                [$quantity, (int)$productId, $shopId]
            );

            DB::commit();

            header('Content-Type: application/json');
            http_response_code(201);
            $jsonOutput = json_encode([
                'message' => 'Batch created successfully. Stock quantity updated.',
                'batch_id' => (int)$newBatchId,
                'batch_number' => $batchNumber
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($jsonOutput === false) {
                $jsonError = json_last_error_msg();
                error_log('JSON encoding error: ' . $jsonError);
                Auth::jsonError('Server error encoding batch data: ' . $jsonError, 500);
            }
            
            echo $jsonOutput;

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Create product batch error: ' . $e->getMessage());
            Auth::jsonError('Server error creating batch: ' . $e->getMessage(), 500);
        }
    }

    public static function updateProductBatch($productId, $batchId, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;

        try {
            DB::beginTransaction();

            // Verify batch belongs to this product and shop
            $stmt = DB::query(
                'SELECT ib.id, ib.quantity FROM inventory_batches ib WHERE ib.id = ? AND ib.product_id = ? AND ib.shop_id = ? FOR UPDATE',
                [(int)$batchId, (int)$productId, $shopId]
            );
            $existingBatch = $stmt->fetch();

            if (!$existingBatch) {
                DB::rollBack();
                Auth::jsonError('Batch not found or access denied.', 404);
            }

            $oldQuantity = (int)$existingBatch['quantity'];
            $newQuantity = isset($requestData['quantity']) ? (int)$requestData['quantity'] : $oldQuantity;
            $qtyDiff = $newQuantity - $oldQuantity;

            $updateFields = [];
            $params = [];

            if (isset($requestData['quantity'])) {
                if ($newQuantity < 0) {
                    DB::rollBack();
                    Auth::jsonError('Quantity cannot be negative.', 400);
                }
                $updateFields[] = '`quantity` = ?';
                $params[] = $newQuantity;
            }
            if (isset($requestData['cost_price'])) {
                $updateFields[] = '`cost_price` = ?';
                $params[] = (float)$requestData['cost_price'];
            }
            if (array_key_exists('expiry_date', $requestData)) {
                $updateFields[] = '`expiry_date` = ?';
                $params[] = !empty($requestData['expiry_date']) ? $requestData['expiry_date'] : null;
            }
            if (isset($requestData['received_date'])) {
                $updateFields[] = '`received_date` = ?';
                $params[] = $requestData['received_date'];
            }
            if (isset($requestData['status'])) {
                $updateFields[] = '`status` = ?';
                $params[] = $requestData['status'];
            }

            if (!empty($updateFields)) {
                $params[] = (int)$batchId;
                $params[] = $shopId;
                DB::query(
                    'UPDATE inventory_batches SET ' . implode(', ', $updateFields) . ' WHERE id = ? AND shop_id = ?',
                    $params
                );
            }

            // Adjust product stock_quantity if quantity changed
            if ($qtyDiff !== 0) {
                DB::query(
                    'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND shop_id = ?',
                    [$qtyDiff, (int)$productId, $shopId]
                );
            }

            DB::commit();

            header('Content-Type: application/json');
            $jsonOutput = json_encode(['message' => 'Batch updated successfully.'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($jsonOutput === false) {
                $jsonError = json_last_error_msg();
                error_log('JSON encoding error: ' . $jsonError);
                Auth::jsonError('Server error encoding response: ' . $jsonError, 500);
            }
            
            echo $jsonOutput;

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Update product batch error: ' . $e->getMessage());
            Auth::jsonError('Server error updating batch.', 500);
        }
    }

    public static function deleteProductBatch($productId, $batchId) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;

        try {
            DB::beginTransaction();

            // Verify batch belongs to this product and shop
            $stmt = DB::query(
                'SELECT id, quantity FROM inventory_batches WHERE id = ? AND product_id = ? AND shop_id = ? FOR UPDATE',
                [(int)$batchId, (int)$productId, $shopId]
            );
            $batch = $stmt->fetch();

            if (!$batch) {
                DB::rollBack();
                Auth::jsonError('Batch not found or access denied.', 404);
            }

            $batchQty = (int)$batch['quantity'];

            // Check if batch was linked to any sale_items
            $saleCheck = false;
            try {
                $stmt2 = DB::query('SELECT COUNT(*) as cnt FROM sale_items WHERE inventory_batch_id = ?', [(int)$batchId]);
                $row = $stmt2->fetch();
                $saleCheck = ((int)$row['cnt']) > 0;
            } catch (\Exception $e2) {
                // column may not exist - OK
            }

            if ($saleCheck) {
                DB::rollBack();
                Auth::jsonError('Cannot delete this batch. It is linked to existing sale records.', 400);
            }

            // Deduct batch quantity from product stock
            DB::query(
                'UPDATE products SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ? AND shop_id = ?',
                [$batchQty, (int)$productId, $shopId]
            );

            // Delete the batch
            DB::query('DELETE FROM inventory_batches WHERE id = ? AND shop_id = ?', [(int)$batchId, $shopId]);

            DB::commit();

            header('Content-Type: application/json');
            $jsonOutput = json_encode(['message' => 'Batch deleted successfully. Stock quantity adjusted.'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($jsonOutput === false) {
                $jsonError = json_last_error_msg();
                error_log('JSON encoding error: ' . $jsonError);
                Auth::jsonError('Server error encoding response: ' . $jsonError, 500);
            }
            
            echo $jsonOutput;

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Delete product batch error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting batch.', 500);
        }
    }

    public static function createProduct($requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;
        $name = $requestData['name'] ?? '';
        $sku = $requestData['sku'] ?? '';
        $price = $requestData['price'] ?? null;
        $cost_price = $requestData['cost_price'] ?? null;
        $stock_quantity = $requestData['stock_quantity'] ?? 0;
        $low_stock_threshold = $requestData['low_stock_threshold'] ?? 10;
        $expiry_date = $requestData['expiry_date'] ?? null;
        $supplier_id = $requestData['supplier_id'] ?? null;
        $supplier_name = trim($requestData['supplier_name'] ?? '');
        $unit = $requestData['unit'] ?? 'piece';
        $category = $requestData['category'] ?? null;

        if (empty($name) || empty($sku) || $price === null || $cost_price === null) {
            Auth::jsonError('Please provide name, sku, price, and cost price.', 400);
        }

        try {
            // Auto resolve or create supplier by supplier_name if supplier_id not provided
            if (empty($supplier_id) && !empty($supplier_name)) {
                $stmtSup = DB::query('SELECT id FROM suppliers WHERE shop_id = ? AND LOWER(name) = LOWER(?)', [$shopId, $supplier_name]);
                $existingSup = $stmtSup->fetch();
                if ($existingSup) {
                    $supplier_id = (int)$existingSup['id'];
                } else {
                    DB::query('INSERT INTO suppliers (shop_id, name) VALUES (?, ?)', [$shopId, $supplier_name]);
                    $supplier_id = (int)DB::lastInsertId();
                }
            }
            // Check SKU duplicate in the shop
            $stmt = DB::query('SELECT id FROM products WHERE shop_id = ? AND sku = ?', [$shopId, $sku]);
            if ($stmt->fetch()) {
                Auth::jsonError('SKU already exists for this shop.', 400);
            }

            DB::query(
                'INSERT INTO products (shop_id, name, sku, price, cost_price, stock_quantity, low_stock_threshold, expiry_date, supplier_id, unit, category) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $shopId,
                    $name,
                    $sku,
                    $price,
                    $cost_price,
                    (float)$stock_quantity,
                    (int)$low_stock_threshold,
                    !empty($expiry_date) ? $expiry_date : null,
                    !empty($supplier_id) ? (int)$supplier_id : null,
                    $unit,
                    !empty($category) ? $category : null
                ]
            );

            $newProductId = DB::lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            $jsonOutput = json_encode([
                'message' => 'Product created successfully.',
                'productId' => (int)$newProductId
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($jsonOutput === false) {
                $jsonError = json_last_error_msg();
                error_log('JSON encoding error: ' . $jsonError);
                Auth::jsonError('Server error encoding product data: ' . $jsonError, 500);
            }
            
            echo $jsonOutput;

        } catch (\Exception $e) {
            error_log('Create product error: ' . $e->getMessage());
            Auth::jsonError('Server error creating product.', 500);
        }
    }

    public static function updateProduct($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $productId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            DB::beginTransaction();

            // Verify product belongs to active tenant
            $stmt = DB::query('SELECT id, cost_price, supplier_id FROM products WHERE id = ? AND shop_id = ? FOR UPDATE', [$productId, $shopId]);
            $existingProduct = $stmt->fetch();
            if (!$existingProduct) {
                DB::rollBack();
                Auth::jsonError('Product not found or access denied.', 404);
            }

            // Verify SKU uniqueness if changing SKU
            $sku = $requestData['sku'] ?? null;
            if ($sku !== null) {
                $stmt = DB::query('SELECT id FROM products WHERE shop_id = ? AND sku = ? AND id != ?', [$shopId, $sku, $productId]);
                if ($stmt->fetch()) {
                    DB::rollBack();
                    Auth::jsonError('Another product with this SKU already exists.', 400);
                }
            }

            // Perform update
            $updateFields = [];
            $params = [];

            $fieldsToUpdate = [
                'name' => 'name',
                'sku' => 'sku',
                'price' => 'price',
                'cost_price' => 'cost_price',
                'stock_quantity' => 'stock_quantity',
                'low_stock_threshold' => 'low_stock_threshold',
                'expiry_date' => 'expiry_date',
                'supplier_id' => 'supplier_id',
                'unit' => 'unit',
                'category' => 'category'
            ];

            foreach ($fieldsToUpdate as $apiKey => $dbKey) {
                if (array_key_exists($apiKey, $requestData)) {
                    $val = $requestData[$apiKey];
                    $updateFields[] = "`$dbKey` = ?";
                    if (($dbKey === 'expiry_date' || $dbKey === 'supplier_id') && empty($val)) {
                        $params[] = null;
                    } else {
                        $params[] = $val;
                    }
                }
            }

            if (empty($updateFields)) {
                DB::rollBack();
                Auth::jsonError('No update parameters provided.', 400);
            }

            $params[] = $productId;
            $params[] = $shopId;

            DB::query(
                "UPDATE products SET " . implode(', ', $updateFields) . " WHERE id = ? AND shop_id = ?",
                $params
            );

            // Log cost price change if it was modified
            if (array_key_exists('cost_price', $requestData)) {
                $newCostPrice = (float)$requestData['cost_price'];
                $oldCostPrice = (float)$existingProduct['cost_price'];

                if ($newCostPrice !== $oldCostPrice) {
                    $supplierId = array_key_exists('supplier_id', $requestData) 
                        ? (!empty($requestData['supplier_id']) ? (int)$requestData['supplier_id'] : null)
                        : $existingProduct['supplier_id'];

                    DB::query(
                        'INSERT INTO cost_price_logs (shop_id, product_id, supplier_id, old_cost_price, new_cost_price, reason)
                         VALUES (?, ?, ?, ?, ?, ?)',
                        [$shopId, $productId, $supplierId, $oldCostPrice, $newCostPrice, 'Manual update from catalog']
                    );

                    // Update cost prices in all past purchase order items dynamically
                    DB::query(
                        'UPDATE purchase_order_items SET cost_price = ? WHERE product_id = ? AND shop_id = ?',
                        [$newCostPrice, $productId, $shopId]
                    );

                    // Recalculate total_amount for all affected purchase orders
                    DB::query(
                        'UPDATE purchase_orders po
                         SET po.total_amount = (
                             SELECT COALESCE(SUM(
                                 IF(po.status = "received", poi.quantity_received, poi.quantity_ordered) * poi.cost_price
                             ), 0)
                             FROM purchase_order_items poi
                             WHERE poi.purchase_order_id = po.id AND poi.shop_id = po.shop_id
                         )
                         WHERE po.shop_id = ? AND po.id IN (
                             SELECT purchase_order_id FROM purchase_order_items WHERE product_id = ? AND shop_id = ?
                         )',
                        [$shopId, $productId, $shopId]
                    );

                    // Update due_amount based on the new total_amount (and adjust paid_amount for cash POs)
                    DB::query(
                        'UPDATE purchase_orders
                         SET paid_amount = IF(payment_basis = "cash", total_amount, paid_amount),
                             due_amount = GREATEST(total_amount - IF(payment_basis = "cash", total_amount, paid_amount), 0)
                         WHERE shop_id = ? AND id IN (
                             SELECT purchase_order_id FROM purchase_order_items WHERE product_id = ? AND shop_id = ?
                         )',
                        [$shopId, $productId, $shopId]
                    );

                    // Recalculate supplier due_balance
                    if ($supplierId) {
                        DB::query(
                            'UPDATE suppliers s
                             SET s.due_balance = (
                                 SELECT COALESCE(SUM(due_amount), 0)
                                 FROM purchase_orders
                                 WHERE supplier_id = s.id AND shop_id = s.shop_id AND payment_basis = "credit" AND status IN ("ordered", "received")
                             )
                             WHERE s.id = ? AND s.shop_id = ?',
                            [$supplierId, $shopId]
                        );

                        // If total_spent column exists, update it
                        $columnCheck = DB::query("SHOW COLUMNS FROM suppliers LIKE 'total_spent'");
                        if ($columnCheck->fetch() !== false) {
                            DB::query(
                                'UPDATE suppliers s
                                 SET s.total_spent = (
                                     SELECT COALESCE(SUM(stock_quantity * cost_price), 0)
                                     FROM products
                                     WHERE supplier_id = s.id AND shop_id = s.shop_id
                                 )
                                 WHERE s.id = ? AND s.shop_id = ?',
                                [$supplierId, $shopId]
                            );
                        }
                    }
                }
            }

            // ALWAYS recalculate total_spent unconditionally on product update (in case stock_quantity changed)
            $supplierId = array_key_exists('supplier_id', $requestData) 
                ? (!empty($requestData['supplier_id']) ? (int)$requestData['supplier_id'] : null)
                : $existingProduct['supplier_id'];
                
            if ($supplierId) {
                $columnCheck = DB::query("SHOW COLUMNS FROM suppliers LIKE 'total_spent'");
                if ($columnCheck->fetch() !== false) {
                    DB::query(
                        'UPDATE suppliers s
                         SET s.total_spent = (
                             SELECT COALESCE(SUM(stock_quantity * cost_price), 0)
                             FROM products
                             WHERE supplier_id = s.id AND shop_id = s.shop_id
                         )
                         WHERE s.id = ? AND s.shop_id = ?',
                        [$supplierId, $shopId]
                    );
                }
            }

            DB::commit();

            header('Content-Type: application/json');
            $jsonOutput = json_encode(['message' => 'Product updated successfully.'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($jsonOutput === false) {
                $jsonError = json_last_error_msg();
                error_log('JSON encoding error: ' . $jsonError);
                Auth::jsonError('Server error encoding response: ' . $jsonError, 500);
            }
            
            echo $jsonOutput;

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Update product error: ' . $e->getMessage());
            Auth::jsonError('Server error updating product.', 500);
        }
    }

    public static function deleteProduct($id) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'super_admin']);

        $productId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            // Verify product belongs to active tenant
            $stmt = DB::query('SELECT id FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Product not found or access denied.', 404);
            }

            // Check if product is referenced in sale_items
            $stmt = DB::query('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ? AND shop_id = ?', [$productId, $shopId]);
            $saleCount = $stmt->fetch()['count'];

            // Check if product is referenced in purchase_order_items
            $stmt = DB::query('SELECT COUNT(*) as count FROM purchase_order_items WHERE product_id = ? AND shop_id = ?', [$productId, $shopId]);
            $poCount = $stmt->fetch()['count'];

            // Provide specific error message based on references
            if ($saleCount > 0 && $poCount > 0) {
                Auth::jsonError('Cannot delete product. It is referenced in both sales transactions and purchase orders.', 400);
            } elseif ($saleCount > 0) {
                Auth::jsonError('Cannot delete product. It is referenced in sales transaction records.', 400);
            } elseif ($poCount > 0) {
                Auth::jsonError('Cannot delete product. It is referenced in purchase order records.', 400);
            }

            // Delete product
            DB::query('DELETE FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);

            header('Content-Type: application/json');
            $jsonOutput = json_encode(['message' => 'Product deleted successfully.'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($jsonOutput === false) {
                $jsonError = json_last_error_msg();
                error_log('JSON encoding error: ' . $jsonError);
                Auth::jsonError('Server error encoding response: ' . $jsonError, 500);
            }
            
            echo $jsonOutput;

        } catch (\PDOException $e) {
            error_log('Delete product database error: ' . $e->getMessage());
            // Foreign key constraint violation (ER_ROW_IS_REFERENCED_2 matches SQLSTATE 23000)
            if ($e->getCode() == 23000 || strpos($e->getMessage(), 'a foreign key constraint fails') !== false) {
                Auth::jsonError('Cannot delete product. It is referenced in other records.', 400);
            }
            Auth::jsonError('Server error deleting product.', 500);
        } catch (\Exception $e) {
            error_log('Delete product error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting product.', 500);
        }
    }

    public static function bulkDeleteProducts($requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'super_admin']);

        $productIds = $requestData['product_ids'] ?? [];
        $shopId = Auth::$shopId;

        if (empty($productIds) || !is_array($productIds)) {
            Auth::jsonError('No products selected for deletion.', 400);
        }

        $successCount = 0;
        $failureCount = 0;

        foreach ($productIds as $productId) {
            $productId = (int)$productId;
            try {
                // Verify product belongs to active tenant
                $stmt = DB::query('SELECT id FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
                if (!$stmt->fetch()) {
                    $failureCount++;
                    continue;
                }

                // Delete product
                DB::query('DELETE FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
                $successCount++;
            } catch (\PDOException $e) {
                // Usually foreign key constraint violation (ER_ROW_IS_REFERENCED_2)
                $failureCount++;
            } catch (\Exception $e) {
                $failureCount++;
            }
        }

        header('Content-Type: application/json');
        $jsonOutput = json_encode([
            'message' => "Bulk delete complete.",
            'success_count' => $successCount,
            'failure_count' => $failureCount
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        
        if ($jsonOutput === false) {
            $jsonError = json_last_error_msg();
            error_log('JSON encoding error: ' . $jsonError);
            Auth::jsonError('Server error encoding response: ' . $jsonError, 500);
        }
        
        echo $jsonOutput;
    }

    public static function bulkUploadProducts() {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;

        $forcedSupplierId = null;
        if (isset($_GET['supplier_id']) && $_GET['supplier_id'] !== '') {
            $forcedSupplierId = intval($_GET['supplier_id']);
            // Verify supplier exists and belongs to this shop
            $stmt = DB::query('SELECT id FROM suppliers WHERE id = ? AND shop_id = ?', [$forcedSupplierId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Supplier not found or access denied.', 404);
            }
        }

        if (!isset($_FILES['csv_file']) || $_FILES['csv_file']['error'] !== UPLOAD_ERR_OK) {
            Auth::jsonError('No file uploaded or upload error.', 400);
        }

        $file = $_FILES['csv_file'];
        $filePath = $file['tmp_name'];
        
        // Validate file type
        $fileExtension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if ($fileExtension !== 'csv') {
            Auth::jsonError('Only CSV files are allowed.', 400);
        }

        try {
            DB::beginTransaction();

            $handle = fopen($filePath, 'r');
            if ($handle === false) {
                throw new \Exception('Failed to open CSV file.');
            }

            // Read header row
            $headers = fgetcsv($handle);
            if ($headers === false) {
                throw new \Exception('Failed to read CSV header.');
            }

            // Normalize headers
            $headers = array_map('strtolower', array_map('trim', $headers));
            
            // Expected columns (case-insensitive) - matching user's CSV format
            $columnMap = [
                'name' => self::findColumn(['product name', 'name', 'product_name', 'item_name', 'item name', 'product', 'title'], $headers),
                'sku' => self::findColumn(['sku', 'barcode', 'item_code', 'code'], $headers),
                'price' => self::findColumn(['sale price', 'sale_price', 'price', 'selling price', 'selling_price', 'mrp'], $headers),
                'cost_price' => self::findColumn(['cost price', 'cost_price', 'buy price', 'purchase price', 'unit_cost', 'cost'], $headers),
                'stock_quantity' => self::findColumn(['stock quantity', 'stock_quantity', 'quantity', 'stock', 'qty'], $headers),
                'low_stock_threshold' => self::findColumn(['low stock threshold', 'low_stock_threshold', 'threshold', 'alert_quantity', 'min_stock'], $headers),
                'expiry_date' => self::findColumn(['expiry date', 'expiry_date', 'expire_date', 'exp_date', 'expiry'], $headers),
                'supplier_id' => self::findColumn(['supplier name', 'supplier_name', 'supplier', 'supplier id', 'supplier_id'], $headers),
                'unit' => self::findColumn(['unit', 'uom'], $headers),
                'category' => self::findColumn(['category', 'group'], $headers)
            ];

            // Debug: log found columns
            error_log('CSV Headers: ' . implode(', ', $headers));
            error_log('Column Map: ' . json_encode($columnMap));

            // Validate required columns (Only product name or SKU is required)
            if ($columnMap['name'] === false && $columnMap['sku'] === false) {
                throw new \Exception('CSV must contain a "name" (or "product_name") column. Found columns: ' . implode(', ', $headers));
            }

            $successCount = 0;
            $errorCount = 0;
            $errors = [];
            $rowNumber = 1;

            // Group products by supplier for PO creation (only if stock > 0)
            $productsBySupplier = [];
            $newProductIds = [];

            while (($row = fgetcsv($handle)) !== false) {
                $rowNumber++;
                
                try {
                    $name = $columnMap['name'] !== false ? trim($row[$columnMap['name']] ?? '') : '';
                    $sku = $columnMap['sku'] !== false ? trim($row[$columnMap['sku']] ?? '') : '';
                    $costPrice = ($columnMap['cost_price'] !== false && trim($row[$columnMap['cost_price']] ?? '') !== '') ? floatval($row[$columnMap['cost_price']]) : 0.00;
                    $price = ($columnMap['price'] !== false && trim($row[$columnMap['price']] ?? '') !== '') ? floatval($row[$columnMap['price']]) : 0.00;
                    if ($price <= 0 && $costPrice > 0) {
                        $price = $costPrice;
                    }
                    $stockQuantity = ($columnMap['stock_quantity'] !== false && trim($row[$columnMap['stock_quantity']] ?? '') !== '') ? floatval($row[$columnMap['stock_quantity']]) : 0.00;
                    $lowStockThreshold = ($columnMap['low_stock_threshold'] !== false && trim($row[$columnMap['low_stock_threshold']] ?? '') !== '') ? intval($row[$columnMap['low_stock_threshold']]) : 10;
                    $expiryDateRaw = $columnMap['expiry_date'] !== false ? trim($row[$columnMap['expiry_date']] ?? '') : '';
                    $expiryDate = null;
                    // Parse expiry date from various formats
                    if (!empty($expiryDateRaw)) {
                        $formats = ['Y-m-d', 'd/m/Y', 'm/d/Y', 'Y/m/d', 'd-m-Y', 'm-d-Y', 'd M Y', 'M d Y'];
                        foreach ($formats as $format) {
                            $date = \DateTime::createFromFormat($format, $expiryDateRaw);
                            if ($date !== false) {
                                $expiryDate = $date->format('Y-m-d');
                                break;
                            }
                        }
                        if (empty($expiryDate)) {
                            $timestamp = strtotime($expiryDateRaw);
                            if ($timestamp !== false) {
                                $expiryDate = date('Y-m-d', $timestamp);
                            }
                        }
                    }
                    $supplierInput = $columnMap['supplier_id'] !== false ? trim($row[$columnMap['supplier_id']] ?? '') : '';
                    $unit = ($columnMap['unit'] !== false && trim($row[$columnMap['unit']] ?? '') !== '') ? trim($row[$columnMap['unit']]) : 'piece';
                    $category = ($columnMap['category'] !== false && trim($row[$columnMap['category']] ?? '') !== '') ? trim($row[$columnMap['category']]) : null;

                    // Auto-fill missing name or sku
                    if (empty($name) && !empty($sku)) {
                        $name = $sku;
                    } else if (!empty($name) && empty($sku)) {
                        $cleanName = preg_replace('/[^A-Za-z0-9]/', '', $name);
                        $prefix = strtoupper(substr($cleanName, 0, 3));
                        if (empty($prefix)) {
                            $prefix = 'PRD';
                        }
                        $sku = 'SKU-' . $prefix . '-' . rand(100, 999);
                        $skuCheck = DB::query('SELECT id FROM products WHERE shop_id = ? AND sku = ?', [$shopId, $sku]);
                        if ($skuCheck->fetch()) {
                            $sku = 'SKU-' . $prefix . '-' . rand(1000, 9999);
                        }
                    }

                    if (empty($name) && empty($sku)) {
                        $errors[] = "Row $rowNumber: Missing required field (Product Name is empty)";
                        $errorCount++;
                        continue;
                    }

                    if ($costPrice < 0) {
                        $errors[] = "Row $rowNumber: Invalid cost price (cannot be negative, got: $costPrice)";
                        $errorCount++;
                        continue;
                    }

                    // Check if product already exists (by SKU first, then by Name if no SKU is provided)
                    $existingProduct = null;
                    if (!empty($sku)) {
                        $stmt = DB::query('SELECT * FROM products WHERE shop_id = ? AND sku = ? LIMIT 1', [$shopId, $sku]);
                        $existingProduct = $stmt->fetch();
                    }
                    if (!$existingProduct && empty($sku) && !empty($name)) {
                        $stmt = DB::query('SELECT * FROM products WHERE shop_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [$shopId, $name]);
                        $existingProduct = $stmt->fetch();
                    }

                    // Resolve supplier ID by forced supplier, PO ID, Supplier ID, or Supplier Name
                    $resolvedSupplierId = null;
                    if ($forcedSupplierId !== null) {
                        $resolvedSupplierId = $forcedSupplierId;
                    } else if (!empty($supplierInput)) {
                        // 1. Check if it's in the format PO-XXXX
                        if (preg_match('/^PO[-_ ]?(\d+)$/i', $supplierInput, $matches)) {
                            $poId = intval($matches[1]);
                            $stmt = DB::query('SELECT supplier_id FROM purchase_orders WHERE shop_id = ? AND id = ?', [$shopId, $poId]);
                            $po = $stmt->fetch();
                            if ($po && !empty($po['supplier_id'])) {
                                $resolvedSupplierId = intval($po['supplier_id']);
                            }
                        }

                        // 2. Check if it's a numeric Supplier ID
                        if ($resolvedSupplierId === null && is_numeric($supplierInput)) {
                            $stmt = DB::query('SELECT id FROM suppliers WHERE shop_id = ? AND id = ?', [$shopId, intval($supplierInput)]);
                            $sup = $stmt->fetch();
                            if ($sup) {
                                $resolvedSupplierId = intval($sup['id']);
                            }
                        }

                        // 3. Try finding existing supplier by name (case-insensitive)
                        if ($resolvedSupplierId === null) {
                            $stmt = DB::query('SELECT id FROM suppliers WHERE shop_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [$shopId, $supplierInput]);
                            $sup = $stmt->fetch();
                            if ($sup) {
                                $resolvedSupplierId = intval($sup['id']);
                            }
                        }

                        // 4. If supplier not found, automatically create it
                        if ($resolvedSupplierId === null) {
                            DB::query(
                                'INSERT INTO suppliers (shop_id, name) VALUES (?, ?)',
                                [$shopId, $supplierInput]
                            );
                            $resolvedSupplierId = intval(DB::lastInsertId());
                        }
                    }

                    if ($existingProduct) {
                        // Update existing product without overwriting omitted optional fields
                        $existingId = intval($existingProduct['id']);
                        $updateFields = ['name = ?'];
                        $updateParams = [$name];

                        if ($resolvedSupplierId !== null) {
                            $updateFields[] = 'supplier_id = ?';
                            $updateParams[] = $resolvedSupplierId;
                        }
                        if ($columnMap['price'] !== false && trim($row[$columnMap['price']] ?? '') !== '') {
                            $updateFields[] = 'price = ?';
                            $updateParams[] = $price;
                        }
                        if ($columnMap['cost_price'] !== false && trim($row[$columnMap['cost_price']] ?? '') !== '') {
                            $updateFields[] = 'cost_price = ?';
                            $updateParams[] = $costPrice;
                        }
                        if ($columnMap['stock_quantity'] !== false && trim($row[$columnMap['stock_quantity']] ?? '') !== '') {
                            $updateFields[] = 'stock_quantity = ?';
                            $updateParams[] = $stockQuantity;
                        }
                        if ($columnMap['low_stock_threshold'] !== false && trim($row[$columnMap['low_stock_threshold']] ?? '') !== '') {
                            $updateFields[] = 'low_stock_threshold = ?';
                            $updateParams[] = $lowStockThreshold;
                        }
                        if ($columnMap['unit'] !== false && trim($row[$columnMap['unit']] ?? '') !== '') {
                            $updateFields[] = 'unit = ?';
                            $updateParams[] = $unit;
                        }
                        if ($columnMap['category'] !== false && trim($row[$columnMap['category']] ?? '') !== '') {
                            $updateFields[] = 'category = ?';
                            $updateParams[] = $category;
                        }
                        if (!empty($expiryDate)) {
                            $updateFields[] = 'expiry_date = ?';
                            $updateParams[] = $expiryDate;
                        }

                        $updateParams[] = $existingId;
                        $updateParams[] = $shopId;

                        DB::query(
                            'UPDATE products SET ' . implode(', ', $updateFields) . ' WHERE id = ? AND shop_id = ?',
                            $updateParams
                        );
                    } else {
                        // Insert new product
                        DB::query(
                            'INSERT INTO products (shop_id, name, sku, price, cost_price, stock_quantity, low_stock_threshold, expiry_date, supplier_id, unit, category) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            [
                                $shopId,
                                $name,
                                $sku,
                                $price,
                                $costPrice,
                                $stockQuantity,
                                $lowStockThreshold,
                                !empty($expiryDate) ? $expiryDate : null,
                                $resolvedSupplierId,
                                $unit,
                                !empty($category) ? $category : null
                            ]
                        );

                        $newProductId = DB::lastInsertId();

                        // Track new product for PO creation if stock > 0
                        if ($resolvedSupplierId !== null && $stockQuantity > 0) {
                            if (!isset($productsBySupplier[$resolvedSupplierId])) {
                                $productsBySupplier[$resolvedSupplierId] = [];
                            }
                            $productsBySupplier[$resolvedSupplierId][] = [
                                'product_id' => $newProductId,
                                'name' => $name,
                                'sku' => $sku,
                                'quantity' => $stockQuantity,
                                'cost_price' => $costPrice,
                                'selling_price' => $price,
                                'expiry_date' => !empty($expiryDate) ? $expiryDate : null,
                                'category' => !empty($category) ? $category : null
                            ];
                            $newProductIds[] = [
                                'product_id' => $newProductId,
                                'supplier_id' => $resolvedSupplierId,
                                'cost_price' => $costPrice
                            ];
                        }
                    }

                    $successCount++;

                } catch (\Exception $e) {
                    $errors[] = "Row $rowNumber: " . $e->getMessage();
                    $errorCount++;
                }
            }

            fclose($handle);

            // Create purchase orders for each supplier as draft if items have quantity > 0
            foreach ($productsBySupplier as $supplierId => $items) {
                if (empty($items)) continue;

                // Calculate total amount
                $totalAmount = 0.0;
                foreach ($items as $item) {
                    $totalAmount += $item['quantity'] * $item['cost_price'];
                }

                // Create purchase order as draft
                DB::query(
                    'INSERT INTO purchase_orders (shop_id, supplier_id, status, total_amount, paid_amount, due_amount, payment_basis, notes, order_date) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [
                        $shopId,
                        $supplierId,
                        'draft',
                        $totalAmount,
                        $totalAmount,
                        0.00,
                        'cash',
                        'Auto-generated from CSV bulk upload - pending confirmation',
                    ]
                );
                $poId = DB::lastInsertId();

                // Insert PO items
                foreach ($items as $item) {
                    $subtotal = $item['quantity'] * $item['cost_price'];
                    DB::query(
                        'INSERT INTO purchase_order_items (purchase_order_id, shop_id, product_id, quantity_ordered, quantity_received, cost_price, selling_price, subtotal, expiry_date) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                            $poId,
                            $shopId,
                            $item['product_id'],
                            $item['quantity'],
                            0,
                            $item['cost_price'],
                            $item['selling_price'],
                            $subtotal,
                            $item['expiry_date']
                        ]
                    );
                }
            }

            // Cost logs will be created when PO is received (to avoid duplicates)

            DB::commit();

            header('Content-Type: application/json');
            http_response_code(200);
            $jsonOutput = json_encode([
                'message' => "Bulk upload completed. $successCount products imported successfully, $errorCount failed.",
                'success_count' => $successCount,
                'error_count' => $errorCount,
                'errors' => array_slice($errors, 0, 10) // Return first 10 errors
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($jsonOutput === false) {
                $jsonError = json_last_error_msg();
                error_log('JSON encoding error: ' . $jsonError);
                Auth::jsonError('Server error encoding response: ' . $jsonError, 500);
            }
            
            echo $jsonOutput;

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Bulk upload error: ' . $e->getMessage());
            Auth::jsonError('Server error during bulk upload: ' . $e->getMessage(), 500);
        }
    }

    private static function findColumn($aliases, $headers) {
        foreach ($aliases as $alias) {
            $index = array_search($alias, $headers);
            if ($index !== false) {
                return $index;
            }
        }
        return false;
    }

    public static function getProductStockSalesHistory($productId) {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;
        $hasShop = $shopId !== null;
        $productId = (int)$productId;
        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;

        try {
            // Verify product exists and belongs to the shop (if shop is specified)
            $sql = 'SELECT name, sku, stock_quantity, shop_id FROM products WHERE id = ?';
            $params = [$productId];
            if ($hasShop) {
                $sql .= ' AND shop_id = ?';
                $params[] = $shopId;
            }
            $stmt = DB::query($sql, $params);
            $product = $stmt->fetch();
            if (!$product) {
                Auth::jsonError('Product not found or access denied.', 404);
            }

            // Resolve shopId if not explicitly provided (e.g. for super_admin)
            if (!$hasShop) {
                $shopId = (int)$product['shop_id'];
            }

            // Calculate future changes if end date is specified (for retrospective timeline starting point)
            $futureChange = 0.0;
            if (!empty($endDate)) {
                $futureSql = "SELECT SUM(qty_change) AS total_future_change FROM (
                    -- Sales
                    SELECT -si.quantity AS qty_change, s.created_at AS event_date 
                    FROM sale_items si JOIN sales s ON si.sale_id = s.id 
                    WHERE si.product_id = ? AND si.shop_id = ?
                    UNION ALL
                    -- Purchases
                    SELECT COALESCE(poi.quantity_received, poi.quantity_ordered) AS qty_change, COALESCE(po.received_date, po.created_at) AS event_date 
                    FROM purchase_order_items poi JOIN purchase_orders po ON poi.purchase_order_id = po.id 
                    WHERE poi.product_id = ? AND poi.shop_id = ? AND po.status = 'received'
                      AND COALESCE(poi.quantity_received, poi.quantity_ordered) > 0
                    UNION ALL
                    -- Customer Returns
                    SELECT cr.quantity AS qty_change, cr.created_at AS event_date 
                    FROM customer_returns cr 
                    WHERE cr.product_id = ? AND cr.shop_id = ?
                    UNION ALL
                    -- Supplier Returns
                    SELECT -sr.quantity AS qty_change, sr.created_at AS event_date 
                    FROM supplier_returns sr 
                    WHERE sr.product_id = ? AND sr.shop_id = ?
                    UNION ALL
                    -- Wastages
                    SELECT -w.quantity AS qty_change, w.adjusted_at AS event_date 
                    FROM wastages w 
                    WHERE w.product_id = ? AND w.shop_id = ?
                    UNION ALL
                    -- Adjustments
                    SELECT difference AS qty_change, created_at AS event_date 
                    FROM inventory_adjustments 
                    WHERE product_id = ? AND shop_id = ?
                ) fut WHERE event_date > ?";
                
                $stmt = DB::query($futureSql, [
                    $productId, $shopId,
                    $productId, $shopId,
                    $productId, $shopId,
                    $productId, $shopId,
                    $productId, $shopId,
                    $productId, $shopId,
                    "$endDate 23:59:59"
                ]);
                $futureChange = (float)($stmt->fetchColumn() ?: 0.0);
            }

            // Retrieve history of events within date range
            $eventsSql = "SELECT event_date, qty_change, qty_sold, type, cost_price, sold_price, subtotal, discount, reference_id, reference_number FROM (
                -- Sales
                SELECT s.created_at AS event_date, -si.quantity AS qty_change, si.quantity AS qty_sold,
                       'sale' AS type, si.cost_price AS cost_price, si.unit_price AS sold_price, si.subtotal AS subtotal, s.discount AS discount,
                       s.id AS reference_id, CONCAT('INV-', s.id) AS reference_number
                FROM sale_items si
                JOIN sales s ON si.sale_id = s.id
                WHERE si.product_id = ? AND si.shop_id = ?
                
                UNION ALL
                
                -- Purchases
                -- Always use quantity_received (the current, possibly-edited value) as the
                -- authoritative qty for history. original_quantity_received is an audit field only
                -- and must NOT be used here, otherwise an edited purchase would show stale numbers
                -- while the stock walk would disagree with products.stock_quantity.
                SELECT COALESCE(po.received_date, po.created_at) AS event_date,
                       COALESCE(poi.quantity_received, poi.quantity_ordered) AS qty_change, 0 AS qty_sold,
                       'purchase' AS type, poi.cost_price AS cost_price, NULL AS sold_price, poi.subtotal AS subtotal, 0 AS discount,
                       po.id AS reference_id, CONCAT('PO-', po.id) AS reference_number
                FROM purchase_order_items poi
                JOIN purchase_orders po ON poi.purchase_order_id = po.id
                WHERE poi.product_id = ? AND poi.shop_id = ? AND po.status = 'received'
                  AND COALESCE(poi.quantity_received, poi.quantity_ordered) > 0
                
                UNION ALL
                
                -- Customer Returns
                SELECT cr.created_at AS event_date, cr.quantity AS qty_change, -cr.quantity AS qty_sold,
                       'customer_return' AS type, NULL AS cost_price, NULL AS sold_price, 0 AS subtotal, 0 AS discount,
                       cr.id AS reference_id, NULL AS reference_number
                FROM customer_returns cr
                WHERE cr.product_id = ? AND cr.shop_id = ?
                
                UNION ALL
                
                -- Supplier Returns
                SELECT sr.created_at AS event_date, -sr.quantity AS qty_change, 0 AS qty_sold,
                       'supplier_return' AS type, NULL AS cost_price, NULL AS sold_price, 0 AS subtotal, 0 AS discount,
                       sr.id AS reference_id, NULL AS reference_number
                FROM supplier_returns sr
                WHERE sr.product_id = ? AND sr.shop_id = ?
                
                UNION ALL
                
                -- Wastages
                SELECT w.adjusted_at AS event_date, -w.quantity AS qty_change, 0 AS qty_sold,
                       'wastage' AS type, NULL AS cost_price, NULL AS sold_price, 0 AS subtotal, 0 AS discount,
                       w.id AS reference_id, NULL AS reference_number
                FROM wastages w
                WHERE w.product_id = ? AND w.shop_id = ?
                
                UNION ALL
                
                -- Adjustments
                SELECT ia.created_at AS event_date, 
                       ia.difference AS qty_change,
                       0 AS qty_sold,
                       'adjustment' AS type, NULL AS cost_price, NULL AS sold_price, 0 AS subtotal, 0 AS discount,
                       ia.id AS reference_id, NULL AS reference_number
                FROM inventory_adjustments ia
                WHERE ia.product_id = ? AND ia.shop_id = ?
            ) ev";

            $params = [
                $productId, $shopId,
                $productId, $shopId,
                $productId, $shopId,
                $productId, $shopId,
                $productId, $shopId,
                $productId, $shopId
            ];

            if (!empty($startDate) && !empty($endDate)) {
                $eventsSql .= " WHERE ev.event_date BETWEEN ? AND ?";
                $params[] = "$startDate 00:00:00";
                $params[] = "$endDate 23:59:59";
            } elseif (!empty($startDate)) {
                $eventsSql .= " WHERE ev.event_date >= ?";
                $params[] = "$startDate 00:00:00";
            } elseif (!empty($endDate)) {
                $eventsSql .= " WHERE ev.event_date <= ?";
                $params[] = "$endDate 23:59:59";
            }

            $eventsSql .= " ORDER BY ev.event_date DESC";
            $stmt = DB::query($eventsSql, $params);
            $rawEvents = $stmt->fetchAll();

            // 1. Group daily
            $dailyEvents = [];
            foreach ($rawEvents as $ev) {
                $day = date('Y-m-d', strtotime($ev['event_date']));
                if (!isset($dailyEvents[$day])) {
                    $dailyEvents[$day] = [
                        'date' => $day,
                        'qty_change' => 0.0,
                        'qty_sold' => 0.0,
                        'qty_purchased' => 0.0
                    ];
                }
                $dailyEvents[$day]['qty_change'] += (float)$ev['qty_change'];
                $dailyEvents[$day]['qty_sold'] += (float)$ev['qty_sold'];
                if ($ev['type'] === 'purchase') {
                    $dailyEvents[$day]['qty_purchased'] += (float)$ev['qty_change'];
                }
            }

            $dailyHistory = [];
            $runningStock = (float)$product['stock_quantity'] - $futureChange;
            foreach ($dailyEvents as $day => $data) {
                $dailyHistory[] = [
                    'date' => $day,
                    'qty_sold' => $data['qty_sold'],
                    'qty_change' => $data['qty_change'],
                    'qty_purchased' => $data['qty_purchased'],
                    'stock_left' => $runningStock
                ];
                $runningStock -= $data['qty_change'];
            }

            // 2. Group monthly
            $monthlyEvents = [];
            foreach ($rawEvents as $ev) {
                $month = date('Y-m', strtotime($ev['event_date']));
                if (!isset($monthlyEvents[$month])) {
                    $monthlyEvents[$month] = [
                        'month' => $month,
                        'qty_change' => 0.0,
                        'qty_sold' => 0.0,
                        'qty_purchased' => 0.0
                    ];
                }
                $monthlyEvents[$month]['qty_change'] += (float)$ev['qty_change'];
                $monthlyEvents[$month]['qty_sold'] += (float)$ev['qty_sold'];
                if ($ev['type'] === 'purchase') {
                    $monthlyEvents[$month]['qty_purchased'] += (float)$ev['qty_change'];
                }
            }

            $monthlyHistory = [];
            $runningStockMonthly = (float)$product['stock_quantity'] - $futureChange;
            foreach ($monthlyEvents as $month => $data) {
                $monthlyHistory[] = [
                    'month' => $month,
                    'qty_sold' => $data['qty_sold'],
                    'qty_change' => $data['qty_change'],
                    'qty_purchased' => $data['qty_purchased'],
                    'stock_left' => $runningStockMonthly
                ];
                $runningStockMonthly -= $data['qty_change'];
            }

            $detailedHistory = [];
            $runningStockDetailed = (float)$product['stock_quantity'] - $futureChange;
            foreach ($rawEvents as $ev) {
                $detailedHistory[] = [
                    'date' => date('Y-m-d H:i:s', strtotime($ev['event_date'])),
                    'type' => $ev['type'],
                    'qty_change' => (float)$ev['qty_change'],
                    'qty_sold' => (float)$ev['qty_sold'],
                    'cost_price' => $ev['cost_price'] !== null ? (float)$ev['cost_price'] : null,
                    'sold_price' => $ev['sold_price'] !== null ? (float)$ev['sold_price'] : null,
                    'subtotal' => (float)$ev['subtotal'],
                    'discount' => (float)$ev['discount'],
                    'reference_id' => $ev['reference_id'],
                    'reference_number' => $ev['reference_number'],
                    'stock_left' => $runningStockDetailed
                ];
                $runningStockDetailed -= (float)$ev['qty_change'];
            }

            header('Content-Type: application/json');
            echo json_encode([
                'product_name' => $product['name'],
                'sku' => $product['sku'],
                'current_stock' => (float)$product['stock_quantity'],
                'daily' => $dailyHistory,
                'monthly' => $monthlyHistory,
                'detailed' => $detailedHistory
            ]);

        } catch (\Exception $e) {
            error_log('Fetch product stock sales history error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving product history.', 500);
        }
    }
}
