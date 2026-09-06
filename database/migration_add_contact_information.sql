-- Migration for Contact Information Management
-- Adds table for contact_information

-- -----------------------------------------------------
-- Table `contact_information`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `contact_information` (
  `id` INT AUTO_INCREMENT,
  `email_addresses` JSON NULL,
  `phone_numbers` JSON NULL,
  `address` TEXT NULL,
  `map_url` TEXT NULL,
  `business_hours` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default contact information
INSERT INTO `contact_information` (`email_addresses`, `phone_numbers`, `address`, `business_hours`) VALUES 
(
  '["info@pos-system.com", "support@pos-system.com"]',
  '["+1 (555) 123-4567", "+1 (555) 987-6543"]',
  '123 Business Avenue, Suite 100
San Francisco, CA 94102
United States',
  '{"saturday_thursday": "9:00 AM - 6:00 PM", "friday": "Closed"}'
);
