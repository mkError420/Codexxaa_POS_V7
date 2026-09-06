<?php
/**
 * Supplier Controller
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../middleware/auth.php';

class SupplierController {

    public static function listSuppliers() {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;

        try {
            $stmt = DB::query(
                'SELECT id, name, contact_name, email, phone, due_balance FROM suppliers WHERE shop_id = ? ORDER BY name ASC',
                [$shopId]
            );
            $suppliers = $stmt->fetchAll();

            foreach ($suppliers as &$s) {
                $s['id'] = (int)$s['id'];
                $s['due_balance'] = (float)$s['due_balance'];
            }

            header('Content-Type: application/json');
            $jsonOutput = json_encode($suppliers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            
            if ($jsonOutput === false) {
                $jsonError = json_last_error_msg();
                error_log('JSON encoding error: ' . $jsonError);
                Auth::jsonError('Server error encoding supplier data: ' . $jsonError, 500);
            }
            
            echo $jsonOutput;

        } catch (\Exception $e) {
            error_log('Fetch suppliers error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving suppliers.', 500);
        }
    }

    public static function createSupplier($requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $shopId = Auth::$shopId;
        $name = $requestData['name'] ?? '';
        $contactName = $requestData['contact_name'] ?? null;
        $email = $requestData['email'] ?? null;
        $phone = $requestData['phone'] ?? null;

        if (empty($name)) {
            Auth::jsonError('Supplier name is required.', 400);
        }

        try {
            // Check if supplier already exists (case-insensitive match)
            $stmt = DB::query(
                'SELECT id, name, contact_name, email, phone FROM suppliers WHERE shop_id = ? AND LOWER(name) = LOWER(?)',
                [$shopId, $name]
            );
            $existingSupplier = $stmt->fetch();

            if ($existingSupplier) {
                // Return existing supplier
                header('Content-Type: application/json');
                echo json_encode([
                    'message' => 'Supplier already exists.',
                    'supplierId' => (int)$existingSupplier['id'],
                    'id' => (int)$existingSupplier['id'],
                    'name' => $existingSupplier['name'],
                    'contact_name' => $existingSupplier['contact_name'],
                    'email' => $existingSupplier['email'],
                    'phone' => $existingSupplier['phone'],
                    'due_balance' => (float)($existingSupplier['due_balance'] ?? 0)
                ]);
                return;
            }

            // Create new supplier
            DB::query(
                'INSERT INTO suppliers (shop_id, name, contact_name, email, phone) VALUES (?, ?, ?, ?, ?)',
                [$shopId, $name, empty($contactName) ? null : $contactName, empty($email) ? null : $email, empty($phone) ? null : $phone]
            );
            $newSupplierId = DB::lastInsertId();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Supplier created successfully.',
                'supplierId' => (int)$newSupplierId,
                'id' => (int)$newSupplierId,
                'name' => $name,
                'contact_name' => $contactName,
                'email' => $email,
                'phone' => $phone,
                'due_balance' => 0
            ]);

        } catch (\Exception $e) {
            error_log('Create supplier error: ' . $e->getMessage());
            Auth::jsonError('Server error creating supplier: ' . $e->getMessage(), 500);
        }
    }

    public static function listPurchaseOrders() {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;
        $status = $_GET['status'] ?? null;
        $supplierId = $_GET['supplier_id'] ?? null;
        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;

        try {
            $sql = 'SELECT po.*, s.name AS supplier_name 
                    FROM purchase_orders po 
                    JOIN suppliers s ON po.supplier_id = s.id 
                    WHERE po.shop_id = ?';
            
            $params = [$shopId];

            if (!empty($status)) {
                $sql .= ' AND po.status = ?';
                $params[] = $status;
            }

            if (!empty($supplierId)) {
                $sql .= ' AND po.supplier_id = ?';
                $params[] = (int)$supplierId;
            }

            if (!empty($startDate) && !empty($endDate)) {
                $sql .= ' AND DATE(po.order_date) BETWEEN ? AND ?';
                $params[] = $startDate;
                $params[] = $endDate;
            }

            $sql .= ' ORDER BY po.created_at DESC';

            $stmt = DB::query($sql, $params);
            $pos = $stmt->fetchAll();

            foreach ($pos as &$po) {
                $po['id'] = (int)$po['id'];
                $po['shop_id'] = (int)$po['shop_id'];
                $po['supplier_id'] = (int)$po['supplier_id'];
                $po['total_amount'] = (float)$po['total_amount'];
                $po['paid_amount'] = (float)$po['paid_amount'];
                $po['due_amount'] = (float)$po['due_amount'];
            }

            header('Content-Type: application/json');
            echo json_encode($pos);

        } catch (\Exception $e) {
            error_log('List Purchase Orders Error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving purchase orders.', 500);
        }
    }

    /**
     * GET /suppliers/purchase-orders/filtered-items
     * Retrieves aggregated PO items for a specific date range across all purchase orders.
     */
    public static function getFilteredPOItems() {
        try {
            Auth::authenticate();
            Auth::enforceTenant();

            $shopId = Auth::$shopId;
            $startDate = $_GET['start_date'] ?? null;
            $endDate = $_GET['end_date'] ?? null;

            if (empty($startDate) || empty($endDate)) {
                Auth::jsonError('Please provide both start_date and end_date.', 400);
            }

            // Check which columns exist in purchase_order_items table
            $pdo = DB::getConnection();
            $columnExists = function($table, $column) use ($pdo) {
                try {
                    $stmt = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
                    return $stmt->rowCount() > 0;
                } catch (\PDOException $e) {
                    return false;
                }
            };

            // Use appropriate column names based on schema
            $qtyOrderedCol = $columnExists('purchase_order_items', 'quantity_ordered') ? 'quantity_ordered' : 'quantity';
            $qtyReceivedCol = $columnExists('purchase_order_items', 'quantity_received') ? 'quantity_received' : $qtyOrderedCol;
            $costPriceCol = $columnExists('purchase_order_items', 'cost_price') ? 'cost_price' : 'unit_price';

            // Aggregate PO items based on the filtered date range of the parent purchase_orders
            $sql = "
                SELECT 
                    poi.product_id,
                    p.sku,
                    p.name AS product_name,
                    poi.$costPriceCol AS cost_price,
                    poi.selling_price AS sale_price,
                    SUM(poi.$qtyOrderedCol) AS qty_ordered,
                    SUM(poi.$qtyReceivedCol) AS qty_received,
                    MAX(poi.expiry_date) AS expiry_date,
                    SUM(poi.subtotal) AS total_subtotal
                FROM purchase_order_items poi
                JOIN purchase_orders po ON poi.purchase_order_id = po.id
                JOIN products p ON poi.product_id = p.id
                WHERE po.shop_id = ? AND DATE(po.order_date) BETWEEN ? AND ?
                GROUP BY poi.product_id, p.sku, p.name, poi.$costPriceCol, poi.selling_price
                ORDER BY p.name ASC
            ";

            $stmt = DB::query($sql, [$shopId, $startDate, $endDate]);
            $items = $stmt->fetchAll();

            $formattedItems = [];
            foreach ($items as $item) {
                $formattedItems[] = [
                    'product_id' => (int)$item['product_id'],
                    'sku' => $item['sku'],
                    'product_name' => $item['product_name'],
                    'cost_price' => (float)$item['cost_price'],
                    'sale_price' => (float)$item['sale_price'],
                    'qty_ordered' => (float)$item['qty_ordered'],
                    'qty_received' => (float)$item['qty_received'],
                    'expiry_date' => $item['expiry_date'],
                    'total_subtotal' => (float)$item['total_subtotal']
                ];
            }

            header('Content-Type: application/json');
            echo json_encode($formattedItems);

        } catch (\Exception $e) {
            error_log('Fetch Filtered PO Items Error: ' . $e->getMessage());
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode(['error' => 'Server error retrieving filtered purchase order items: ' . $e->getMessage()]);
        }
    }

    public static function listCostPriceLogs() {
        Auth::authenticate();
        Auth::enforceTenant();

        $shopId = Auth::$shopId;
        $productId = $_GET['product_id'] ?? null;

        try {
            $sql = 'SELECT cpl.*, p.name AS product_name, p.sku AS product_sku, s.name AS supplier_name 
                    FROM cost_price_logs cpl 
                    JOIN products p ON cpl.product_id = p.id 
                    LEFT JOIN suppliers s ON cpl.supplier_id = s.id 
                    WHERE cpl.shop_id = ?';
            
            $params = [$shopId];

            if (!empty($productId)) {
                $sql .= ' AND cpl.product_id = ?';
                $params[] = (int)$productId;
            }

            $sql .= ' ORDER BY cpl.created_at DESC';

            $stmt = DB::query($sql, $params);
            $logs = $stmt->fetchAll();

            foreach ($logs as &$log) {
                $log['id'] = (int)$log['id'];
                $log['shop_id'] = (int)$log['shop_id'];
                $log['product_id'] = (int)$log['product_id'];
                $log['supplier_id'] = $log['supplier_id'] !== null ? (int)$log['supplier_id'] : null;
                $log['old_cost_price'] = $log['old_cost_price'] !== null ? (float)$log['old_cost_price'] : null;
                $log['new_cost_price'] = (float)$log['new_cost_price'];
            }

            header('Content-Type: application/json');
            echo json_encode($logs);

        } catch (\Exception $e) {
            error_log('Fetch cost price logs error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving cost price logs.', 500);
        }
    }

    public static function getCostPriceLog($id) {
        Auth::authenticate();
        Auth::enforceTenant();

        $logId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            $sql = 'SELECT cpl.*, p.name AS product_name, p.sku AS product_sku, p.category AS product_category, s.name AS supplier_name 
                    FROM cost_price_logs cpl 
                    JOIN products p ON cpl.product_id = p.id 
                    LEFT JOIN suppliers s ON cpl.supplier_id = s.id 
                    WHERE cpl.id = ? AND cpl.shop_id = ?';
            
            $stmt = DB::query($sql, [$logId, $shopId]);
            $log = $stmt->fetch();

            if (!$log) {
                Auth::jsonError('Cost price log not found.', 404);
            }

            $log['id'] = (int)$log['id'];
            $log['shop_id'] = (int)$log['shop_id'];
            $log['product_id'] = (int)$log['product_id'];
            $log['supplier_id'] = $log['supplier_id'] !== null ? (int)$log['supplier_id'] : null;
            $log['old_cost_price'] = $log['old_cost_price'] !== null ? (float)$log['old_cost_price'] : null;
            $log['new_cost_price'] = (float)$log['new_cost_price'];

            header('Content-Type: application/json');
            echo json_encode($log);

        } catch (\Exception $e) {
            error_log('Fetch cost price log error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving cost price log.', 500);
        }
    }

    public static function deleteCostPriceLog($id) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $logId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            // Check if log exists and belongs to shop
            $stmt = DB::query('SELECT id, product_id FROM cost_price_logs WHERE id = ? AND shop_id = ?', [$logId, $shopId]);
            $log = $stmt->fetch();

            if (!$log) {
                Auth::jsonError('Cost price log not found.', 404);
            }

            // Delete the log
            DB::query('DELETE FROM cost_price_logs WHERE id = ? AND shop_id = ?', [$logId, $shopId]);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Cost price log deleted successfully.']);

        } catch (\Exception $e) {
            error_log('Delete cost price log error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting cost price log.', 500);
        }
    }

    public static function exportCostPriceLogsCSV() {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;

        try {
            $sql = 'SELECT cpl.id, p.name AS product_name, p.sku AS product_sku, s.name AS supplier_name, 
                           cpl.old_cost_price, cpl.new_cost_price, cpl.reason, cpl.created_at 
                    FROM cost_price_logs cpl 
                    JOIN products p ON cpl.product_id = p.id 
                    LEFT JOIN suppliers s ON cpl.supplier_id = s.id 
                    WHERE cpl.shop_id = ? 
                    ORDER BY cpl.created_at DESC';
            
            $stmt = DB::query($sql, [$shopId]);
            $logs = $stmt->fetchAll();

            if (empty($logs)) {
                Auth::jsonError('No logs found to export.', 404);
            }

            if (ob_get_level()) {
                ob_end_clean();
            }

            header('Content-Type: text/csv');
            header('Content-Disposition: attachment; filename="cost_price_logs_export_' . date('Y-m-d') . '.csv"');
            
            $output = fopen('php://output', 'w');
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
            
            fputcsv($output, ['Log ID', 'Product Name', 'SKU', 'Supplier', 'Old Cost Price', 'New Cost Price', 'Reason', 'Logged At']);

            foreach ($logs as $log) {
                fputcsv($output, [
                    $log['id'],
                    $log['product_name'],
                    $log['product_sku'],
                    $log['supplier_name'] ?: 'N/A',
                    $log['old_cost_price'] !== null ? $log['old_cost_price'] : 'N/A',
                    $log['new_cost_price'],
                    $log['reason'] ?: '',
                    $log['created_at']
                ]);
            }
            fclose($output);
            exit;

        } catch (\Exception $e) {
            error_log('Cost price logs export CSV error: ' . $e->getMessage());
            Auth::jsonError('Server error exporting cost price logs to CSV.', 500);
        }
    }

    public static function exportPurchaseOrdersCSV() {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $shopId = Auth::$shopId;

        try {
            $sql = 'SELECT po.id, s.name AS supplier_name, po.status, po.total_amount, po.paid_amount, 
                           po.due_amount, po.payment_basis, po.order_date, po.received_date 
                    FROM purchase_orders po 
                    JOIN suppliers s ON po.supplier_id = s.id 
                    WHERE po.shop_id = ? 
                    ORDER BY po.created_at DESC';
            
            $stmt = DB::query($sql, [$shopId]);
            $pos = $stmt->fetchAll();

            if (empty($pos)) {
                Auth::jsonError('No purchase orders found to export.', 404);
            }

            if (ob_get_level()) {
                ob_end_clean();
            }

            header('Content-Type: text/csv');
            header('Content-Disposition: attachment; filename="purchase_orders_export_' . date('Y-m-d') . '.csv"');
            
            $output = fopen('php://output', 'w');
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
            
            fputcsv($output, ['PO ID', 'Supplier', 'Status', 'Total Value', 'Paid Amount', 'Due Amount', 'Payment Basis', 'Ordered At', 'Received At']);

            foreach ($pos as $po) {
                fputcsv($output, [
                    $po['id'],
                    $po['supplier_name'],
                    $po['status'],
                    $po['total_amount'],
                    $po['paid_amount'],
                    $po['due_amount'],
                    $po['payment_basis'],
                    $po['order_date'],
                    $po['received_date'] ?: 'N/A'
                ]);
            }
            fclose($output);
            exit;

        } catch (\Exception $e) {
            error_log('Purchase orders export CSV error: ' . $e->getMessage());
            Auth::jsonError('Server error exporting purchase orders to CSV.', 500);
        }
    }

    private static function processAndInsertPoItems($poId, $shopId, $supplierId, $items, $status = 'draft') {
        $normalizedItems = [];
        foreach ($items as $item) {
            $qty = isset($item['quantity']) ? (int)$item['quantity'] : (isset($item['quantity_ordered']) ? (int)$item['quantity_ordered'] : 0);
            $costPrice = isset($item['cost_price']) ? (float)$item['cost_price'] : (isset($item['unit_price']) ? (float)$item['unit_price'] : 0.00);
            $sellingPrice = isset($item['selling_price']) ? (float)$item['selling_price'] : 0.00;
            $productId = isset($item['product_id']) && $item['product_id'] ? (int)$item['product_id'] : null;
            $isNew = isset($item['is_new']) ? (bool)$item['is_new'] : false;
            $name = $item['name'] ?? '';
            $sku = $item['sku'] ?? '';
            $unit = $item['unit'] ?? 'piece';
            $unitSize = !empty($item['unit_size']) ? trim($item['unit_size']) : null;
            $lowStock = $item['low_stock_threshold'] ?? 10;
            $category = $item['category'] ?? null;
            $expiryDate = !empty($item['expiry_date']) ? $item['expiry_date'] : null;

            $normalizedItems[] = [
                'product_id' => $productId,
                'quantity' => $qty,
                'cost_price' => $costPrice,
                'selling_price' => $sellingPrice,
                'is_new' => $isNew,
                'name' => $name,
                'sku' => $sku,
                'unit' => $unit,
                'unit_size' => $unitSize,
                'low_stock_threshold' => $lowStock,
                'category' => $category,
                'expiry_date' => $expiryDate
            ];
        }

        $totalAmount = 0.00;
        foreach ($normalizedItems as $item) {
            $totalAmount += $item['quantity'] * $item['cost_price'];
        }

        // Check which columns exist in purchase_order_items table
        $pdo = DB::getConnection();
        $columnExists = function($table, $column) use ($pdo) {
            try {
                $stmt = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
                return $stmt->rowCount() > 0;
            } catch (\PDOException $e) {
                return false;
            }
        };

        $qtyOrderedCol = $columnExists('purchase_order_items', 'quantity_ordered') ? 'quantity_ordered' : 'quantity';
        $costPriceCol = $columnExists('purchase_order_items', 'cost_price') ? 'cost_price' : 'unit_price';
        $hasShopId = $columnExists('purchase_order_items', 'shop_id');
        $hasSellingPrice = $columnExists('purchase_order_items', 'selling_price');
        $hasQtyReceived = $columnExists('purchase_order_items', 'quantity_received');
        $hasExpiryDate = $columnExists('purchase_order_items', 'expiry_date');
        $hasPoiUnitSize = $columnExists('purchase_order_items', 'unit_size');
        $hasProdUnitSize = $columnExists('products', 'unit_size');

        foreach ($normalizedItems as $item) {
            $productId = $item['product_id'];
            $resolvedExpiry = !empty($item['expiry_date']) ? date('Y-m-d', strtotime($item['expiry_date'])) : null;

            // 1. If product_id was provided, verify it exists in this shop
            $existingProd = null;
            if (!empty($productId)) {
                $stmt = DB::query('SELECT * FROM products WHERE id = ? AND shop_id = ? LIMIT 1', [$productId, $shopId]);
                $existingProd = $stmt->fetch();
                // If item has a SKU specified and it's different from the existing product's SKU, don't blindly reuse this product ID
                if ($existingProd && !empty($item['sku']) && strcasecmp(trim($item['sku']), trim($existingProd['sku'] ?? '')) !== 0) {
                    // Check if another product with this new SKU exists
                    $stmtSku = DB::query('SELECT * FROM products WHERE shop_id = ? AND sku = ? LIMIT 1', [$shopId, trim($item['sku'])]);
                    $existingProd = $stmtSku->fetch();
                    if (!$existingProd) {
                        // Brand new product variant with new SKU!
                        $productId = null;
                    } else {
                        $productId = (int)$existingProd['id'];
                    }
                }
            }

            // 2. If not found by product_id, try finding strictly by SKU (if provided)
            if (!$existingProd && !empty($item['sku'])) {
                $stmt = DB::query('SELECT * FROM products WHERE shop_id = ? AND sku = ? LIMIT 1', [$shopId, trim($item['sku'])]);
                $existingProd = $stmt->fetch();
                if ($existingProd) {
                    $productId = (int)$existingProd['id'];
                }
            }

            // 3. Only if no SKU was provided AND is_new is false, try finding by Name (case-insensitive and trimmed)
            if (!$existingProd && empty($item['sku']) && empty($item['is_new']) && !empty($item['name'])) {
                $stmt = DB::query('SELECT * FROM products WHERE shop_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [$shopId, $item['name']]);
                $existingProd = $stmt->fetch();
                if ($existingProd) {
                    $productId = (int)$existingProd['id'];
                }
            }

            if ($existingProd) {
                // Product already exists in products table! Reuse it.
                $productId = (int)$existingProd['id'];

                $updateFields = [];
                $updateParams = [];

                if ($supplierId) {
                    $updateFields[] = 'supplier_id = ?';
                    $updateParams[] = $supplierId;
                }
                if (!empty($item['category'])) {
                    $updateFields[] = 'category = COALESCE(?, category)';
                    $updateParams[] = $item['category'];
                }
                if (!empty($item['unit_size']) && $hasProdUnitSize) {
                    $updateFields[] = 'unit_size = COALESCE(?, unit_size)';
                    $updateParams[] = $item['unit_size'];
                }
                if (!empty($resolvedExpiry)) {
                    $updateFields[] = 'expiry_date = COALESCE(?, expiry_date)';
                    $updateParams[] = $resolvedExpiry;
                }
                if ($item['selling_price'] > 0) {
                    $updateFields[] = 'price = ?';
                    $updateParams[] = $item['selling_price'];
                }
                if ($item['cost_price'] > 0) {
                    $updateFields[] = 'cost_price = ?';
                    $updateParams[] = $item['cost_price'];
                }

                if (!empty($updateFields)) {
                    $updateParams[] = $productId;
                    $updateParams[] = $shopId;
                    DB::query('UPDATE products SET ' . implode(', ', $updateFields) . ' WHERE id = ? AND shop_id = ?', $updateParams);
                }
            } else {
                // Completely new product not in database
                $sku = !empty($item['sku']) ? trim($item['sku']) : ('SKU-' . strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $item['name']), 0, 3)) . '-' . rand(100, 999));
                
                // Ensure generated SKU is unique in shop
                $skuCheck = DB::query('SELECT id FROM products WHERE shop_id = ? AND sku = ?', [$shopId, $sku]);
                if ($skuCheck->fetch()) {
                    $sku = 'SKU-' . strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $item['name']), 0, 3)) . '-' . rand(1000, 9999);
                }

                $sellingPriceVal = ($item['selling_price'] > 0) ? $item['selling_price'] : $item['cost_price'];
                $categoryVal = !empty($item['category']) ? $item['category'] : null;

                if ($hasProdUnitSize) {
                    DB::query(
                        'INSERT INTO products (shop_id, name, sku, price, cost_price, stock_quantity, low_stock_threshold, expiry_date, supplier_id, unit, category, unit_size)
                         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)',
                        [
                            $shopId,
                            $item['name'],
                            $sku,
                            $sellingPriceVal,
                            $item['cost_price'],
                            (int)$item['low_stock_threshold'],
                            $resolvedExpiry,
                            $supplierId,
                            $item['unit'],
                            $categoryVal,
                            !empty($item['unit_size']) ? $item['unit_size'] : null
                        ]
                    );
                } else {
                    DB::query(
                        'INSERT INTO products (shop_id, name, sku, price, cost_price, stock_quantity, low_stock_threshold, expiry_date, supplier_id, unit, category)
                         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)',
                        [
                            $shopId,
                            $item['name'],
                            $sku,
                            $sellingPriceVal,
                            $item['cost_price'],
                            (int)$item['low_stock_threshold'],
                            $resolvedExpiry,
                            $supplierId,
                            $item['unit'],
                            $categoryVal
                        ]
                    );
                }
                $productId = (int)DB::lastInsertId();
            }

            $subtotal = $item['quantity'] * $item['cost_price'];
            
            $poItemCols = ['purchase_order_id', 'product_id', $qtyOrderedCol, $costPriceCol, 'subtotal'];
            $poItemParams = [$poId, $productId, $item['quantity'], $item['cost_price'], $subtotal];

            if ($hasShopId) {
                $poItemCols[] = 'shop_id';
                $poItemParams[] = $shopId;
            }
            if ($hasSellingPrice) {
                $poItemCols[] = 'selling_price';
                $poItemParams[] = $item['selling_price'];
            }
            if ($hasQtyReceived) {
                $poItemCols[] = 'quantity_received';
                $poItemParams[] = ($status === 'received') ? $item['quantity'] : 0;
            }
            if ($hasExpiryDate) {
                $poItemCols[] = 'expiry_date';
                $poItemParams[] = $resolvedExpiry;
            }
            if ($hasPoiUnitSize && !empty($item['unit_size'])) {
                $poItemCols[] = 'unit_size';
                $poItemParams[] = $item['unit_size'];
            }

            $placeholders = implode(', ', array_fill(0, count($poItemCols), '?'));
            $colNames = implode(', ', $poItemCols);

            DB::query("INSERT INTO purchase_order_items ($colNames) VALUES ($placeholders)", $poItemParams);
            $poiId = DB::lastInsertId();

            // If creating as received, immediately credit stock + write inventory batch
            if ($status === 'received') {
                $updatePrice = ($item['selling_price'] > 0) ? $item['selling_price'] : $item['cost_price'];
                DB::query(
                    'UPDATE products SET stock_quantity = stock_quantity + ?, cost_price = ?, price = ? WHERE id = ? AND shop_id = ?',
                    [
                        $item['quantity'],
                        $item['cost_price'],
                        $updatePrice,
                        $productId,
                        $shopId
                    ]
                );
                $batchNumber = 'BATCH-' . strtoupper(uniqid());
                try {
                    DB::query(
                        'INSERT INTO inventory_batches (shop_id, product_id, purchase_order_item_id, batch_number, quantity, cost_price, expiry_date, received_date)
                         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
                        [$shopId, $productId, ($poiId ? $poiId : null), $batchNumber, $item['quantity'], $item['cost_price'], $resolvedExpiry]
                    );
                } catch (\Exception $e) { /* inventory_batches may not exist */ }
            }
        }

        return $totalAmount;
    }

    public static function createPurchaseOrder($requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $shopId = Auth::$shopId;
        $supplierId = $requestData['supplier_id'] ?? null;
        $orderDate = $requestData['order_date'] ?? null;
        $status = $requestData['status'] ?? 'draft';
        $notes = $requestData['notes'] ?? null;
        $paymentBasis = $requestData['payment_basis'] ?? 'cash';
        $paidAmount = $requestData['paid_amount'] ?? 0.00;
        $items = $requestData['items'] ?? [];

        if (empty($supplierId) || empty($items) || !is_array($items)) {
            Auth::jsonError('Supplier ID and ordering items are required.', 400);
        }

        if (!in_array($status, ['draft', 'ordered', 'received', 'cancelled'])) {
            Auth::jsonError('Invalid purchase order status.', 400);
        }

        try {
            DB::beginTransaction();

            // Insert PO with temporary total_amount = 0 (will update it after inserting items)
            DB::query(
                'INSERT INTO purchase_orders (shop_id, supplier_id, order_date, status, total_amount, paid_amount, due_amount, payment_basis, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [$shopId, $supplierId, $orderDate, $status, 0.00, 0.00, 0.00, $paymentBasis, $notes]
            );
            $poId = DB::lastInsertId();

            // Ensure expiry_date column exists on purchase_order_items
            try {
                $colCheck = DB::query("SHOW COLUMNS FROM purchase_order_items LIKE 'expiry_date'");
                if (!$colCheck->fetch()) {
                    DB::query("ALTER TABLE purchase_order_items ADD COLUMN expiry_date DATE NULL DEFAULT NULL");
                }
            } catch (\Exception $e) { /* skip */ }

            // Insert items and calculate total amount
            $totalAmount = self::processAndInsertPoItems($poId, $shopId, $supplierId, $items, $status);


            // Calculate paid & due amounts based on payment basis
            if ($paymentBasis === 'credit') {
                $requestedPaidAmount = (float)$paidAmount;
                if ($requestedPaidAmount < 0) {
                    $requestedPaidAmount = 0.00;
                }
                $paidAmount = min($requestedPaidAmount, $totalAmount);
                $dueAmount = $totalAmount - $paidAmount;
            } else {
                $paidAmount = $totalAmount;
                $dueAmount = 0.00;
            }

            // Update main PO with correct totals
            DB::query(
                'UPDATE purchase_orders SET total_amount = ?, paid_amount = ?, due_amount = ? WHERE id = ? AND shop_id = ?',
                [$totalAmount, $paidAmount, $dueAmount, $poId, $shopId]
            );

            // Update supplier due balance if status is ordered or received, payment basis is credit, and due amount > 0
            if (in_array($status, ['ordered', 'received']) && $paymentBasis === 'credit' && $dueAmount > 0) {
                DB::query(
                    'UPDATE suppliers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?',
                    [$dueAmount, $supplierId, $shopId]
                );
            }

            DB::commit();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Purchase Order created successfully.',
                'poId' => (int)$poId
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Create PO error: ' . $e->getMessage());
            Auth::jsonError('Server error creating Purchase Order: ' . $e->getMessage(), 500);
        }
    }

    public static function getPurchaseOrder($id) {
        Auth::authenticate();
        Auth::enforceTenant();

        $poId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            // Fetch main PO details
            $stmt = DB::query(
                'SELECT po.*, s.name AS supplier_name 
                 FROM purchase_orders po 
                 JOIN suppliers s ON po.supplier_id = s.id 
                 WHERE po.id = ? AND po.shop_id = ?',
                [$poId, $shopId]
            );
            $po = $stmt->fetch();

            if (!$po) {
                Auth::jsonError('Purchase Order not found.', 404);
            }

            $po['id'] = (int)$po['id'];
            $po['shop_id'] = (int)$po['shop_id'];
            $po['supplier_id'] = (int)$po['supplier_id'];
            $po['total_amount'] = (float)$po['total_amount'];
            $po['paid_amount'] = (float)$po['paid_amount'];
            $po['due_amount'] = (float)$po['due_amount'];

            // Check if purchase_order_items has shop_id column
            $pdo = DB::getConnection();
            $columnExists = function($table, $column) use ($pdo) {
                try {
                    $stmt = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
                    return $stmt->rowCount() > 0;
                } catch (\PDOException $e) {
                    return false;
                }
            };
            
            $hasShopId = $columnExists('purchase_order_items', 'shop_id');
            $hasPoiUnitSize = $columnExists('purchase_order_items', 'unit_size');
            $hasProdUnitSize = $columnExists('products', 'unit_size');
            
            $unitSizeSelect = '';
            if ($hasPoiUnitSize && $hasProdUnitSize) {
                $unitSizeSelect = ', COALESCE(poi.unit_size, p.unit_size, "") AS unit_size';
            } elseif ($hasPoiUnitSize) {
                $unitSizeSelect = ', poi.unit_size AS unit_size';
            } elseif ($hasProdUnitSize) {
                $unitSizeSelect = ', p.unit_size AS unit_size';
            }
            
            // Fetch PO items
            if ($hasShopId) {
                $sql = 'SELECT poi.*, p.name AS product_name, p.sku AS product_sku, p.category AS product_category, p.unit AS product_unit ' . $unitSizeSelect . '
                        FROM purchase_order_items poi 
                        JOIN products p ON poi.product_id = p.id 
                        WHERE poi.purchase_order_id = ? AND poi.shop_id = ?';
                $params = [$poId, $shopId];
            } else {
                $sql = 'SELECT poi.*, p.name AS product_name, p.sku AS product_sku, p.category AS product_category, p.unit AS product_unit ' . $unitSizeSelect . '
                        FROM purchase_order_items poi 
                        JOIN products p ON poi.product_id = p.id 
                        WHERE poi.purchase_order_id = ?';
                $params = [$poId];
            }
            
            $stmt = DB::query($sql, $params);
            $items = $stmt->fetchAll();

            foreach ($items as &$item) {
                $item['id'] = (int)$item['id'];
                $item['purchase_order_id'] = (int)$item['purchase_order_id'];
                $item['shop_id'] = (int)$item['shop_id'];
                $item['product_id'] = (int)$item['product_id'];
                
                // Handle rename of quantity to quantity_ordered
                $qty = isset($item['quantity_ordered']) ? (int)$item['quantity_ordered'] : (isset($item['quantity']) ? (int)$item['quantity'] : 0);
                $item['quantity_ordered'] = $qty;
                $item['quantity'] = $qty;
                
                $item['cost_price'] = isset($item['cost_price']) ? (float)$item['cost_price'] : (isset($item['unit_price']) ? (float)$item['unit_price'] : 0.00);
                $item['selling_price'] = $item['selling_price'] !== null ? (float)$item['selling_price'] : null;
                $item['subtotal'] = isset($item['subtotal']) ? (float)$item['subtotal'] : ($qty * $item['cost_price']);
                $item['unit_price'] = $item['cost_price']; // Alias for backward compatibility
            }

            $po['items'] = $items;

            header('Content-Type: application/json');
            echo json_encode($po);

        } catch (\Exception $e) {
            error_log('Get PO error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving Purchase Order detail.', 500);
        }
    }

    public static function updatePurchaseOrder($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $poId = (int)$id;
        $shopId = Auth::$shopId;
        $newSupplierId = $requestData['supplier_id'] ?? null;
        $orderDate = $requestData['order_date'] ?? null;
        $receivedDate = $requestData['received_date'] ?? null;
        $notes = $requestData['notes'] ?? null;
        $items = $requestData['items'] ?? [];

        try {
            DB::beginTransaction();

            // Ensure received_date column exists
            $columnCheck = DB::query("SHOW COLUMNS FROM purchase_orders LIKE 'received_date'");
            if ($columnCheck->fetch() === false) {
                DB::query("ALTER TABLE purchase_orders ADD COLUMN received_date DATE NULL DEFAULT NULL");
            }

            $stmt = DB::query('SELECT status, supplier_id FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);
            $po = $stmt->fetch();

            if (!$po) {
                DB::rollBack();
                Auth::jsonError('Purchase Order not found.', 404);
            }

            if ($po['status'] === 'cancelled') {
                DB::rollBack();
                Auth::jsonError('Cannot update cancelled Purchase Orders.', 400);
            }

            $oldSupplierId = (int)$po['supplier_id'];
            $supplierId = $newSupplierId ? (int)$newSupplierId : $oldSupplierId;
            $poStatus = $po['status'];
            $supplierChanged = ($oldSupplierId !== $supplierId);

            // Retrieve current PO info to get payment basis & paid amount fallback
            $poStmt = DB::query('SELECT payment_basis, paid_amount, due_amount FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);
            $poInfo = $poStmt->fetch();

            $paymentBasis = $requestData['payment_basis'] ?? ($poInfo ? $poInfo['payment_basis'] : 'cash');
            $requestedPaidAmount = isset($requestData['paid_amount']) ? (float)$requestData['paid_amount'] : ($poInfo ? (float)$poInfo['paid_amount'] : 0.00);

            // REVERT PREVIOUS PO EFFECTS IF IT WAS ALREADY RECEIVED OR ORDERED
            // NOTE: We do NOT revert stock for received POs because:
            // 1. Sales may have occurred based on the original quantity
            // 2. Editing a PO should only change the PO record, not historical stock movements
            // 3. The stock history should reflect what actually happened, not what was edited later
            if ($poStatus === 'received') {
                $stmt = DB::query('SELECT product_id, quantity_received FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?', [$poId, $shopId]);
                $oldItems = $stmt->fetchAll();

                // Store old items for later comparison with new items
                $oldItemsMap = [];
                foreach ($oldItems as $item) {
                    $oldItemsMap[(int)$item['product_id']] = (int)$item['quantity_received'];
                }
            }
            
            if (($poStatus === 'ordered' || $poStatus === 'received') && $poInfo['payment_basis'] === 'credit' && (float)$poInfo['due_amount'] > 0) {
                DB::query(
                    'UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                    [(float)$poInfo['due_amount'], $supplierId, $shopId]
                );
            }

            // Sync items
            if ($poStatus === 'received') {
                // For received POs:
                // - original_quantity_received preserves the first-ever received qty for audit trail
                // - quantity_received is updated to the new edited qty so history shows the correct amount
                // - stock_quantity is adjusted by the net delta (new qty - old qty_received)
                // - NO separate inventory_adjustments entry is created; the purchase row IS the record
                //
                // Ensure original_quantity_received column exists
                $columnCheck = DB::query("SHOW COLUMNS FROM purchase_order_items LIKE 'original_quantity_received'");
                if ($columnCheck->fetch() === false) {
                    DB::query("ALTER TABLE purchase_order_items ADD COLUMN original_quantity_received DECIMAL(10,3) NULL DEFAULT NULL");
                }
                
                // Back up original quantity_received the very first time this PO is edited
                DB::query(
                    'UPDATE purchase_order_items SET original_quantity_received = quantity_received WHERE purchase_order_id = ? AND shop_id = ? AND original_quantity_received IS NULL',
                    [$poId, $shopId]
                );
                
                // Calculate total amount and update items
                $totalAmount = 0.0;
                foreach ($items as $item) {
                    $productId = (int)$item['product_id'];
                    $qtyOrdered = (int)$item['quantity_ordered'];
                    $costPrice = (float)$item['cost_price'];
                    $sellingPrice = (float)($item['selling_price'] ?? 0);
                    
                    // Get current item data
                    $checkStmt = DB::query('SELECT id, quantity_ordered, quantity_received FROM purchase_order_items WHERE purchase_order_id = ? AND product_id = ? AND shop_id = ?', [$poId, $productId, $shopId]);
                    $existingItem = $checkStmt->fetch();
                    
                    if ($existingItem) {
                        $oldQtyReceived = (float)$existingItem['quantity_received'];
                        // The new received quantity tracks what was actually edited
                        $newQtyReceived = (float)$qtyOrdered;
                        // Net stock change: difference between new and old received quantity
                        $netChange = $newQtyReceived - $oldQtyReceived;
                        
                        // Update item: both quantity_ordered and quantity_received reflect the new value.
                        // original_quantity_received is already backed up above and never overwritten here.
                        DB::query(
                            'UPDATE purchase_order_items SET quantity_ordered = ?, quantity_received = ?, cost_price = ?, selling_price = ?, subtotal = ? WHERE id = ?',
                            [$qtyOrdered, $newQtyReceived, $costPrice, $sellingPrice > 0 ? $sellingPrice : $costPrice, $newQtyReceived * $costPrice, $existingItem['id']]
                        );
                        
                        // Apply net stock change directly to products.stock_quantity.
                        // We do NOT create an inventory_adjustments row here because the purchase row
                        // itself (with the updated quantity_received) IS the authoritative history entry.
                        // Creating a separate adjustment would cause the history walk to double-count.
                        if ($netChange != 0) {
                            DB::query(
                                'UPDATE products SET stock_quantity = GREATEST(stock_quantity + ?, 0), cost_price = ?, price = ? WHERE id = ? AND shop_id = ?',
                                [$netChange, $costPrice, $sellingPrice > 0 ? $sellingPrice : $costPrice, $productId, $shopId]
                            );
                        } else {
                            // Only price change, no stock movement
                            DB::query(
                                'UPDATE products SET cost_price = ?, price = ? WHERE id = ? AND shop_id = ?',
                                [$costPrice, $sellingPrice > 0 ? $sellingPrice : $costPrice, $productId, $shopId]
                            );
                        }
                        
                        $totalAmount += $newQtyReceived * $costPrice;
                    } else {
                        // New item added to an already-received PO
                        $subtotal = $qtyOrdered * $costPrice;
                        DB::query(
                            'INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity_ordered, quantity_received, original_quantity_received, cost_price, selling_price, subtotal, shop_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            [$poId, $productId, $qtyOrdered, $qtyOrdered, 0, $costPrice, $sellingPrice > 0 ? $sellingPrice : $costPrice, $subtotal, $shopId]
                        );
                        
                        // Add stock directly; original_quantity_received = 0 marks this as a post-receive addition
                        DB::query(
                            'UPDATE products SET stock_quantity = stock_quantity + ?, cost_price = ?, price = ? WHERE id = ? AND shop_id = ?',
                            [$qtyOrdered, $costPrice, $sellingPrice > 0 ? $sellingPrice : $costPrice, $productId, $shopId]
                        );
                        
                        $totalAmount += $subtotal;
                    }
                }
                
                // Remove items no longer in PO — reverse their stock contribution
                $newProductIds = array_map(function($item) { return (int)$item['product_id']; }, $items);
                if (!empty($newProductIds)) {
                    $placeholders = str_repeat('?,', count($newProductIds) - 1) . '?';
                    $removeStmt = DB::query(
                        'SELECT id, product_id, quantity_received FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ? AND product_id NOT IN (' . $placeholders . ')',
                        array_merge([$poId, $shopId], $newProductIds)
                    );
                    $removedItems = $removeStmt->fetchAll();
                    
                    foreach ($removedItems as $removedItem) {
                        $removedProductId = (int)$removedItem['product_id'];
                        $removedQty = (float)$removedItem['quantity_received'];
                        
                        // Reverse the stock that was added when this item was originally received.
                        // Set quantity_received = 0 so the history row shows zero contribution
                        // rather than disappearing (keeping the row preserves the audit trail).
                        DB::query(
                            'UPDATE purchase_order_items SET quantity_received = 0, quantity_ordered = 0, subtotal = 0 WHERE id = ?',
                            [$removedItem['id']]
                        );
                        DB::query(
                            'UPDATE products SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ? AND shop_id = ?',
                            [$removedQty, $removedProductId, $shopId]
                        );
                    }
                }
            } else {
                // For ordered POs, use the original delete and re-insert logic
                DB::query('DELETE FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?', [$poId, $shopId]);
                $totalAmount = self::processAndInsertPoItems($poId, $shopId, $supplierId, $items, $poStatus);
            }

            if ($paymentBasis === 'credit') {
                if ($requestedPaidAmount < 0) {
                    $requestedPaidAmount = 0.00;
                }
                $paidAmount = min($requestedPaidAmount, $totalAmount);
                $dueAmount = $totalAmount - $paidAmount;
            } else {
                $paidAmount = $totalAmount;
                $dueAmount = 0.00;
            }


            // Update main PO total and supplier_id if changed
            DB::query(
                'UPDATE purchase_orders SET order_date = ?, received_date = ?, total_amount = ?, paid_amount = ?, due_amount = ?, payment_basis = ?, notes = ?, supplier_id = ?
                 WHERE id = ? AND shop_id = ?',
                [$orderDate, $receivedDate, $totalAmount, $paidAmount, $dueAmount, $paymentBasis, $notes, $supplierId, $poId, $shopId]
            );

            // If supplier changed, update all products in the PO to the new supplier
            if ($supplierChanged) {
                foreach ($items as $item) {
                    $productId = (int)$item['product_id'];
                    DB::query(
                        'UPDATE products SET supplier_id = ? WHERE id = ? AND shop_id = ?',
                        [$supplierId, $productId, $shopId]
                    );
                }
            }

            // Re-apply supplier due balance
            if (($poStatus === 'ordered' || $poStatus === 'received') && $paymentBasis === 'credit' && $dueAmount > 0) {
                // If supplier changed, remove due amount from old supplier
                if ($supplierChanged) {
                    DB::query(
                        'UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                        [$dueAmount, $oldSupplierId, $shopId]
                    );
                }
                // Add due amount to new supplier
                DB::query(
                    'UPDATE suppliers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?',
                    [$dueAmount, $supplierId, $shopId]
                );
            }

            if ($poStatus === 'received') {
                $columnCheck = DB::query("SHOW COLUMNS FROM suppliers LIKE 'total_spent'");
                if ($columnCheck->fetch() !== false) {
                    // Update total_spent for new supplier
                    DB::query(
                        'UPDATE suppliers s SET total_spent = (
                             SELECT COALESCE(SUM(stock_quantity * cost_price), 0)
                             FROM products
                             WHERE supplier_id = s.id AND shop_id = s.shop_id
                         ) WHERE id = ? AND shop_id = ?',
                        [$supplierId, $shopId]
                    );
                    // If supplier changed, also update total_spent for old supplier
                    if ($supplierChanged) {
                        DB::query(
                            'UPDATE suppliers s SET total_spent = (
                                 SELECT COALESCE(SUM(stock_quantity * cost_price), 0)
                                 FROM products
                                 WHERE supplier_id = s.id AND shop_id = s.shop_id
                             ) WHERE id = ? AND shop_id = ?',
                            [$oldSupplierId, $shopId]
                        );
                    }
                }
            }

            DB::commit();

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Purchase Order updated successfully.']);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Update PO error: ' . $e->getMessage());
            Auth::jsonError('Server error updating Purchase Order.', 500);
        }
    }

    public static function updatePurchaseOrderStatus($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $poId = (int)$id;
        $shopId = Auth::$shopId;
        $status = $requestData['status'] ?? null;
        $items = $requestData['items'] ?? null;
        $notes = $requestData['notes'] ?? null;

        if (empty($status)) {
            Auth::jsonError('Status is required.', 400);
        }

        try {
            DB::beginTransaction();

            $stmt = DB::query('SELECT * FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);
            $po = $stmt->fetch();

            if (!$po) {
                DB::rollBack();
                Auth::jsonError('Purchase Order not found.', 404);
            }

            if ($po['status'] === 'received') {
                DB::rollBack();
                Auth::jsonError('Purchase Order has already been received.', 400);
            }
            if ($po['status'] === 'cancelled') {
                DB::rollBack();
                Auth::jsonError('Purchase Order has already been cancelled.', 400);
            }

            if ($status === 'cancelled') {
                DB::query(
                    'UPDATE purchase_orders SET status = ?, notes = COALESCE(?, notes) WHERE id = ? AND shop_id = ?',
                    ['cancelled', $notes, $poId, $shopId]
                );
                
                if ($po['payment_basis'] === 'credit' && (float)$po['due_amount'] > 0 && ($po['status'] === 'ordered' || $po['status'] === 'received')) {
                    DB::query(
                        'UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                        [(float)$po['due_amount'], $po['supplier_id'], $shopId]
                    );
                }

                DB::commit();
                header('Content-Type: application/json');
                echo json_encode(['message' => 'Purchase Order cancelled.']);
                exit;
            }

            if ($status === 'ordered') {
                DB::query(
                    'UPDATE purchase_orders SET status = ?, notes = COALESCE(?, notes) WHERE id = ? AND shop_id = ?',
                    ['ordered', $notes, $poId, $shopId]
                );

                if ($po['status'] === 'draft' && $po['payment_basis'] === 'credit' && (float)$po['due_amount'] > 0) {
                    DB::query(
                        'UPDATE suppliers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?',
                        [(float)$po['due_amount'], $po['supplier_id'], $shopId]
                    );
                }

                DB::commit();
                header('Content-Type: application/json');
                echo json_encode(['message' => 'Purchase Order status set to Ordered.']);
                exit;
            }

            if ($status === 'received') {
                // If items not provided, auto-receive all items with ordered quantities
                if (empty($items) || !is_array($items)) {
                    $itemsStmt = DB::query(
                        'SELECT poi.product_id, poi.quantity_ordered, poi.cost_price, poi.selling_price 
                         FROM purchase_order_items poi 
                         WHERE poi.purchase_order_id = ? AND poi.shop_id = ?',
                        [$poId, $shopId]
                    );
                    $poItems = $itemsStmt->fetchAll();

                    $items = [];
                    foreach ($poItems as $poItem) {
                        $items[] = [
                            'product_id' => (int)$poItem['product_id'],
                            'quantity_received' => (int)$poItem['quantity_ordered'],
                            'cost_price' => (float)$poItem['cost_price'],
                            'selling_price' => (float)$poItem['selling_price'],
                            'expiry_date' => null
                        ];
                    }
                }

                foreach ($items as $item) {
                    $originalProductId = (int)$item['product_id'];
                    $qtyReceived = (int)$item['quantity_received'];
                    $costPrice = (float)$item['cost_price'];
                    $sellingPrice = isset($item['selling_price']) ? (float)$item['selling_price'] : 0.00;
                    $expiryDate = !empty($item['expiry_date']) ? $item['expiry_date'] : null;

                    // Fetch base product info
                    $baseProdStmt = DB::query('SELECT * FROM products WHERE id = ? AND shop_id = ?', [$originalProductId, $shopId]);
                    $baseProd = $baseProdStmt->fetch();

                    if (!$baseProd) {
                        continue;
                    }

                    $targetProductId = $originalProductId;

                    // Update PO Item quantity received & target product ID
                    DB::query(
                        'UPDATE purchase_order_items 
                         SET product_id = ?, quantity_received = ?, cost_price = ?, selling_price = ?, expiry_date = ?
                         WHERE purchase_order_id = ? AND (product_id = ? OR product_id = ?) AND shop_id = ?',
                        [$targetProductId, $qtyReceived, $costPrice, $sellingPrice, $expiryDate, $poId, $originalProductId, $targetProductId, $shopId]
                    );

                    // Get PO item ID for batch tracking
                    $poiStmt = DB::query(
                        'SELECT id FROM purchase_order_items WHERE purchase_order_id = ? AND product_id = ? AND shop_id = ?',
                        [$poId, $targetProductId, $shopId]
                    );
                    $poi = $poiStmt->fetch();

                    // Create inventory batch for this purchase
                    $batchNumber = 'BATCH-' . strtoupper(uniqid());
                    try {
                        DB::query(
                            'INSERT INTO inventory_batches (shop_id, product_id, purchase_order_item_id, batch_number, quantity, cost_price, expiry_date, received_date)
                             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
                            [$shopId, $targetProductId, $poi ? $poi['id'] : null, $batchNumber, $qtyReceived, $costPrice, $expiryDate]
                        );
                    } catch (\Exception $e) { /* inventory_batches may not exist */ }

                    $oldCost = (float)$baseProd['cost_price'];
                    
                    // Log price change
                    DB::query(
                        'INSERT INTO cost_price_logs (shop_id, product_id, supplier_id, old_cost_price, new_cost_price, reason)
                         VALUES (?, ?, ?, ?, ?, ?)',
                        [$shopId, $targetProductId, $po['supplier_id'], $oldCost, $costPrice, "PO Received #$poId"]
                    );

                    // Update target product stock and prices (and expiry date if provided)
                    $effectiveSellingPrice = ($sellingPrice > 0) ? $sellingPrice : (float)$baseProd['price'];
                    $updateExpirySql = !empty($expiryDate) ? ', expiry_date = ?' : '';
                    $updateParams = [$qtyReceived, $costPrice, $effectiveSellingPrice];
                    if (!empty($expiryDate)) {
                        $updateParams[] = $expiryDate;
                    }
                    $updateParams[] = $targetProductId;
                    $updateParams[] = $shopId;

                    DB::query(
                        "UPDATE products 
                         SET stock_quantity = stock_quantity + ?, cost_price = ?, price = ? $updateExpirySql
                         WHERE id = ? AND shop_id = ?",
                        $updateParams
                    );
                }

                // Recalculate PO totals after items have been updated
                $oldDueAmount = (float)$po['due_amount'];
                
                DB::query(
                    'UPDATE purchase_orders po
                     SET po.total_amount = (
                         SELECT COALESCE(SUM(poi.quantity_received * poi.cost_price), 0)
                         FROM purchase_order_items poi
                         WHERE poi.purchase_order_id = po.id AND poi.shop_id = po.shop_id
                     )
                     WHERE po.id = ? AND po.shop_id = ?',
                    [$poId, $shopId]
                );

                // Update paid_amount (for cash) and due_amount
                DB::query(
                    'UPDATE purchase_orders
                     SET paid_amount = IF(payment_basis = "cash", total_amount, paid_amount),
                         due_amount = GREATEST(total_amount - IF(payment_basis = "cash", total_amount, paid_amount), 0)
                     WHERE id = ? AND shop_id = ?',
                    [$poId, $shopId]
                );

                // Fetch the newly calculated PO
                $stmt = DB::query('SELECT total_amount, due_amount FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);
                $newPo = $stmt->fetch();
                $newTotalAmount = (float)$newPo['total_amount'];
                $newDueAmount = (float)$newPo['due_amount'];

                // Adjust supplier due_balance
                if ($po['payment_basis'] === 'credit') {
                    if ($po['status'] === 'ordered') {
                        // It was already ordered, so the old due amount is already in the balance. We just adjust the difference.
                        $diff = $newDueAmount - $oldDueAmount;
                        if ($diff != 0) {
                            DB::query(
                                'UPDATE suppliers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?',
                                [$diff, $po['supplier_id'], $shopId]
                            );
                        }
                    } else if ($po['status'] === 'draft') {
                        // Drafts aren't in due_balance yet. Add the whole new due_amount.
                        if ($newDueAmount > 0) {
                            DB::query(
                                'UPDATE suppliers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?',
                                [$newDueAmount, $po['supplier_id'], $shopId]
                            );
                        }
                    }
                }

                // Update supplier total_spent to reflect new inventory value
                $columnCheck = DB::query("SHOW COLUMNS FROM suppliers LIKE 'total_spent'");
                if ($columnCheck->fetch() !== false) {
                    DB::query(
                        'UPDATE suppliers s SET total_spent = (
                             SELECT COALESCE(SUM(stock_quantity * cost_price), 0)
                             FROM products
                             WHERE supplier_id = s.id AND shop_id = s.shop_id
                         ) WHERE id = ? AND shop_id = ?',
                        [$po['supplier_id'], $shopId]
                    );
                }

                DB::query(
                    "UPDATE purchase_orders 
                     SET status = 'received', received_date = CURRENT_TIMESTAMP, notes = COALESCE(?, notes)
                     WHERE id = ? AND shop_id = ?",
                    [$notes, $poId, $shopId]
                );

                DB::commit();
                header('Content-Type: application/json');
                echo json_encode(['message' => 'Purchase Order items successfully received, inventory and cost prices updated!']);
                exit;
            }

            DB::rollBack();
            Auth::jsonError('Invalid status transition requested.', 400);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Receive PO error: ' . $e->getMessage());
            Auth::jsonError('Server error processing PO receiving.', 500);
        }
    }

    public static function deletePurchaseOrder($id) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $poId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            DB::beginTransaction();

            $stmt = DB::query(
                'SELECT status, supplier_id, payment_basis, due_amount, total_amount FROM purchase_orders WHERE id = ? AND shop_id = ?',
                [$poId, $shopId]
            );
            $po = $stmt->fetch();

            if (!$po) {
                DB::rollBack();
                Auth::jsonError('Purchase Order not found.', 404);
            }

            $poStatus = $po['status'];

            // Revert product stocks if received
            if ($poStatus === 'received') {
                $stmt = DB::query(
                    'SELECT product_id, quantity_received FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?',
                    [$poId, $shopId]
                );
                $items = $stmt->fetchAll();

                foreach ($items as $item) {
                    if ((int)$item['quantity_received'] > 0) {
                        DB::query(
                            'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND shop_id = ?',
                            [(int)$item['quantity_received'], (int)$item['product_id'], $shopId]
                        );
                    }
                }
            }

            // Revert supplier balance
            if (($poStatus === 'ordered' || $poStatus === 'received') && $po['payment_basis'] === 'credit' && (float)$po['due_amount'] > 0) {
                DB::query(
                    'UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                    [(float)$po['due_amount'], $po['supplier_id'], $shopId]
                );
            }

            // Revert supplier total_spent if PO was received (if column exists)
            if ($poStatus === 'received') {
                $columnCheck = DB::query("SHOW COLUMNS FROM suppliers LIKE 'total_spent'");
                if ($columnCheck->fetch() !== false) {
                    DB::query(
                        'UPDATE suppliers s SET total_spent = (
                             SELECT COALESCE(SUM(stock_quantity * cost_price), 0)
                             FROM products
                             WHERE supplier_id = s.id AND shop_id = s.shop_id
                         ) WHERE id = ? AND shop_id = ?',
                        [$po['supplier_id'], $shopId]
                    );
                }

                // Revert cost price and delete cost price logs associated with this PO
                $logStmt = DB::query(
                    'SELECT product_id, old_cost_price FROM cost_price_logs WHERE shop_id = ? AND reason = ?',
                    [$shopId, "PO Received #$poId"]
                );
                $logs = $logStmt->fetchAll();

                foreach ($logs as $log) {
                    DB::query(
                        'UPDATE products SET cost_price = ? WHERE id = ? AND shop_id = ?',
                        [(float)$log['old_cost_price'], (int)$log['product_id'], $shopId]
                    );
                }

                DB::query(
                    'DELETE FROM cost_price_logs WHERE shop_id = ? AND reason = ?',
                    [$shopId, "PO Received #$poId"]
                );
            }

            DB::query('DELETE FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);

            DB::commit();
            header('Content-Type: application/json');
            echo json_encode(['message' => 'Purchase Order deleted successfully.']);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Delete PO error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting Purchase Order.', 500);
        }
    }

    public static function bulkDeletePurchaseOrders($requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'super_admin']);

        $shopId = Auth::$shopId;
        $ids = $requestData['ids'] ?? $requestData['po_ids'] ?? [];

        if (!is_array($ids) || empty($ids)) {
            Auth::jsonError('No purchase orders selected for deletion.', 400);
        }

        // Validate IDs are integers
        $ids = array_map('intval', $ids);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        try {
            DB::beginTransaction();

            // Fetch all POs to be deleted
            $sql = "SELECT id, status, supplier_id, payment_basis, due_amount FROM purchase_orders WHERE shop_id = ? AND id IN ($placeholders)";
            $params = array_merge([$shopId], $ids);
            $stmt = DB::query($sql, $params);
            $pos = $stmt->fetchAll();

            if (empty($pos)) {
                DB::rollBack();
                Auth::jsonError('No valid purchase orders found.', 404);
            }

            foreach ($pos as $po) {
                $poId = (int)$po['id'];
                $poStatus = $po['status'];

                // Revert product stocks if received
                if ($poStatus === 'received') {
                    $stmt = DB::query(
                        'SELECT product_id, quantity_received FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?',
                        [$poId, $shopId]
                    );
                    $items = $stmt->fetchAll();

                    foreach ($items as $item) {
                        if ((int)$item['quantity_received'] > 0) {
                            DB::query(
                                'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND shop_id = ?',
                                [(int)$item['quantity_received'], (int)$item['product_id'], $shopId]
                            );
                        }
                    }
                }

                // Revert supplier balance
                if (($poStatus === 'ordered' || $poStatus === 'received') && $po['payment_basis'] === 'credit' && (float)$po['due_amount'] > 0) {
                    DB::query(
                        'UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                        [(float)$po['due_amount'], (int)$po['supplier_id'], $shopId]
                    );
                }

                // Revert supplier total_spent if PO was received (if column exists)
                if ($poStatus === 'received') {
                    $columnCheck = DB::query("SHOW COLUMNS FROM suppliers LIKE 'total_spent'");
                    if ($columnCheck->fetch() !== false) {
                        DB::query(
                            'UPDATE suppliers s SET total_spent = (
                                 SELECT COALESCE(SUM(stock_quantity * cost_price), 0)
                                 FROM products
                                 WHERE supplier_id = s.id AND shop_id = s.shop_id
                             ) WHERE id = ? AND shop_id = ?',
                            [(int)$po['supplier_id'], $shopId]
                        );
                    }

                    // Revert cost price and delete cost price logs associated with this PO
                    $logStmt = DB::query(
                        'SELECT product_id, old_cost_price FROM cost_price_logs WHERE shop_id = ? AND reason = ?',
                        [$shopId, "PO Received #$poId"]
                    );
                    $logs = $logStmt->fetchAll();

                    foreach ($logs as $log) {
                        DB::query(
                            'UPDATE products SET cost_price = ? WHERE id = ? AND shop_id = ?',
                            [(float)$log['old_cost_price'], (int)$log['product_id'], $shopId]
                        );
                    }

                    DB::query(
                        'DELETE FROM cost_price_logs WHERE shop_id = ? AND reason = ?',
                        [$shopId, "PO Received #$poId"]
                    );
                }
            }

            // Delete all POs
            $sqlDelete = "DELETE FROM purchase_orders WHERE shop_id = ? AND id IN ($placeholders)";
            DB::query($sqlDelete, $params);

            DB::commit();
            header('Content-Type: application/json');
            echo json_encode(['message' => count($pos) . ' purchase orders deleted successfully.']);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Bulk delete purchase orders error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting purchase orders.', 500);
        }
    }

    public static function deletePurchaseOrderItem($id, $productId) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $poId = (int)$id;
        $productId = (int)$productId;
        $shopId = Auth::$shopId;

        try {
            DB::beginTransaction();

            $stmt = DB::query('SELECT status FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);
            $po = $stmt->fetch();

            if (!$po) {
                DB::rollBack();
                Auth::jsonError('Purchase Order not found.', 404);
            }

            $status = $po['status'];
            if ($status === 'received' || $status === 'cancelled') {
                DB::rollBack();
                Auth::jsonError("Cannot delete items from a $status Purchase Order.", 400);
            }

            // Check existence in items
            $stmt = DB::query(
                'SELECT id FROM purchase_order_items WHERE purchase_order_id = ? AND product_id = ? AND shop_id = ?',
                [$poId, $productId, $shopId]
            );
            if (!$stmt->fetch()) {
                DB::rollBack();
                Auth::jsonError('Product not found in this Purchase Order.', 404);
            }

            // Check count of items
            $stmt = DB::query(
                'SELECT COUNT(*) AS cnt FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?',
                [$poId, $shopId]
            );
            if ($stmt->fetchColumn() <= 1) {
                DB::rollBack();
                Auth::jsonError('Cannot delete the last product from a Purchase Order. Delete the Purchase Order instead.', 400);
            }

            DB::query(
                'DELETE FROM purchase_order_items WHERE purchase_order_id = ? AND product_id = ? AND shop_id = ?',
                [$poId, $productId, $shopId]
            );

            // Recompute PO total
            $stmt = DB::query(
                'SELECT SUM(quantity_ordered * cost_price) AS total FROM purchase_order_items WHERE purchase_order_id = ? AND shop_id = ?',
                [$poId, $shopId]
            );
            $newTotal = (float)($stmt->fetchColumn() ?: 0.00);

            // Fetch current PO info
            $poStmt = DB::query('SELECT status, payment_basis, paid_amount, due_amount, supplier_id FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);
            $poInfo = $poStmt->fetch();
            
            $poStatus = $poInfo['status'];
            $paymentBasis = $poInfo['payment_basis'];
            $oldPaid = (float)$poInfo['paid_amount'];
            $oldDue = (float)$poInfo['due_amount'];
            $supplierId = (int)$poInfo['supplier_id'];

            if ($paymentBasis === 'credit') {
                $newPaid = min($oldPaid, $newTotal);
                $newDue = $newTotal - $newPaid;
            } else {
                $newPaid = $newTotal;
                $newDue = 0.00;
            }

            DB::query(
                'UPDATE purchase_orders SET total_amount = ?, paid_amount = ?, due_amount = ? WHERE id = ? AND shop_id = ?',
                [$newTotal, $newPaid, $newDue, $poId, $shopId]
            );

            // Adjust supplier due balance if the PO status is ordered or received
            if (in_array($poStatus, ['ordered', 'received']) && $paymentBasis === 'credit') {
                $dueDifference = $oldDue - $newDue;
                if ($dueDifference != 0.00) {
                    DB::query(
                        'UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                        [$dueDifference, $supplierId, $shopId]
                    );
                }
            }

            DB::commit();

            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Product successfully removed from Purchase Order.',
                'newTotal' => (float)$newTotal
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Delete PO item error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting Purchase Order item.', 500);
        }
    }

    public static function getSupplierProfile($id) {
        Auth::authenticate();
        Auth::enforceTenant();

        $supplierId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            // Check if total_spent column exists
            $columnCheck = DB::query("SHOW COLUMNS FROM suppliers LIKE 'total_spent'");
            $hasTotalSpent = $columnCheck->fetch() !== false;

            // Supplier main profile - backward compatible query
            if ($hasTotalSpent) {
                $stmt = DB::query(
                    'SELECT id, name, contact_name, email, phone, due_balance, total_spent, created_at FROM suppliers WHERE id = ? AND shop_id = ?',
                    [$supplierId, $shopId]
                );
            } else {
                $stmt = DB::query(
                    'SELECT id, name, contact_name, email, phone, due_balance, created_at FROM suppliers WHERE id = ? AND shop_id = ?',
                    [$supplierId, $shopId]
                );
            }
            $supplier = $stmt->fetch();

            if (!$supplier) {
                Auth::jsonError('Supplier profile not found.', 404);
            }

            $supplier['id'] = (int)$supplier['id'];
            $supplier['due_balance'] = isset($supplier['due_balance']) ? (float)$supplier['due_balance'] : 0.00;

            // Check if total_spent column exists
            $columnCheck = DB::query("SHOW COLUMNS FROM suppliers LIKE 'total_spent'");
            $hasTotalSpentColumn = $columnCheck->fetch() !== false;

            if ($hasTotalSpentColumn) {
                $supplier['total_spent'] = isset($supplier['total_spent']) ? (float)$supplier['total_spent'] : 0.00;
            } else {
                $supplier['total_spent'] = 0.00; // Will be calculated from POs below
            }

            // Purchase orders list
            $stmt = DB::query(
                'SELECT id, status, total_amount, paid_amount, due_amount, payment_basis, order_date, received_date 
                 FROM purchase_orders 
                 WHERE supplier_id = ? AND shop_id = ? 
                 ORDER BY created_at DESC',
                [$supplierId, $shopId]
            );
            $pos = $stmt->fetchAll();

            // Total Spent = sum of paid_amount across all purchase orders for this supplier
            $totalSpent = 0.0;
            foreach ($pos as $po) {
                $totalSpent += (float)$po['paid_amount'];
            }
            $supplier['total_spent'] = $totalSpent;
            $poStats = [
                'received' => 0,
                'draft' => 0,
                'ordered' => 0,
                'cancelled' => 0
            ];

            foreach ($pos as &$po) {
                $po['id'] = (int)$po['id'];
                $po['total_amount'] = (float)$po['total_amount'];
                $po['paid_amount'] = (float)$po['paid_amount'];
                $po['due_amount'] = (float)$po['due_amount'];

                $status = $po['status'];
                if (isset($poStats[$status])) {
                    $poStats[$status]++;
                } else {
                    $poStats[$status] = 1;
                }
            }

            // Cost logs list
            $stmt = DB::query(
                'SELECT cpl.*, p.name AS product_name, p.sku AS product_sku 
                 FROM cost_price_logs cpl 
                 JOIN products p ON cpl.product_id = p.id 
                 WHERE cpl.supplier_id = ? AND cpl.shop_id = ? 
                 ORDER BY cpl.created_at DESC',
                [$supplierId, $shopId]
            );
            $costLogs = $stmt->fetchAll();
            foreach ($costLogs as &$log) {
                $log['id'] = (int)$log['id'];
                $log['shop_id'] = (int)$log['shop_id'];
                $log['product_id'] = (int)$log['product_id'];
                $log['supplier_id'] = (int)$log['supplier_id'];
                $log['old_cost_price'] = $log['old_cost_price'] !== null ? (float)$log['old_cost_price'] : null;
                $log['new_cost_price'] = (float)$log['new_cost_price'];
            }

            // Expired and Near-Expiry products list (within next 90 days, only in-stock items)
            $stmt = DB::query(
                'SELECT id, name, sku, category, unit, cost_price, price, expiry_date, stock_quantity,
                        DATEDIFF(expiry_date, CURRENT_DATE()) AS days_left
                 FROM products 
                 WHERE supplier_id = ? AND shop_id = ? AND stock_quantity > 0 AND expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 90 DAY)
                 ORDER BY expiry_date ASC',
                [$supplierId, $shopId]
            );
            $expiredProducts = $stmt->fetchAll();
            $expiredMetrics = [
                'totalExpiredCount' => 0,
                'totalExpiredValue' => 0.0,
                'totalNearExpiryCount' => 0,
                'totalNearExpiryValue' => 0.0
            ];

            foreach ($expiredProducts as &$ep) {
                $ep['id'] = (int)$ep['id'];
                $ep['stock_quantity'] = (int)$ep['stock_quantity'];
                $ep['cost_price'] = (float)($ep['cost_price'] ?? 0);
                $ep['price'] = (float)($ep['price'] ?? 0);
                $ep['days_left'] = (int)$ep['days_left'];
                $val = $ep['stock_quantity'] * $ep['cost_price'];

                if ($ep['days_left'] <= 0) {
                    if ($ep['stock_quantity'] > 0) {
                        $expiredMetrics['totalExpiredCount'] += $ep['stock_quantity'];
                        $expiredMetrics['totalExpiredValue'] += $val;
                    }
                } else if ($ep['days_left'] <= 30) {
                    if ($ep['stock_quantity'] > 0) {
                        $expiredMetrics['totalNearExpiryCount'] += $ep['stock_quantity'];
                        $expiredMetrics['totalNearExpiryValue'] += $val;
                    }
                }
            }

            // Return logs (Returns & replacements history with financial settlements & debit note details)
            $stmt = DB::query(
                'SELECT sr.*, p.name AS product_name, p.sku AS product_sku, p.category AS product_category, p.unit AS product_unit 
                 FROM supplier_returns sr 
                 JOIN products p ON sr.product_id = p.id 
                 WHERE sr.supplier_id = ? AND sr.shop_id = ? 
                 ORDER BY sr.created_at DESC',
                [$supplierId, $shopId]
            );
            $returns = $stmt->fetchAll();

            $totalReturnedValue = 0.0;
            $totalDueDeducted = 0.0;

            foreach ($returns as &$ret) {
                $ret['id'] = (int)$ret['id'];
                $ret['shop_id'] = (int)$ret['shop_id'];
                $ret['supplier_id'] = (int)$ret['supplier_id'];
                $ret['product_id'] = (int)$ret['product_id'];
                $ret['quantity'] = (int)$ret['quantity'];
                $ret['unit_cost'] = (float)($ret['unit_cost'] ?? 0);
                $ret['total_amount'] = (float)($ret['total_amount'] ?? ($ret['quantity'] * $ret['unit_cost']));
                $ret['refund_amount'] = (float)($ret['refund_amount'] ?? 0);
                $ret['reason'] = $ret['reason'] ?? 'Expired';
                $ret['settlement_type'] = $ret['settlement_type'] ?? 'none';
                $ret['reference_no'] = $ret['reference_no'] ?? ('SR-' . str_pad($ret['id'], 5, '0', STR_PAD_LEFT));
                $ret['status'] = $ret['status'] ?? 'completed';

                if ($ret['action_type'] === 'return') {
                    $totalReturnedValue += $ret['total_amount'];
                }
                if ($ret['settlement_type'] === 'deduct_due') {
                    $totalDueDeducted += $ret['refund_amount'];
                }
            }

            $expiredMetrics['totalReturnedValue'] = $totalReturnedValue;
            $expiredMetrics['totalDueDeducted'] = $totalDueDeducted;

            $response = [
                'supplier' => $supplier,
                'stats' => [
                    'totalSpent' => $totalSpent,
                    'poStats' => $poStats
                ],
                'expiredMetrics' => $expiredMetrics,
                'purchaseOrders' => $pos,
                'costLogs' => $costLogs,
                'expiredProducts' => $expiredProducts,
                'returnsHistory' => $returns
            ];

            header('Content-Type: application/json');
            echo json_encode($response);

        } catch (\Exception $e) {
            error_log('Get supplier profile error: ' . $e->getMessage());
            Auth::jsonError('Server error retrieving supplier details.', 500);
        }
    }

    public static function updateSupplier($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $supplierId = (int)$id;
        $shopId = Auth::$shopId;
        $name = $requestData['name'] ?? '';
        $contactName = $requestData['contact_name'] ?? null;
        $email = $requestData['email'] ?? null;
        $phone = $requestData['phone'] ?? null;

        if (empty($name)) {
            Auth::jsonError('Supplier name is required.', 400);
        }

        try {
            $stmt = DB::query('SELECT id FROM suppliers WHERE id = ? AND shop_id = ?', [$supplierId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Supplier not found or access denied.', 404);
            }

            DB::query(
                'UPDATE suppliers SET name = ?, contact_name = ?, email = ?, phone = ? WHERE id = ? AND shop_id = ?',
                [$name, $contactName, $email, $phone, $supplierId, $shopId]
            );

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Supplier details updated.']);

        } catch (\Exception $e) {
            error_log('Update supplier error: ' . $e->getMessage());
            Auth::jsonError('Server error updating supplier profile.', 500);
        }
    }

    public static function deleteSupplier($id) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $supplierId = (int)$id;
        $shopId = Auth::$shopId;

        try {
            $stmt = DB::query('SELECT id FROM suppliers WHERE id = ? AND shop_id = ?', [$supplierId, $shopId]);
            if (!$stmt->fetch()) {
                Auth::jsonError('Supplier not found or access denied.', 404);
            }

            DB::query('DELETE FROM suppliers WHERE id = ? AND shop_id = ?', [$supplierId, $shopId]);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Supplier profile deleted successfully.']);

        } catch (\PDOException $e) {
            error_log('Delete supplier DB error: ' . $e->getMessage());
            if ($e->getCode() == 23000 || strpos($e->getMessage(), 'a foreign key constraint fails') !== false) {
                Auth::jsonError('Cannot delete supplier. Supplier is referenced in existing purchase orders.', 400);
            }
            Auth::jsonError('Server error deleting supplier.', 500);
        } catch (\Exception $e) {
            error_log('Delete supplier error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting supplier.', 500);
        }
    }

    public static function bulkDeleteSuppliers($requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $shopId = Auth::$shopId;
        $ids = $requestData['ids'] ?? [];

        if (!is_array($ids) || empty($ids)) {
            Auth::jsonError('No suppliers selected for deletion.', 400);
        }

        // Validate IDs are integers
        $ids = array_map('intval', $ids);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));

        try {
            // Check if any of the selected suppliers have existing purchase orders
            $sqlCheck = "SELECT COUNT(*) FROM purchase_orders WHERE shop_id = ? AND supplier_id IN ($placeholders)";
            $params = array_merge([$shopId], $ids);
            $stmt = DB::query($sqlCheck, $params);
            if ($stmt->fetchColumn() > 0) {
                Auth::jsonError('Cannot delete one or more suppliers because they are referenced in existing purchase orders.', 400);
            }

            // Perform bulk delete
            $sqlDelete = "DELETE FROM suppliers WHERE shop_id = ? AND id IN ($placeholders)";
            DB::query($sqlDelete, $params);

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Selected suppliers deleted successfully.']);

        } catch (\PDOException $e) {
            error_log('Bulk delete suppliers DB error: ' . $e->getMessage());
            if ($e->getCode() == 23000 || strpos($e->getMessage(), 'a foreign key constraint fails') !== false) {
                Auth::jsonError('Cannot delete one or more suppliers. They are referenced in other records.', 400);
            }
            Auth::jsonError('Server error deleting suppliers.', 500);
        } catch (\Exception $e) {
            error_log('Bulk delete suppliers error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting suppliers.', 500);
        }
    }

    public static function payPurchaseOrder($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $poId = (int)$id;
        $shopId = Auth::$shopId;
        $amount = isset($requestData['amount']) ? (float)$requestData['amount'] : 0;

        if ($amount <= 0) {
            Auth::jsonError('Please provide a valid payment amount (must be greater than 0).', 400);
        }

        try {
            DB::beginTransaction();

            $stmt = DB::query('SELECT * FROM purchase_orders WHERE id = ? AND shop_id = ?', [$poId, $shopId]);
            $po = $stmt->fetch();

            if (!$po) {
                DB::rollBack();
                Auth::jsonError('Purchase Order not found.', 404);
            }

            $currentDue = (float)$po['due_amount'];

            if ($currentDue <= 0) {
                DB::rollBack();
                Auth::jsonError('This Purchase Order has no outstanding due balance.', 400);
            }

            $paymentAmount = min($amount, $currentDue);
            $newDue = $currentDue - $paymentAmount;
            $newPaid = (float)$po['paid_amount'] + $paymentAmount;

            // Update PO amounts
            DB::query(
                'UPDATE purchase_orders SET paid_amount = ?, due_amount = ? WHERE id = ? AND shop_id = ?',
                [$newPaid, $newDue, $poId, $shopId]
            );

            // Revert supplier balance if the PO was in credit
            if ($po['payment_basis'] === 'credit') {
                DB::query(
                    'UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                    [$paymentAmount, $po['supplier_id'], $shopId]
                );
            }

            DB::commit();

            header('Content-Type: application/json');
            echo json_encode([
                'message' => 'Payment registered successfully.',
                'paid_amount' => $paymentAmount,
                'due_remaining' => $newDue
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Pay PO error: ' . $e->getMessage());
            Auth::jsonError('Server error recording PO payment.', 500);
        }
    }

    public static function createSupplierReturn($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $supplierId = (int)$id;
        $shopId = Auth::$shopId;
        $productId = $requestData['product_id'] ?? null;
        $quantity = (int)($requestData['quantity'] ?? 0);
        $actionType = $requestData['action_type'] ?? 'return'; // return / replace
        $unitCost = isset($requestData['unit_cost']) ? (float)$requestData['unit_cost'] : null;
        $reason = $requestData['reason'] ?? 'Expired';
        $settlementType = $requestData['settlement_type'] ?? 'none'; // deduct_due, cash_refund, credit_note, replacement, none
        $refundAmount = isset($requestData['refund_amount']) ? (float)$requestData['refund_amount'] : 0.00;
        $referenceNo = !empty($requestData['reference_no']) ? trim($requestData['reference_no']) : null;
        $notes = $requestData['notes'] ?? null;
        $newExpiryDate = $requestData['new_expiry_date'] ?? null;
        $status = $requestData['status'] ?? 'completed';

        if (empty($productId) || $quantity <= 0) {
            Auth::jsonError('Product selection and valid quantity are required.', 400);
        }

        try {
            DB::beginTransaction();

            // Verify product belongs to shop
            $stmt = DB::query('SELECT stock_quantity, cost_price FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
            $prod = $stmt->fetch();

            if (!$prod) {
                DB::rollBack();
                Auth::jsonError('Product not found in this shop.', 404);
            }

            if ($unitCost === null) {
                $unitCost = (float)($prod['cost_price'] ?? 0);
            }

            $totalAmount = $quantity * $unitCost;

            if ($actionType === 'return' && (int)$prod['stock_quantity'] < $quantity) {
                DB::rollBack();
                Auth::jsonError('Insufficient stock quantity to perform this return. (Available: ' . (int)$prod['stock_quantity'] . ')', 400);
            }

            if (empty($referenceNo)) {
                $referenceNo = 'SR-' . date('ymd') . '-' . strtoupper(substr(uniqid(), -4));
            }

            // Record return log
            DB::query(
                'INSERT INTO supplier_returns (shop_id, supplier_id, product_id, quantity, action_type, unit_cost, total_amount, reason, settlement_type, refund_amount, reference_no, status, notes, new_expiry_date) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $shopId,
                    $supplierId,
                    $productId,
                    $quantity,
                    $actionType,
                    $unitCost,
                    $totalAmount,
                    $reason,
                    $settlementType,
                    $refundAmount,
                    $referenceNo,
                    $status,
                    $notes,
                    !empty($newExpiryDate) ? $newExpiryDate : null
                ]
            );
            $logId = DB::lastInsertId();

            if ($actionType === 'return') {
                // Deduct stock (ensure non-negative)
                DB::query(
                    'UPDATE products SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ? AND shop_id = ?',
                    [$quantity, $productId, $shopId]
                );

                // Deduct from inventory batches (prioritizing expired batches)
                try {
                    $batchStmt = DB::query(
                        'SELECT id, quantity, expiry_date FROM inventory_batches 
                         WHERE product_id = ? AND shop_id = ? AND quantity > 0
                         ORDER BY 
                            CASE WHEN expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE() THEN 0 
                                 WHEN expiry_date IS NOT NULL THEN 1 ELSE 2 END ASC,
                            expiry_date ASC, id ASC',
                        [$productId, $shopId]
                    );
                    $batches = $batchStmt->fetchAll();
                    $remQty = $quantity;
                    foreach ($batches as $b) {
                        if ($remQty <= 0) break;
                        $bQty = (int)$b['quantity'];
                        if ($bQty <= $remQty) {
                            DB::query('UPDATE inventory_batches SET quantity = 0, status = "returned" WHERE id = ?', [$b['id']]);
                            $remQty -= $bQty;
                        } else {
                            DB::query('UPDATE inventory_batches SET quantity = quantity - ? WHERE id = ?', [$remQty, $b['id']]);
                            $remQty = 0;
                        }
                    }
                } catch (\Exception $ex) {
                    // Batch table may not exist
                }

                // Financial settlement: if deduct_due selected, reduce supplier's outstanding due balance
                if ($settlementType === 'deduct_due' && $refundAmount > 0) {
                    DB::query(
                        'UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                        [$refundAmount, $supplierId, $shopId]
                    );
                }
            } else if ($actionType === 'replace' && !empty($newExpiryDate)) {
                // Update expiry date on replace
                DB::query(
                    'UPDATE products SET expiry_date = ? WHERE id = ? AND shop_id = ?',
                    [$newExpiryDate, $productId, $shopId]
                );
            }

            DB::commit();

            header('Content-Type: application/json');
            http_response_code(201);
            echo json_encode([
                'message' => 'Supplier return/replacement action recorded successfully.',
                'log_id' => (int)$logId,
                'reference_no' => $referenceNo,
                'total_amount' => $totalAmount
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Create supplier return error: ' . $e->getMessage());
            Auth::jsonError('Server error registering supplier return: ' . $e->getMessage(), 500);
        }
    }

    public static function bulkCreateSupplierReturns($id, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $supplierId = (int)$id;
        $shopId = Auth::$shopId;
        $items = $requestData['items'] ?? [];
        $actionType = $requestData['action_type'] ?? 'return';
        $settlementType = $requestData['settlement_type'] ?? 'none';
        $reason = $requestData['reason'] ?? 'Expired Batch Return';
        $sharedNotes = $requestData['notes'] ?? null;
        $sharedNewExpiry = $requestData['new_expiry_date'] ?? null;

        if (!is_array($items) || empty($items)) {
            Auth::jsonError('No items provided for bulk return.', 400);
        }

        try {
            DB::beginTransaction();

            $batchRef = 'SR-' . date('ymd') . '-B' . strtoupper(substr(uniqid(), -3));
            $totalProcessed = 0;
            $totalRefundDeducted = 0.0;

            foreach ($items as $item) {
                $productId = (int)($item['product_id'] ?? 0);
                $qty = (int)($item['quantity'] ?? 0);
                $itemAction = $item['action_type'] ?? $actionType;
                $itemReason = $item['reason'] ?? $reason;
                $itemNewExpiry = $item['new_expiry_date'] ?? $sharedNewExpiry;
                $itemNotes = $item['notes'] ?? $sharedNotes;

                if ($productId <= 0 || $qty <= 0) continue;

                $stmt = DB::query('SELECT stock_quantity, cost_price FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
                $prod = $stmt->fetch();
                if (!$prod) continue;

                if ($itemAction === 'return' && (int)$prod['stock_quantity'] < $qty) {
                    DB::rollBack();
                    Auth::jsonError("Insufficient stock for product ID {$productId} to complete bulk return.", 400);
                }

                $unitCost = isset($item['unit_cost']) ? (float)$item['unit_cost'] : (float)($prod['cost_price'] ?? 0);
                $totalAmt = $qty * $unitCost;
                $refundAmt = isset($item['refund_amount']) ? (float)$item['refund_amount'] : ($settlementType === 'deduct_due' ? $totalAmt : 0.00);

                DB::query(
                    'INSERT INTO supplier_returns (shop_id, supplier_id, product_id, quantity, action_type, unit_cost, total_amount, reason, settlement_type, refund_amount, reference_no, status, notes, new_expiry_date) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        $shopId,
                        $supplierId,
                        $productId,
                        $qty,
                        $itemAction,
                        $unitCost,
                        $totalAmt,
                        $itemReason,
                        $settlementType,
                        $refundAmt,
                        $batchRef,
                        'completed',
                        $itemNotes,
                        !empty($itemNewExpiry) ? $itemNewExpiry : null
                    ]
                );

                if ($itemAction === 'return') {
                    DB::query(
                        'UPDATE products SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE id = ? AND shop_id = ?',
                        [$qty, $productId, $shopId]
                    );

                    // Deduct from inventory batches
                    try {
                        $batchStmt = DB::query(
                            'SELECT id, quantity, expiry_date FROM inventory_batches 
                             WHERE product_id = ? AND shop_id = ? AND quantity > 0
                             ORDER BY 
                                CASE WHEN expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE() THEN 0 
                                     WHEN expiry_date IS NOT NULL THEN 1 ELSE 2 END ASC,
                                expiry_date ASC, id ASC',
                            [$productId, $shopId]
                        );
                        $batches = $batchStmt->fetchAll();
                        $remQty = $qty;
                        foreach ($batches as $b) {
                            if ($remQty <= 0) break;
                            $bQty = (int)$b['quantity'];
                            if ($bQty <= $remQty) {
                                DB::query('UPDATE inventory_batches SET quantity = 0, status = "returned" WHERE id = ?', [$b['id']]);
                                $remQty -= $bQty;
                            } else {
                                DB::query('UPDATE inventory_batches SET quantity = quantity - ? WHERE id = ?', [$remQty, $b['id']]);
                                $remQty = 0;
                            }
                        }
                    } catch (\Exception $ex) {
                        // Batch table may not exist
                    }

                    if ($settlementType === 'deduct_due' && $refundAmt > 0) {
                        $totalRefundDeducted += $refundAmt;
                    }
                } else if ($itemAction === 'replace' && !empty($itemNewExpiry)) {
                    DB::query(
                        'UPDATE products SET expiry_date = ? WHERE id = ? AND shop_id = ?',
                        [$itemNewExpiry, $productId, $shopId]
                    );
                }

                $totalProcessed++;
            }

            if ($settlementType === 'deduct_due' && $totalRefundDeducted > 0) {
                DB::query(
                    'UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?',
                    [$totalRefundDeducted, $supplierId, $shopId]
                );
            }

            DB::commit();

            header('Content-Type: application/json');
            echo json_encode([
                'message' => "Successfully processed bulk return for {$totalProcessed} items.",
                'reference_no' => $batchRef,
                'processed_count' => $totalProcessed,
                'total_due_deducted' => $totalRefundDeducted
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Bulk supplier return error: ' . $e->getMessage());
            Auth::jsonError('Server error processing bulk returns: ' . $e->getMessage(), 500);
        }
    }

    public static function updateSupplierReturn($logId, $requestData) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin', 'shop_staff']);

        $logId = (int)$logId;
        $shopId = Auth::$shopId;
        $quantity = (int)($requestData['quantity'] ?? 0);
        $unitCost = isset($requestData['unit_cost']) ? (float)$requestData['unit_cost'] : null;
        $reason = $requestData['reason'] ?? null;
        $settlementType = $requestData['settlement_type'] ?? null;
        $refundAmount = isset($requestData['refund_amount']) ? (float)$requestData['refund_amount'] : null;
        $notes = $requestData['notes'] ?? null;
        $newExpiryDate = $requestData['new_expiry_date'] ?? null;

        if ($quantity <= 0) {
            Auth::jsonError('Valid quantity is required.', 400);
        }

        try {
            DB::beginTransaction();

            $stmt = DB::query('SELECT * FROM supplier_returns WHERE id = ? AND shop_id = ?', [$logId, $shopId]);
            $log = $stmt->fetch();

            if (!$log) {
                DB::rollBack();
                Auth::jsonError('Return log entry not found.', 404);
            }

            $supplierId = (int)$log['supplier_id'];
            $productId = (int)$log['product_id'];
            $oldQty = (int)$log['quantity'];
            $oldUnitCost = (float)($log['unit_cost'] ?? 0);
            $newUnitCost = $unitCost !== null ? $unitCost : $oldUnitCost;
            $newTotalAmount = $quantity * $newUnitCost;
            $newReason = $reason !== null ? $reason : ($log['reason'] ?? 'Expired');
            $newSettlement = $settlementType !== null ? $settlementType : ($log['settlement_type'] ?? 'none');
            $oldRefundAmount = (float)($log['refund_amount'] ?? 0);
            $newRefundAmount = $refundAmount !== null ? $refundAmount : $oldRefundAmount;

            if ($log['action_type'] === 'return') {
                $pStmt = DB::query('SELECT stock_quantity FROM products WHERE id = ? AND shop_id = ?', [$productId, $shopId]);
                $prod = $pStmt->fetch();

                $netDifference = $quantity - $oldQty;

                if ($prod && (int)$prod['stock_quantity'] < $netDifference) {
                    DB::rollBack();
                    Auth::jsonError('Insufficient stock quantity to update this return.', 400);
                }

                // Adjust product stock
                DB::query(
                    'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND shop_id = ?',
                    [$netDifference, $productId, $shopId]
                );

                // Adjust due balance if settlement was deduct_due
                if ($log['settlement_type'] === 'deduct_due') {
                    // Revert old refund amount
                    DB::query('UPDATE suppliers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?', [$oldRefundAmount, $supplierId, $shopId]);
                }
                if ($newSettlement === 'deduct_due' && $newRefundAmount > 0) {
                    // Apply new refund amount
                    DB::query('UPDATE suppliers SET due_balance = GREATEST(due_balance - ?, 0) WHERE id = ? AND shop_id = ?', [$newRefundAmount, $supplierId, $shopId]);
                }
            }

            // Update log
            DB::query(
                'UPDATE supplier_returns 
                 SET quantity = ?, unit_cost = ?, total_amount = ?, reason = ?, settlement_type = ?, refund_amount = ?, notes = ?, new_expiry_date = ? 
                 WHERE id = ? AND shop_id = ?',
                [$quantity, $newUnitCost, $newTotalAmount, $newReason, $newSettlement, $newRefundAmount, $notes, !empty($newExpiryDate) ? $newExpiryDate : null, $logId, $shopId]
            );

            if ($log['action_type'] === 'replace' && !empty($newExpiryDate)) {
                DB::query(
                    'UPDATE products SET expiry_date = ? WHERE id = ? AND shop_id = ?',
                    [$newExpiryDate, $productId, $shopId]
                );
            }

            DB::commit();

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Supplier return action updated successfully.']);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Update supplier return error: ' . $e->getMessage());
            Auth::jsonError('Server error updating return action: ' . $e->getMessage(), 500);
        }
    }

    public static function deleteSupplierReturn($logId) {
        Auth::authenticate();
        Auth::enforceTenant();
        Auth::authorize(['shop_admin']);

        $logId = (int)$logId;
        $shopId = Auth::$shopId;

        try {
            DB::beginTransaction();

            $stmt = DB::query('SELECT * FROM supplier_returns WHERE id = ? AND shop_id = ?', [$logId, $shopId]);
            $log = $stmt->fetch();

            if (!$log) {
                DB::rollBack();
                Auth::jsonError('Return log entry not found.', 404);
            }

            // If return action, restore stock quantity
            if ($log['action_type'] === 'return') {
                DB::query(
                    'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND shop_id = ?',
                    [(int)$log['quantity'], $log['product_id'], $shopId]
                );

                // If due balance was deducted, restore supplier's due balance
                if (($log['settlement_type'] ?? '') === 'deduct_due' && (float)($log['refund_amount'] ?? 0) > 0) {
                    DB::query(
                        'UPDATE suppliers SET due_balance = due_balance + ? WHERE id = ? AND shop_id = ?',
                        [(float)$log['refund_amount'], (int)$log['supplier_id'], $shopId]
                    );
                }
            }

            DB::query('DELETE FROM supplier_returns WHERE id = ? AND shop_id = ?', [$logId, $shopId]);

            DB::commit();

            header('Content-Type: application/json');
            echo json_encode(['message' => 'Supplier return action deleted and inventory & due balances reverted.']);

        } catch (\Exception $e) {
            DB::rollBack();
            error_log('Delete supplier return error: ' . $e->getMessage());
            Auth::jsonError('Server error deleting return action.', 500);
        }
    }
}
