<?php
/**
 * Database Connection & Migrations
 */

// Set global error handler to return JSON for all errors
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    if (error_reporting() === 0) {
        return false;
    }
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Server error: ' . $errstr]);
    exit;
});

set_exception_handler(function($exception) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Server error: ' . $exception->getMessage()]);
    exit;
});

class DB {
    private static $pdo = null;

    public static function getConnection() {
        if (self::$pdo === null) {
            // Detect if running locally or on production server
            $isLocal = false;
            $httpHost = $_SERVER['HTTP_HOST'] ?? '';
            if (
                in_array($httpHost, ['localhost', '127.0.0.1', 'localhost:5000']) ||
                php_sapi_name() === 'cli'
            ) {
                $isLocal = true;
            }

            if ($isLocal) {
                $defaultHost = '127.0.0.1'; // Using IP instead of localhost avoids socket issues
                $defaultUser = 'root';
                $defaultPass = '';
                $defaultDb   = 'multitenant_pos';
            } else {
                $defaultHost = 'sql309.infinityfree.com'; // InfinityFree MySQL host
                $defaultUser = 'if0_42451104';
                $defaultPass = 'I8Kw8aZkldJO'; // Your production DB password
                $defaultDb   = 'if0_42451104_codexxa_pos';
            }

            // Only use environment variables if a .env file actually exists in the project.
            // This prevents hosting provider defaults (e.g. DB_HOST=localhost) from overriding our values.
            $envFileExists = false;
            $envPaths = [
                dirname(__DIR__) . '/.env',
                dirname(dirname(__DIR__)) . '/.env'
            ];
            foreach ($envPaths as $envPath) {
                if (file_exists($envPath)) {
                    $envFileExists = true;
                    break;
                }
            }

            if ($envFileExists) {
                $host = isset($_ENV['DB_HOST']) ? $_ENV['DB_HOST'] : (getenv('DB_HOST') ?: $defaultHost);
                $user = isset($_ENV['DB_USER']) ? $_ENV['DB_USER'] : (getenv('DB_USER') ?: $defaultUser);
                $pass = isset($_ENV['DB_PASS']) ? $_ENV['DB_PASS'] : (getenv('DB_PASS') !== false ? getenv('DB_PASS') : $defaultPass);
                $dbName = isset($_ENV['DB_NAME']) ? $_ENV['DB_NAME'] : (getenv('DB_NAME') ?: $defaultDb);
            } else {
                $host = $defaultHost;
                $user = $defaultUser;
                $pass = $defaultPass;
                $dbName = $defaultDb;
            }
            $charset = 'utf8mb4';

            $dsn = "mysql:host=$host;dbname=$dbName;charset=$charset";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
 
            try {
                self::$pdo = new PDO($dsn, $user, $pass, $options);
                self::$pdo->exec("SET time_zone = '+06:00';");
                
                // Only run migrations if lock file does not exist (speeds up API requests by 2-5x)
                $migrationLockFile = __DIR__ . '/.migration_lock';
                if (!file_exists($migrationLockFile)) {
                    self::runMigrations();
                    @file_put_contents($migrationLockFile, date('Y-m-d H:i:s'));
                }
            } catch (\PDOException $e) {
                // If database does not exist, attempt to create it
                if ($e->getCode() == 1049) {
                    try {
                        $tempDsn = "mysql:host=$host;charset=$charset";
                        $tempPdo = new PDO($tempDsn, $user, $pass, $options);
                        $tempPdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                        
                        self::$pdo = new PDO($dsn, $user, $pass, $options);
                        self::$pdo->exec("SET time_zone = '+06:00';");
                        self::runMigrations();
                        @file_put_contents(__DIR__ . '/.migration_lock', date('Y-m-d H:i:s'));
                    } catch (\PDOException $ex) {
                        http_response_code(500);
                        echo json_encode(['error' => 'Database connection/creation failed: ' . $ex->getMessage()]);
                        exit;
                    }
                } else {
                    http_response_code(500);
                    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
                    exit;
                }
            }
        }
        return self::$pdo;
    }

    public static function query($sql, $params = []) {
        $stmt = self::getConnection()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public static function beginTransaction() {
        return self::getConnection()->beginTransaction();
    }

    public static function commit() {
        return self::getConnection()->commit();
    }

    public static function rollBack() {
        return self::getConnection()->rollBack();
    }

    public static function lastInsertId() {
        return self::getConnection()->lastInsertId();
    }

    private static function runMigrations() {
        $pdo = self::$pdo;

        // Helper to check if column exists
        $columnExists = function($table, $column) use ($pdo) {
            try {
                $stmt = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
                return $stmt->rowCount() > 0;
            } catch (\PDOException $e) {
                return false;
            }
        };

        // Helper to check if table exists
        $tableExists = function($table) use ($pdo) {
            try {
                $stmt = $pdo->query("SHOW TABLES LIKE '$table'");
                return $stmt->rowCount() > 0;
            } catch (\PDOException $e) {
                return false;
            }
        };

        try {
            // Verify core tables exist
            if (!$tableExists('shops')) {
                // Read from schema.sql if exists to initialize base schema
                $schemaFile = dirname(__DIR__, 2) . '/database/schema.sql';
                if (file_exists($schemaFile)) {
                    $sql = file_get_contents($schemaFile);
                    $pdo->exec($sql);
                }
            }

            // Check if allowed_sections column exists on users table
            if ($tableExists('users') && !$columnExists('users', 'allowed_sections')) {
                $pdo->exec("ALTER TABLE `users` ADD COLUMN `allowed_sections` TEXT NULL");
            }

            // Check if items column exists on other_costs table
            if ($tableExists('other_costs') && !$columnExists('other_costs', 'items')) {
                $pdo->exec("ALTER TABLE `other_costs` ADD COLUMN `items` JSON NULL AFTER `notes`");
            }

            // Check if unit column exists on products table
            if ($tableExists('products') && !$columnExists('products', 'unit')) {
                $pdo->exec("ALTER TABLE `products` ADD COLUMN `unit` VARCHAR(20) NOT NULL DEFAULT 'piece'");
            }

            // Check if category column exists on products table
            if ($tableExists('products') && !$columnExists('products', 'category')) {
                $pdo->exec("ALTER TABLE `products` ADD COLUMN `category` VARCHAR(100) NULL");
            }

            // Check if due_balance column exists on suppliers table
            if ($tableExists('suppliers') && !$columnExists('suppliers', 'due_balance')) {
                $pdo->exec("ALTER TABLE `suppliers` ADD COLUMN `due_balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }

            // Check if payment_basis column exists on purchase_orders table
            if ($tableExists('purchase_orders') && !$columnExists('purchase_orders', 'payment_basis')) {
                $pdo->exec("ALTER TABLE `purchase_orders` ADD COLUMN `payment_basis` ENUM('cash', 'credit') NOT NULL DEFAULT 'cash'");
            }

            // Check if expiry_date column exists on purchase_order_items table
            if ($tableExists('purchase_order_items') && !$columnExists('purchase_order_items', 'expiry_date')) {
                $pdo->exec("ALTER TABLE `purchase_order_items` ADD COLUMN `expiry_date` DATE NULL");
            }

            // Create contact_information table if not exists
            if (!$tableExists('contact_information')) {
                $pdo->exec("
                    CREATE TABLE `contact_information` (
                        `id` INT AUTO_INCREMENT PRIMARY KEY,
                        `email_addresses` JSON NULL,
                        `phone_numbers` JSON NULL,
                        `payment_numbers` JSON NULL,
                        `address` TEXT NULL,
                        `business_hours` JSON NULL,
                        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
                
                // Insert default contact information
                $pdo->exec("
                    INSERT INTO `contact_information` (`email_addresses`, `phone_numbers`, `payment_numbers`, `address`, `business_hours`)
                    VALUES (
                        '[\"support@possystem.com\", \"info@possystem.com\"]',
                        '[\"+1 (555) 123-4567\", \"+1 (555) 987-6543\"]',
                        '[{\"method\":\"bKash\",\"number\":\"01700000000\"},{\"method\":\"Nagad\",\"number\":\"01800000000\"}]',
                        '123 Business Ave, Suite 100\nSan Francisco, CA 94102',
                        '{\"monday_friday\": \"9:00 AM - 6:00 PM\", \"saturday\": \"10:00 AM - 4:00 PM\", \"sunday\": \"Closed\"}'
                    )
                ");
            }

            // Add payment_numbers column to contact_information if missing
            if ($tableExists('contact_information') && !$columnExists('contact_information', 'payment_numbers')) {
                $pdo->exec("ALTER TABLE `contact_information` ADD COLUMN `payment_numbers` JSON NULL AFTER `phone_numbers`");
            }

            // Check if quantity_ordered column exists on purchase_order_items table (handle column name mismatch)
            if ($tableExists('purchase_order_items') && $columnExists('purchase_order_items', 'quantity') && !$columnExists('purchase_order_items', 'quantity_ordered')) {
                $pdo->exec("ALTER TABLE `purchase_order_items` CHANGE COLUMN `quantity` `quantity_ordered` INT NOT NULL");
            }

            // Check if quantity_received column exists on purchase_order_items table
            if ($tableExists('purchase_order_items') && !$columnExists('purchase_order_items', 'quantity_received')) {
                $pdo->exec("ALTER TABLE `purchase_order_items` ADD COLUMN `quantity_received` INT NULL");
            }

            // Check if cost_price column exists on purchase_order_items table
            if ($tableExists('purchase_order_items') && !$columnExists('purchase_order_items', 'cost_price')) {
                // If unit_price exists, rename it to cost_price
                if ($columnExists('purchase_order_items', 'unit_price')) {
                    $pdo->exec("ALTER TABLE `purchase_order_items` CHANGE COLUMN `unit_price` `cost_price` DECIMAL(10,2) NOT NULL");
                } else {
                    $pdo->exec("ALTER TABLE `purchase_order_items` ADD COLUMN `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
                }
            }

            // Check if selling_price column exists on purchase_order_items table
            if ($tableExists('purchase_order_items') && !$columnExists('purchase_order_items', 'selling_price')) {
                $pdo->exec("ALTER TABLE `purchase_order_items` ADD COLUMN `selling_price` DECIMAL(10,2) NULL");
            }

            // Check if subtotal column exists on purchase_order_items table
            if ($tableExists('purchase_order_items') && !$columnExists('purchase_order_items', 'subtotal')) {
                $pdo->exec("ALTER TABLE `purchase_order_items` ADD COLUMN `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }

            // Check if paid_amount column exists on purchase_orders table
            if ($tableExists('purchase_orders') && !$columnExists('purchase_orders', 'paid_amount')) {
                $pdo->exec("ALTER TABLE `purchase_orders` ADD COLUMN `paid_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }

            // Check if due_amount column exists on purchase_orders table
            if ($tableExists('purchase_orders') && !$columnExists('purchase_orders', 'due_amount')) {
                $pdo->exec("ALTER TABLE `purchase_orders` ADD COLUMN `due_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }

            // Check if cost_price column exists on sale_items table
            if ($tableExists('sale_items') && !$columnExists('sale_items', 'cost_price')) {
                $pdo->exec("ALTER TABLE `sale_items` ADD COLUMN `cost_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }

            // Create supplier_returns table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `supplier_returns` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `supplier_id` INT NOT NULL,
                    `product_id` INT NOT NULL,
                    `quantity` INT NOT NULL,
                    `action_type` ENUM('return', 'replace') NOT NULL,
                    `unit_cost` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    `reason` VARCHAR(100) NULL DEFAULT 'Expired',
                    `settlement_type` VARCHAR(50) NOT NULL DEFAULT 'none',
                    `refund_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    `reference_no` VARCHAR(50) NULL,
                    `status` VARCHAR(30) NOT NULL DEFAULT 'completed',
                    `notes` TEXT NULL,
                    `new_expiry_date` DATE NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    CONSTRAINT `fk_supplier_returns_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_supplier_returns_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_supplier_returns_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            if ($tableExists('supplier_returns') && !$columnExists('supplier_returns', 'unit_cost')) {
                $pdo->exec("ALTER TABLE `supplier_returns` ADD COLUMN `unit_cost` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }
            if ($tableExists('supplier_returns') && !$columnExists('supplier_returns', 'total_amount')) {
                $pdo->exec("ALTER TABLE `supplier_returns` ADD COLUMN `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }
            if ($tableExists('supplier_returns') && !$columnExists('supplier_returns', 'reason')) {
                $pdo->exec("ALTER TABLE `supplier_returns` ADD COLUMN `reason` VARCHAR(100) NULL DEFAULT 'Expired'");
            }
            if ($tableExists('supplier_returns') && !$columnExists('supplier_returns', 'settlement_type')) {
                $pdo->exec("ALTER TABLE `supplier_returns` ADD COLUMN `settlement_type` VARCHAR(50) NOT NULL DEFAULT 'none'");
            }
            if ($tableExists('supplier_returns') && !$columnExists('supplier_returns', 'refund_amount')) {
                $pdo->exec("ALTER TABLE `supplier_returns` ADD COLUMN `refund_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }
            if ($tableExists('supplier_returns') && !$columnExists('supplier_returns', 'reference_no')) {
                $pdo->exec("ALTER TABLE `supplier_returns` ADD COLUMN `reference_no` VARCHAR(50) NULL");
            }
            if ($tableExists('supplier_returns') && !$columnExists('supplier_returns', 'status')) {
                $pdo->exec("ALTER TABLE `supplier_returns` ADD COLUMN `status` VARCHAR(30) NOT NULL DEFAULT 'completed'");
            }

            // Create customer_returns table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `customer_returns` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `customer_id` INT NULL,
                    `sale_id` INT NULL,
                    `product_id` INT NOT NULL,
                    `quantity` INT NOT NULL,
                    `refund_amount` DECIMAL(10,2) NOT NULL,
                    `refund_method` VARCHAR(30) NOT NULL DEFAULT 'cash',
                    `notes` TEXT NULL,
                    `deduct_from_due` TINYINT(1) NOT NULL DEFAULT 0,
                    `amount_deducted_from_due` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    CONSTRAINT `fk_customer_returns_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_customer_returns_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
                    CONSTRAINT `fk_customer_returns_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL,
                    CONSTRAINT `fk_customer_returns_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            if ($tableExists('customer_returns') && !$columnExists('customer_returns', 'refund_method')) {
                $pdo->exec("ALTER TABLE `customer_returns` ADD COLUMN `refund_method` VARCHAR(30) NOT NULL DEFAULT 'cash'");
            }

            if ($tableExists('customer_returns') && !$columnExists('customer_returns', 'amount_deducted_from_due')) {
                $pdo->exec("ALTER TABLE `customer_returns` ADD COLUMN `amount_deducted_from_due` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
            }

            // Check if logo column exists on users table
            if ($tableExists('users') && !$columnExists('users', 'logo')) {
                $pdo->exec("ALTER TABLE `users` ADD COLUMN `logo` LONGTEXT NULL");
            }

            // Check if logo column exists on shops table
            if ($tableExists('shops') && !$columnExists('shops', 'logo')) {
                $pdo->exec("ALTER TABLE `shops` ADD COLUMN `logo` LONGTEXT NULL");
            }

            // Create due_payments table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `due_payments` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `customer_id` INT NOT NULL,
                    `sale_id` INT NULL,
                    `amount` DECIMAL(10,2) NOT NULL,
                    `payment_method` ENUM('cash', 'card', 'mobile_pay', 'other') NOT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    CONSTRAINT `fk_due_payments_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_due_payments_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_due_payments_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            if ($tableExists('due_payments') && !$columnExists('due_payments', 'transaction_reference')) {
                $pdo->exec("ALTER TABLE `due_payments` ADD COLUMN `transaction_reference` VARCHAR(255) NULL");
                $pdo->exec("ALTER TABLE `due_payments` ADD COLUMN `note` TEXT NULL");
            }

            // Modify held_bills discount_percent column to DECIMAL(10,2) to accommodate flat discounts
            if ($tableExists('held_bills')) {
                $pdo->exec("ALTER TABLE `held_bills` MODIFY COLUMN `discount_percent` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
                if (!$columnExists('held_bills', 'discount_amount')) {
                    $pdo->exec("ALTER TABLE `held_bills` ADD COLUMN `discount_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00");
                }
            }

            // Create subscriptions table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `subscriptions` (
                    `id` INT AUTO_INCREMENT PRIMARY KEY,
                    `plan_id` INT NULL,
                    `shop_id` INT NULL,
                    `plan_name` VARCHAR(100) NOT NULL,
                    `price` DECIMAL(10,2) NOT NULL,
                    `currency` VARCHAR(10) DEFAULT 'BDT',
                    `billing_period` VARCHAR(20) DEFAULT 'month',
                    `subscriber_name` VARCHAR(100) NOT NULL,
                    `shop_name` VARCHAR(100) NOT NULL,
                    `email` VARCHAR(100) NOT NULL,
                    `phone` VARCHAR(30) NOT NULL,
                    `payment_method` VARCHAR(50) DEFAULT 'bKash',
                    `transaction_id` VARCHAR(100) NULL,
                    `receipt_image` VARCHAR(255) NULL,
                    `status` ENUM('pending', 'approved', 'active', 'rejected', 'expired') DEFAULT 'pending',
                    `start_date` DATE NULL,
                    `end_date` DATE NULL,
                    `notes` TEXT NULL,
                    `admin_notes` TEXT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    CONSTRAINT `fk_subscriptions_plan` FOREIGN KEY (`plan_id`) REFERENCES `pricing_plans` (`id`) ON DELETE SET NULL,
                    CONSTRAINT `fk_subscriptions_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            if ($tableExists('subscriptions') && !$columnExists('subscriptions', 'shop_id')) {
                $pdo->exec("ALTER TABLE `subscriptions` ADD COLUMN `shop_id` INT NULL AFTER `plan_id`");
            }

            if ($tableExists('subscriptions') && !$columnExists('subscriptions', 'receipt_image')) {
                $pdo->exec("ALTER TABLE `subscriptions` ADD COLUMN `receipt_image` VARCHAR(255) NULL AFTER `transaction_id`");
            }

            // Create other_sales table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `other_sales` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `title` VARCHAR(255) NULL,
                    `customer_name` VARCHAR(255) NULL,
                    `customer_phone` VARCHAR(50) NULL,
                    `items` TEXT NULL,
                    `amount` DECIMAL(10,2) NOT NULL,
                    `sale_date` DATE NOT NULL,
                    `notes` TEXT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    CONSTRAINT `fk_other_sales_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            
            // Alter existing table if we just changed the schema (for backwards compatibility during development)
            if ($tableExists('other_sales') && !$columnExists('other_sales', 'items')) {
                $pdo->exec("ALTER TABLE `other_sales` ADD COLUMN `customer_name` VARCHAR(255) NULL");
                $pdo->exec("ALTER TABLE `other_sales` ADD COLUMN `customer_phone` VARCHAR(50) NULL");
                $pdo->exec("ALTER TABLE `other_sales` ADD COLUMN `items` TEXT NULL");
                $pdo->exec("ALTER TABLE `other_sales` CHANGE COLUMN `title` `title` VARCHAR(255) NULL");
            }

            // Create manual_orders table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `manual_orders` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `salesman_name` VARCHAR(255) NOT NULL,
                    `customer_id` INT NULL,
                    `customer_name` VARCHAR(255) NULL,
                    `customer_phone` VARCHAR(50) NULL,
                    `customer_address` TEXT NULL,
                    `payment_method` ENUM('cash', 'credit') NOT NULL DEFAULT 'cash',
                    `discount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    `tax` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    `notes` TEXT NULL,
                    `status` ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending',
                    `sale_id` INT NULL,
                    `created_by` INT NOT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    CONSTRAINT `fk_manual_orders_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_manual_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
                    CONSTRAINT `fk_manual_orders_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE SET NULL,
                    CONSTRAINT `fk_manual_orders_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            if ($tableExists('manual_orders') && !$columnExists('manual_orders', 'customer_name')) {
                $pdo->exec("ALTER TABLE `manual_orders` ADD COLUMN `customer_name` VARCHAR(255) NULL");
                $pdo->exec("ALTER TABLE `manual_orders` ADD COLUMN `customer_phone` VARCHAR(50) NULL");
                $pdo->exec("ALTER TABLE `manual_orders` ADD COLUMN `customer_address` TEXT NULL");
            }

            // Create manual_order_items table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `manual_order_items` (
                    `id` INT AUTO_INCREMENT,
                    `order_id` INT NOT NULL,
                    `shop_id` INT NOT NULL,
                    `product_id` INT NOT NULL,
                    `quantity` INT NOT NULL,
                    `unit_price` DECIMAL(10,2) NOT NULL,
                    `subtotal` DECIMAL(10,2) NOT NULL,
                    PRIMARY KEY (`id`),
                    CONSTRAINT `fk_manual_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `manual_orders` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_manual_order_items_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_manual_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // Create inventory_adjustments table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `inventory_adjustments` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `product_id` INT NOT NULL,
                    `previous_quantity` INT NOT NULL,
                    `adjusted_quantity` INT NOT NULL,
                    `difference` INT NOT NULL,
                    `adjustment_type` ENUM('increase', 'decrease') NOT NULL,
                    `reason` VARCHAR(255) NOT NULL,
                    `notes` TEXT NULL,
                    `adjusted_by` INT NOT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    INDEX `idx_inventory_adjustments_shop` (`shop_id`),
                    INDEX `idx_inventory_adjustments_product` (`product_id`),
                    INDEX `idx_inventory_adjustments_date` (`created_at`),
                    CONSTRAINT `fk_inventory_adjustments_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_inventory_adjustments_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_inventory_adjustments_user` FOREIGN KEY (`adjusted_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");
            // Modify quantity columns to DECIMAL(10,3) to support fractional quantities
            $tablesToAlter = [
                'manual_order_items' => 'quantity',
                'sale_items' => 'quantity',
                'purchase_order_items' => 'quantity',
                'supplier_returns' => 'quantity',
                'customer_returns' => 'quantity',
                'wastages' => 'quantity'
            ];
            foreach ($tablesToAlter as $tbl => $col) {
                if ($tableExists($tbl)) {
                    try {
                        $pdo->exec("ALTER TABLE `$tbl` MODIFY COLUMN `$col` DECIMAL(10,3) NOT NULL");
                    } catch (\Exception $e) {}
                }
            }
            if ($tableExists('products')) {
                try {
                    $pdo->exec("ALTER TABLE `products` MODIFY COLUMN `stock_quantity` DECIMAL(10,3) NOT NULL DEFAULT '0.000'");
                    $pdo->exec("ALTER TABLE `products` MODIFY COLUMN `low_stock_threshold` DECIMAL(10,3) NOT NULL DEFAULT '5.000'");
                } catch (\Exception $e) {}
            }
            if ($tableExists('inventory_adjustments')) {
                try {
                    $pdo->exec("ALTER TABLE `inventory_adjustments` MODIFY COLUMN `previous_quantity` DECIMAL(10,3) NOT NULL");
                    $pdo->exec("ALTER TABLE `inventory_adjustments` MODIFY COLUMN `adjusted_quantity` DECIMAL(10,3) NOT NULL");
                    $pdo->exec("ALTER TABLE `inventory_adjustments` MODIFY COLUMN `difference` DECIMAL(10,3) NOT NULL");
                } catch (\Exception $e) {}
            }

            // Check if notes column exists on sales table
            if ($tableExists('sales') && !$columnExists('sales', 'notes')) {
                $pdo->exec("ALTER TABLE `sales` ADD COLUMN `notes` TEXT NULL");
            }

            // Seed Super Admin if table has no users
            $stmt = $pdo->query("SELECT COUNT(*) FROM `users` WHERE `role` = 'super_admin'");
            if ($stmt->fetchColumn() == 0) {
                $pdo->exec("
                    INSERT INTO `users` (`name`, `email`, `password_hash`, `role`, `status`)
                    VALUES ('Super Admin', 'mk.rabbani.cse@gmail.com', '$2a$10\$Jek6c.Ov3IBnEWQ45ImT5.XDEI7bmLlsqYL69nFhY.T0zgaGqfsIO', 'super_admin', 'active')
                ");
            }

            // Sync and activate admin@mkpharmacy.com password to 123456789
            if ($tableExists('users')) {
                try {
                    $mkHash = password_hash('123456789', PASSWORD_BCRYPT);
                    $pdo->exec("
                        UPDATE `users` 
                        SET `password_hash` = '$mkHash', `status` = 'active'
                        WHERE `email` = 'admin@mkpharmacy.com' OR `email` LIKE '%mkpharmacy%'
                    ");
                } catch (\Exception $e) {}
            }
            if ($tableExists('shops')) {
                try {
                    $pdo->exec("
                        UPDATE `shops` 
                        SET `status` = 'active' 
                        WHERE `email` LIKE '%mkpharmacy%' OR `name` LIKE '%MK Pharmacy%' OR `name` LIKE '%mkpharmacy%'
                    ");
                } catch (\Exception $e) {}
            }

            // Create attendance table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `attendance` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `user_id` INT NOT NULL,
                    `date` DATE NOT NULL,
                    `check_in_time` TIME NULL,
                    `check_out_time` TIME NULL,
                    `status` ENUM('present', 'absent', 'late', 'half_day') NOT NULL DEFAULT 'present',
                    `notes` TEXT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    UNIQUE KEY `uq_user_date` (`user_id`, `date`),
                    INDEX `idx_attendance_shop_date` (`shop_id`, `date`),
                    INDEX `idx_attendance_user_date` (`user_id`, `date`),
                    CONSTRAINT `fk_attendance_shop`
                        FOREIGN KEY (`shop_id`)
                        REFERENCES `shops` (`id`)
                        ON DELETE CASCADE
                        ON UPDATE CASCADE,
                    CONSTRAINT `fk_attendance_user`
                        FOREIGN KEY (`user_id`)
                        REFERENCES `users` (`id`)
                        ON DELETE CASCADE
                        ON UPDATE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // Create investments table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `investments` (
                    `id` INT AUTO_INCREMENT,
                    `shop_id` INT NOT NULL,
                    `investment_type` ENUM('capital_injection', 'capital_withdrawal', 'profit_reinvestment', 'external_investment') NOT NULL DEFAULT 'capital_injection',
                    `amount` DECIMAL(10,2) NOT NULL,
                    `description` TEXT NULL,
                    `investor_name` VARCHAR(255) NULL,
                    `investment_date` DATE NOT NULL,
                    `created_by` INT NOT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    INDEX `idx_investments_shop` (`shop_id`),
                    INDEX `idx_investments_date` (`investment_date`),
                    CONSTRAINT `fk_investments_shop` FOREIGN KEY (`shop_id`) REFERENCES `shops` (`id`) ON DELETE CASCADE,
                    CONSTRAINT `fk_investments_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // Create contact_messages table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `contact_messages` (
                    `id` INT AUTO_INCREMENT PRIMARY KEY,
                    `name` VARCHAR(255) NOT NULL,
                    `phone` VARCHAR(50) NOT NULL,
                    `message` TEXT NOT NULL,
                    `status` ENUM('new', 'read', 'replied') NOT NULL DEFAULT 'new',
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // Migrate email column to phone column if contact_messages table exists with email column
            if ($tableExists('contact_messages') && $columnExists('contact_messages', 'email') && !$columnExists('contact_messages', 'phone')) {
                $pdo->exec("ALTER TABLE `contact_messages` ADD COLUMN `phone` VARCHAR(50) NULL AFTER `name`");
                $pdo->exec("UPDATE `contact_messages` SET `phone` = `email` WHERE `phone` IS NULL");
                $pdo->exec("ALTER TABLE `contact_messages` DROP COLUMN `email`");
                $pdo->exec("ALTER TABLE `contact_messages` MODIFY COLUMN `phone` VARCHAR(50) NOT NULL");
            }

            // Remove subject column if it exists in contact_messages table
            if ($tableExists('contact_messages') && $columnExists('contact_messages', 'subject')) {
                try {
                    $pdo->exec("ALTER TABLE `contact_messages` DROP COLUMN `subject`");
                } catch (\Exception $e) {
                    // Column might not exist or other error, ignore
                }
            }

            // Create pricing_plans table if not exists
            if (!$tableExists('pricing_plans')) {
                $pdo->exec("
                    CREATE TABLE `pricing_plans` (
                        `id` INT AUTO_INCREMENT PRIMARY KEY,
                        `name` VARCHAR(100) NOT NULL,
                        `description` TEXT NULL,
                        `price` DECIMAL(10,2) NOT NULL,
                        `currency` VARCHAR(10) NOT NULL DEFAULT 'BDT',
                        `billing_period` VARCHAR(20) NOT NULL DEFAULT 'month',
                        `features` JSON NULL,
                        `is_popular` TINYINT(1) NOT NULL DEFAULT 0,
                        `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                        `sort_order` INT NOT NULL DEFAULT 0,
                        `button_text` VARCHAR(50) NULL,
                        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                ");
                
                // Insert default pricing plans
                $pdo->exec("
                    INSERT INTO `pricing_plans` (`name`, `description`, `price`, `currency`, `billing_period`, `features`, `is_popular`, `is_active`, `sort_order`, `button_text`)
                    VALUES 
                    ('Starter', 'Perfect for small businesses', 1500.00, 'BDT', 'month', '[\"Up to 100 products\", \"Basic analytics\", \"Email support\"]', 0, 1, 1, 'Get Started'),
                    ('Professional', 'For growing businesses', 2000.00, 'BDT', 'month', '[\"Unlimited products\", \"Advanced analytics\", \"Priority support\", \"Multi-location\"]', 1, 1, 2, 'Get Started'),
                    ('Enterprise', 'For large organizations', 3000.00, 'BDT', 'month', '[\"Everything in Professional\", \"Custom integrations\", \"Dedicated account manager\", \"24/7 phone support\"]', 0, 1, 3, 'Contact Sales')
                ");
            }

            // Create subscriptions table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `subscriptions` (
                    `id` INT AUTO_INCREMENT PRIMARY KEY,
                    `plan_id` INT NULL,
                    `shop_id` INT NULL,
                    `plan_name` VARCHAR(150) NOT NULL,
                    `price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    `currency` VARCHAR(10) NOT NULL DEFAULT 'BDT',
                    `billing_period` VARCHAR(20) NOT NULL DEFAULT 'month',
                    `subscriber_name` VARCHAR(255) NOT NULL,
                    `shop_name` VARCHAR(255) NOT NULL,
                    `email` VARCHAR(255) NOT NULL,
                    `phone` VARCHAR(50) NOT NULL,
                    `payment_method` VARCHAR(50) NOT NULL DEFAULT 'bKash',
                    `transaction_id` VARCHAR(100) NULL,
                    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
                    `start_date` DATE NULL,
                    `end_date` DATE NULL,
                    `notes` TEXT NULL,
                    `admin_notes` TEXT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // Create master_supplier_products table if not exists
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `master_supplier_products` (
                    `id` INT AUTO_INCREMENT PRIMARY KEY,
                    `supplier_name` VARCHAR(255) NOT NULL,
                    `product_name` VARCHAR(255) NOT NULL,
                    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX `idx_supplier_name` (`supplier_name`),
                    INDEX `idx_product_name` (`product_name`),
                    UNIQUE KEY `unique_supplier_product` (`supplier_name`(191), `product_name`(191))
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            // Create more_services table if not exists
            if (!$tableExists('more_services')) {
                $pdo->exec("
                    CREATE TABLE `more_services` (
                        `id` INT AUTO_INCREMENT PRIMARY KEY,
                        `title` VARCHAR(255) NOT NULL,
                        `subtitle` VARCHAR(255) NULL,
                        `description` TEXT NULL,
                        `badge` VARCHAR(100) NULL,
                        `features` JSON NULL,
                        `icon` VARCHAR(100) NULL DEFAULT 'code',
                        `image_url` VARCHAR(500) NULL,
                        `button_text` VARCHAR(100) NULL DEFAULT 'Learn More',
                        `button_link` VARCHAR(500) NULL DEFAULT '#contact',
                        `display_order` INT NOT NULL DEFAULT 0,
                        `status` ENUM('active', 'inactive') DEFAULT 'active',
                        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        INDEX `idx_more_services_order` (`display_order`),
                        INDEX `idx_more_services_status` (`status`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
                ");

                // Seed initial services
                $pdo->exec("
                    INSERT INTO `more_services` (`title`, `subtitle`, `description`, `badge`, `features`, `icon`, `button_text`, `button_link`, `display_order`, `status`) VALUES
                    (
                        'Custom Software & ERP Development',
                        'Tailor-made software tailored to your specific business operations',
                        'Bespoke enterprise ERPs, specialized inventory workflows, custom accounting modules, and API integrations built precisely for your unique operational requirements.',
                        'Custom Built',
                        '[\"Custom Module Development\", \"ERP & Accounting Integration\", \"Dedicated Engineering Team\", \"Scalable High-Load Architecture\"]',
                        'code',
                        'Inquire Now',
                        'https://wa.me/8801572491828?text=Hello%20Codexxaa,%20I%20want%20to%20know%20more%20about%20Custom%20Software%20Development',
                        1,
                        'active'
                    ),
                    (
                        'POS Hardware & Peripherals Setup',
                        'End-to-end retail hardware procurement and setup',
                        'High-speed 80mm thermal receipt printers, wireless handheld barcode scanners, heavy-duty electronic cash drawers, customer display screens, and touch monitors.',
                        'Hardware',
                        '[\"Tested Compatible Bundles\", \"Thermal Printers & Barcode Scanners\", \"Heavy-Duty Cash Drawers\", \"1-Year Hardware Warranty & Setup\"]',
                        'printer',
                        'Order Hardware',
                        'https://wa.me/8801572491828?text=Hello%20Codexxaa,%20I%20want%20to%20order%20POS%20Hardware%20and%20Peripherals',
                        2,
                        'active'
                    ),
                    (
                        'Cloud Migration & Automated Backup',
                        'Zero-downtime migration to modern cloud infrastructure',
                        'Seamlessly migrate your legacy desktop or offline POS database to our secure cloud server with real-time automated daily backups and disaster recovery.',
                        'Popular',
                        '[\"Zero Downtime Migration\", \"Automated Redundant Backups\", \"AES-256 Cloud Encryption\", \"Historical Data Sanitization\"]',
                        'cloud',
                        'Migrate Now',
                        'https://wa.me/8801572491828?text=Hello%20Codexxaa,%20I%20want%20to%20migrate%20my%20data%20to%20Cloud',
                        3,
                        'active'
                    ),
                    (
                        'E-commerce & Mobile App Sync',
                        'Synchronize in-store retail stock with your online store',
                        'Connect your physical POS sales and inventory with WooCommerce, Shopify, or custom branded iOS & Android customer mobile apps in real-time.',
                        'Omnichannel',
                        '[\"Real-time Stock Synchronization\", \"Unified Customer Profiles\", \"Instant Push Notifications\", \"Multi-channel Order Processing\"]',
                        'smartphone',
                        'Explore Sync',
                        'https://wa.me/8801572491828?text=Hello%20Codexxaa,%20I%20am%20interested%20in%20E-commerce%20and%20Mobile%20App%20Sync',
                        4,
                        'active'
                    ),
                    (
                        'Networking, CCTV & Security Integration',
                        'Full retail infrastructure networking & register monitoring',
                        'Comprehensive shop networking, ultra-low-latency local Wi-Fi / LAN setups, smart CCTV coverage over cashier desks, and anti-theft counter synchronization.',
                        'Security',
                        '[\"High-Speed LAN & Wi-Fi Routers\", \"Cashier CCTV Video Synchronization\", \"Anti-theft Transaction Tracking\", \"UPS & Power Redundancy Planning\"]',
                        'shield',
                        'Request Survey',
                        'https://wa.me/8801572491828?text=Hello%20Codexxaa,%20I%20need%20Networking%20and%20CCTV%20Installation',
                        5,
                        'active'
                    ),
                    (
                        '24/7 Dedicated Support & SLA',
                        'Round-the-clock priority assistance and onsite staff training',
                        'Premium enterprise SLA featuring direct WhatsApp engineer hotlines, on-site/remote staff onboarding, quarterly health inspections, and priority emergency response.',
                        '24/7 SLA',
                        '[\"Under 15-Minute Response SLA\", \"Dedicated Technical Account Manager\", \"Unlimited Staff Training Sessions\", \"Quarterly System Health Audits\"]',
                        'headset',
                        'Contact Support',
                        'https://wa.me/8801572491828?text=Hello%20Codexxaa,%20I%20want%20to%20learn%20about%2024/7%20Dedicated%20Support%20SLA',
                        6,
                        'active'
                    )
                ");
            }

        } catch (\PDOException $e) {
            error_log("Migration error: " . $e->getMessage());
            file_put_contents(__DIR__ . '/migration_error.txt', "Migration error: " . $e->getMessage());
        }
    }
}
