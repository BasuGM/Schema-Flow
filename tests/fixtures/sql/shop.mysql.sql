-- SchemaFlow fixture: MySQL (mysqldump-like). Expected: 5 tables, 4 relationships.
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
# MySQL hash comment

CREATE TABLE `customers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(191) NOT NULL,
  `name` varchar(100) DEFAULT NULL COMMENT 'Display name; may be empty',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customers_email` (`email`),
  KEY `idx_customers_name` (`name`(20))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `products` (
  `id` int unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `sku` varchar(40) CHARACTER SET ascii NOT NULL,
  `price` decimal(10,2) unsigned NOT NULL DEFAULT '0.00',
  `status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
  UNIQUE INDEX `uq_products_sku` (`sku`)
) ENGINE=InnoDB;

CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` int unsigned NOT NULL,
  `placed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_orders_customer` (`customer_id`),
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `order_lines` (
  `order_id` bigint unsigned NOT NULL,
  `line_no` smallint NOT NULL,
  `product_id` int unsigned NOT NULL,
  `qty` int NOT NULL DEFAULT 1,
  PRIMARY KEY (`order_id`, `line_no`),
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
);

CREATE TABLE `customer_profiles` (
  `customer_id` int unsigned NOT NULL,
  `bio` text,
  PRIMARY KEY (`customer_id`)
);

ALTER TABLE `order_lines` ADD CONSTRAINT `fk_lines_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);
ALTER TABLE `customer_profiles` ADD CONSTRAINT `fk_profile_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`);
