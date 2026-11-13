import type { DraftColumn, DraftSchema } from "@/domain/schema/draft";
import { normalizeSchema } from "@/domain/schema/normalize";
import type { ColumnDefault, Schema } from "@/domain/schema/types";

const now: ColumnDefault = { kind: "function", value: "now()" };
const identity: ColumnDefault = { kind: "autoincrement", value: "identity" };
const lit = (value: string): ColumnDefault => ({ kind: "literal", value });

const id = (type = "bigint"): DraftColumn => ({
  name: "id",
  type,
  nullable: false,
  primaryKey: true,
  default: identity,
});
const createdAt: DraftColumn = {
  name: "created_at",
  type: "timestamptz",
  nullable: false,
  default: now,
};

/**
 * Hand-written e-commerce schema used as the default sample. It deliberately covers:
 * self-reference (categories.parent_id), a composite PK join table (product_categories),
 * a composite PK (order_items), a 1:1 via unique FK (payments.order_id), enums, arrays,
 * defaults, nullable columns, indexes, unique/check constraints, and a table with no PK and
 * no relationships (audit_log) for future health checks.
 */
export const ecommerceDraft: DraftSchema = {
  name: "E-commerce sample",
  source: { format: "sample", dialect: "postgresql", importedAt: "2026-01-01T00:00:00.000Z" },
  defaultSchemaName: "public",
  enums: [
    { name: "order_status", values: ["pending", "paid", "shipped", "delivered", "cancelled"] },
    { name: "payment_method", values: ["card", "paypal", "bank_transfer"] },
  ],
  tables: [
    {
      name: "users",
      comment: "Registered customers and staff.",
      columns: [
        id(),
        { name: "email", type: "varchar(255)", nullable: false, unique: true },
        { name: "full_name", type: "text", nullable: false },
        { name: "password_hash", type: "text", nullable: false },
        { name: "is_admin", type: "boolean", nullable: false, default: lit("false") },
        createdAt,
        { name: "deleted_at", type: "timestamptz" },
      ],
    },
    {
      name: "addresses",
      columns: [
        id(),
        {
          name: "user_id",
          type: "bigint",
          nullable: false,
          references: { table: "users", onDelete: "cascade" },
        },
        { name: "label", type: "varchar(50)" },
        { name: "line1", type: "text", nullable: false },
        { name: "line2", type: "text" },
        { name: "city", type: "text", nullable: false },
        { name: "postal_code", type: "varchar(20)", nullable: false },
        { name: "country", type: "char(2)", nullable: false, default: lit("'US'") },
      ],
      indexes: [{ name: "addresses_user_id_idx", columns: ["user_id"] }],
    },
    {
      name: "categories",
      columns: [
        id("integer"),
        {
          name: "parent_id",
          type: "integer",
          references: { table: "categories", name: "categories_parent_fk", onDelete: "set null" },
        },
        { name: "name", type: "varchar(100)", nullable: false },
        { name: "slug", type: "varchar(120)", nullable: false, unique: true },
      ],
    },
    {
      name: "products",
      columns: [
        id(),
        { name: "sku", type: "varchar(64)", nullable: false, unique: true },
        { name: "name", type: "text", nullable: false },
        { name: "description", type: "text" },
        { name: "price_cents", type: "integer", nullable: false },
        { name: "currency", type: "char(3)", nullable: false, default: lit("'USD'") },
        { name: "stock", type: "integer", nullable: false, default: lit("0") },
        { name: "tags", type: "text[]" },
        createdAt,
      ],
      checkConstraints: [
        { name: "products_price_check", expression: "price_cents >= 0" },
        { name: "products_stock_check", expression: "stock >= 0" },
      ],
      indexes: [{ name: "products_name_idx", columns: ["name"] }],
    },
    {
      name: "product_categories",
      columns: [
        {
          name: "product_id",
          type: "bigint",
          nullable: false,
          references: { table: "products", onDelete: "cascade" },
        },
        {
          name: "category_id",
          type: "integer",
          nullable: false,
          references: { table: "categories", onDelete: "cascade" },
        },
      ],
      primaryKey: { name: "product_categories_pkey", columns: ["product_id", "category_id"] },
    },
    {
      name: "coupons",
      columns: [
        id("integer"),
        { name: "code", type: "varchar(32)", nullable: false, unique: true },
        { name: "percent_off", type: "numeric(5, 2)", nullable: false },
        {
          name: "valid_from",
          type: "date",
          nullable: false,
          default: { kind: "expression", value: "CURRENT_DATE" },
        },
        { name: "valid_until", type: "date" },
        { name: "max_uses", type: "integer" },
      ],
      checkConstraints: [
        { name: "coupons_percent_check", expression: "percent_off > 0 AND percent_off <= 100" },
      ],
    },
    {
      name: "orders",
      columns: [
        id(),
        {
          name: "user_id",
          type: "bigint",
          nullable: false,
          references: { table: "users", name: "orders_user_fk", onDelete: "restrict" },
        },
        {
          name: "shipping_address_id",
          type: "bigint",
          references: { table: "addresses", onDelete: "set null" },
        },
        { name: "coupon_id", type: "integer", references: { table: "coupons" } },
        { name: "status", type: "order_status", nullable: false, default: lit("'pending'") },
        { name: "total_cents", type: "integer", nullable: false },
        { name: "placed_at", type: "timestamptz", nullable: false, default: now },
      ],
      indexes: [{ name: "orders_user_status_idx", columns: ["user_id", "status"] }],
    },
    {
      name: "order_items",
      columns: [
        { name: "order_id", type: "bigint", nullable: false },
        { name: "line_no", type: "smallint", nullable: false },
        { name: "product_id", type: "bigint", nullable: false },
        { name: "quantity", type: "integer", nullable: false, default: lit("1") },
        { name: "unit_price_cents", type: "integer", nullable: false },
      ],
      primaryKey: { name: "order_items_pkey", columns: ["order_id", "line_no"] },
      foreignKeys: [
        {
          name: "order_items_order_fk",
          columns: ["order_id"],
          references: { table: "orders", columns: ["id"] },
          onDelete: "cascade",
        },
        {
          name: "order_items_product_fk",
          columns: ["product_id"],
          references: { table: "products", columns: ["id"] },
        },
      ],
      checkConstraints: [{ name: "order_items_quantity_check", expression: "quantity > 0" }],
    },
    {
      name: "payments",
      columns: [
        id(),
        {
          name: "order_id",
          type: "bigint",
          nullable: false,
          unique: true,
          references: { table: "orders", name: "payments_order_fk" },
        },
        { name: "method", type: "payment_method", nullable: false },
        { name: "amount_cents", type: "integer", nullable: false },
        { name: "provider_ref", type: "varchar(128)" },
        { name: "paid_at", type: "timestamptz" },
      ],
    },
    {
      name: "shipments",
      columns: [
        id(),
        { name: "order_id", type: "bigint", nullable: false, references: { table: "orders" } },
        { name: "carrier", type: "varchar(50)", nullable: false },
        { name: "tracking_number", type: "varchar(64)" },
        { name: "shipped_at", type: "timestamptz" },
        { name: "delivered_at", type: "timestamptz" },
      ],
    },
    {
      name: "reviews",
      columns: [
        id(),
        {
          name: "product_id",
          type: "bigint",
          nullable: false,
          references: { table: "products", onDelete: "cascade" },
        },
        {
          name: "user_id",
          type: "bigint",
          nullable: false,
          references: { table: "users", onDelete: "cascade" },
        },
        { name: "rating", type: "smallint", nullable: false },
        { name: "body", type: "text" },
        createdAt,
      ],
      uniqueConstraints: [{ name: "reviews_product_user_key", columns: ["product_id", "user_id"] }],
      checkConstraints: [{ name: "reviews_rating_check", expression: "rating BETWEEN 1 AND 5" }],
    },
    {
      name: "audit_log",
      comment: "Append-only event log. Intentionally has no primary key and no relationships.",
      columns: [
        { name: "occurred_at", type: "timestamptz", nullable: false, default: now },
        { name: "actor", type: "text" },
        { name: "action", type: "varchar(50)", nullable: false },
        { name: "entity", type: "text", nullable: false },
        { name: "payload", type: "jsonb" },
      ],
    },
  ],
};

export function createEcommerceSchema(): Schema {
  return normalizeSchema(ecommerceDraft);
}
