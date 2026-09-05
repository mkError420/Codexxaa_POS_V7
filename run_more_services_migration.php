<?php
// Run migration to create more_services table and seed data
require_once __DIR__ . '/backend/config/db.php';

try {
    echo "Starting migration for more_services table...\n\n";

    $sqlFile = __DIR__ . '/database/migration_add_more_services.sql';
    if (!file_exists($sqlFile)) {
        throw new Exception("Migration file not found: $sqlFile");
    }

    $sql = file_get_contents($sqlFile);
    $pdo = DB::getConnection();
    $pdo->exec($sql);

    echo "SQL script executed successfully!\n";

    // Verification
    $stmt = $pdo->query("SHOW TABLES LIKE 'more_services'");
    $exists = $stmt->fetch();
    echo "Table 'more_services': " . ($exists ? "✓ Created" : "✗ Not found") . "\n";

    if ($exists) {
        $countStmt = $pdo->query("SELECT COUNT(*) FROM `more_services`");
        $count = $countStmt->fetchColumn();
        echo "Total services in table: " . $count . "\n";

        $listStmt = $pdo->query("SELECT id, title, badge, icon, status, display_order FROM `more_services` ORDER BY display_order ASC");
        $services = $listStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($services as $s) {
            echo " - [ID {$s['id']}] #{$s['display_order']} {$s['title']} | Badge: {$s['badge']} | Icon: {$s['icon']} | Status: {$s['status']}\n";
        }
    }

    // Reset migration lock file if present so db.php stays fresh
    $lockFile = __DIR__ . '/backend/config/.migration_lock';
    if (file_exists($lockFile)) {
        @unlink($lockFile);
        echo "Refreshed .migration_lock\n";
    }

    echo "\nMigration finished successfully!\n";
} catch (Exception $e) {
    echo "Error during migration: " . $e->getMessage() . "\n";
    exit(1);
}
