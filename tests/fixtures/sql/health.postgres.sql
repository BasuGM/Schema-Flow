-- SchemaFlow fixture: schema health checks (PostgreSQL).
-- Expected: 1 missing PK (order_items), 3 unindexed FKs (orders.user_id, order_items.order_id,
-- product_tags.tag_id), 2 orphans (audit_log, UserSessions), 1 naming finding (UserSessions).

CREATE TABLE users (
  id integer PRIMARY KEY,
  email text NOT NULL,
  full_name text
);

CREATE TABLE products (
  id integer PRIMARY KEY,
  name text NOT NULL,
  unit_price numeric(10, 2)
);

CREATE TABLE tags (
  id integer PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE orders (
  id integer PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users (id),
  placed_at timestamp
);

CREATE TABLE order_items (
  order_id integer NOT NULL REFERENCES orders (id),
  product_id integer NOT NULL REFERENCES products (id),
  quantity integer NOT NULL
);
CREATE INDEX idx_order_items_product ON order_items (product_id);

CREATE TABLE product_tags (
  product_id integer NOT NULL REFERENCES products (id),
  tag_id integer NOT NULL REFERENCES tags (id),
  PRIMARY KEY (product_id, tag_id)
);

CREATE TABLE invoices (
  id integer PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders (id),
  issued_on date
);
CREATE INDEX idx_invoices_order ON invoices (order_id);

CREATE TABLE audit_log (
  id integer PRIMARY KEY,
  message text
);

CREATE TABLE categories (
  id integer PRIMARY KEY,
  parent_id integer REFERENCES categories (id)
);
CREATE INDEX idx_categories_parent ON categories (parent_id);

CREATE TABLE "UserSessions" (
  id integer PRIMARY KEY,
  "userToken" text,
  "lastSeenAt" timestamp
);
