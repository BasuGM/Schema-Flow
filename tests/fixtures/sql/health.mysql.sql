-- SchemaFlow fixture: schema health checks (MySQL twin). InnoDB indexes every foreign key, so no
-- unindexed-fk finding is expected even though no KEY is declared. Expected: 1 missing PK (log_entries).

CREATE TABLE `users` (
  `id` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `orders` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `log_entries` (
  `order_id` int NOT NULL,
  `message` text,
  CONSTRAINT `fk_log_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
) ENGINE=InnoDB;
