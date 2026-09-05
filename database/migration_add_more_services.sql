-- Migration for More Services Section Management
-- Adds table `more_services` and seeds initial services

CREATE TABLE IF NOT EXISTS `more_services` (
  `id` INT AUTO_INCREMENT,
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
  PRIMARY KEY (`id`),
  INDEX `idx_more_services_order` (`display_order`),
  INDEX `idx_more_services_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default services if table is empty
INSERT INTO `more_services` (`title`, `subtitle`, `description`, `badge`, `features`, `icon`, `button_text`, `button_link`, `display_order`, `status`)
SELECT * FROM (
    SELECT 
        'Custom Software & ERP Development' AS `title`,
        'Tailor-made software tailored to your specific business operations' AS `subtitle`,
        'Bespoke enterprise ERPs, specialized inventory workflows, custom accounting modules, and API integrations built precisely for your unique operational requirements.' AS `description`,
        'Custom Built' AS `badge`,
        '["Custom Module Development", "ERP & Accounting Integration", "Dedicated Engineering Team", "Scalable High-Load Architecture"]' AS `features`,
        'code' AS `icon`,
        'Inquire Now' AS `button_text`,
        'https://wa.me/8801572491828?text=Hello%20Codexxaa,%20I%20want%20to%20know%20more%20about%20Custom%20Software%20Development' AS `button_link`,
        1 AS `display_order`,
        'active' AS `status`
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM `more_services` LIMIT 1
);

INSERT INTO `more_services` (`title`, `subtitle`, `description`, `badge`, `features`, `icon`, `button_text`, `button_link`, `display_order`, `status`)
SELECT * FROM (
    SELECT 
        'POS Hardware & Peripherals Setup' AS `title`,
        'End-to-end retail hardware procurement and setup' AS `subtitle`,
        'High-speed 80mm thermal receipt printers, wireless handheld barcode scanners, heavy-duty electronic cash drawers, customer display screens, and touch monitors.' AS `description`,
        'Hardware' AS `badge`,
        '["Tested Compatible Bundles", "Thermal Printers & Barcode Scanners", "Heavy-Duty Cash Drawers", "1-Year Hardware Warranty & Setup"]' AS `features`,
        'printer' AS `icon`,
        'Order Hardware' AS `button_text`,
        'https://wa.me/8801572491828?text=Hello%20Codexxaa,%20I%20want%20to%20order%20POS%20Hardware%20and%20Peripherals' AS `button_link`,
        2 AS `display_order`,
        'active' AS `status`
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM `more_services` WHERE `title` = 'POS Hardware & Peripherals Setup'
);

INSERT INTO `more_services` (`title`, `subtitle`, `description`, `badge`, `features`, `icon`, `button_text`, `button_link`, `display_order`, `status`)
SELECT * FROM (
    SELECT 
        'Cloud Migration & Automated Backup' AS `title`,
        'Zero-downtime migration to modern cloud infrastructure' AS `subtitle`,
        'Seamlessly migrate your legacy desktop or offline POS database to our secure cloud server with real-time automated daily backups and disaster recovery.' AS `description`,
        'Popular' AS `badge`,
        '["Zero Downtime Migration", "Automated Redundant Backups", "AES-256 Cloud Encryption", "Historical Data Sanitization"]' AS `features`,
        'cloud' AS `icon`,
        'Migrate Now' AS `button_text`,
        'https://wa.me/8801572491828?text=Hello%20Codexxaa,%20I%20want%20to%20migrate%20my%20data%20to%20Cloud' AS `button_link`,
        3 AS `display_order`,
        'active' AS `status`
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM `more_services` WHERE `title` = 'Cloud Migration & Automated Backup'
);

INSERT INTO `more_services` (`title`, `subtitle`, `description`, `badge`, `features`, `icon`, `button_text`, `button_link`, `display_order`, `status`)
SELECT * FROM (
    SELECT 
        'E-commerce & Mobile App Sync' AS `title`,
        'Synchronize in-store retail stock with your online store' AS `subtitle`,
        'Connect your physical POS sales and inventory with WooCommerce, Shopify, or custom branded iOS & Android customer mobile apps in real-time.' AS `description`,
        'Omnichannel' AS `badge`,
        '["Real-time Stock Synchronization", "Unified Customer Profiles", "Instant Push Notifications", "Multi-channel Order Processing"]' AS `features`,
        'smartphone' AS `icon`,
        'Explore Sync' AS `button_text`,
        'https://wa.me/8801572491828?text=Hello%20Codexxaa,%20I%20am%20interested%20in%20E-commerce%20and%20Mobile%20App%20Sync' AS `button_link`,
        4 AS `display_order`,
        'active' AS `status`
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM `more_services` WHERE `title` = 'E-commerce & Mobile App Sync'
);

INSERT INTO `more_services` (`title`, `subtitle`, `description`, `badge`, `features`, `icon`, `button_text`, `button_link`, `display_order`, `status`)
SELECT * FROM (
    SELECT 
        'Networking, CCTV & Security Integration' AS `title`,
        'Full retail infrastructure networking & register monitoring' AS `subtitle`,
        'Comprehensive shop networking, ultra-low-latency local Wi-Fi / LAN setups, smart CCTV coverage over cashier desks, and anti-theft counter synchronization.' AS `description`,
        'Security' AS `badge`,
        '["High-Speed LAN & Wi-Fi Routers", "Cashier CCTV Video Synchronization", "Anti-theft Transaction Tracking", "UPS & Power Redundancy Planning"]' AS `features`,
        'shield' AS `icon`,
        'Request Survey' AS `button_text`,
        'https://wa.me/8801572491828?text=Hello%20Codexxaa,%20I%20need%20Networking%20and%20CCTV%20Installation' AS `button_link`,
        5 AS `display_order`,
        'active' AS `status`
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM `more_services` WHERE `title` = 'Networking, CCTV & Security Integration'
);

INSERT INTO `more_services` (`title`, `subtitle`, `description`, `badge`, `features`, `icon`, `button_text`, `button_link`, `display_order`, `status`)
SELECT * FROM (
    SELECT 
        '24/7 Dedicated Support & SLA' AS `title`,
        'Round-the-clock priority assistance and onsite staff training' AS `subtitle`,
        'Premium enterprise SLA featuring direct WhatsApp engineer hotlines, on-site/remote staff onboarding, quarterly health inspections, and priority emergency response.' AS `description`,
        '24/7 SLA' AS `badge`,
        '["Under 15-Minute Response SLA", "Dedicated Technical Account Manager", "Unlimited Staff Training Sessions", "Quarterly System Health Audits"]' AS `features`,
        'headset' AS `icon`,
        'Contact Support' AS `button_text`,
        'https://wa.me/8801572491828?text=Hello%20Codexxaa,%20I%20want%20to%20learn%20about%2024/7%20Dedicated%20Support%20SLA' AS `button_link`,
        6 AS `display_order`,
        'active' AS `status`
) AS tmp
WHERE NOT EXISTS (
    SELECT 1 FROM `more_services` WHERE `title` = '24/7 Dedicated Support & SLA'
);
