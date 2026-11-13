-- SchemaFlow fixture: edge cases for the SQL importer.
/* A block comment with a semicolon; and /* a nested comment; */ that is still a comment; */
CREATE TABLE "Order Lines" (
  "LineID" serial PRIMARY KEY,
  "UserID" integer REFERENCES users,
  note text DEFAULT 'it''s; fine',
  "weird ""quoted"" col" text
);

CREATE TABLE users (id integer PRIMARY KEY, name text);

CREATE SCHEMA billing;

CREATE TABLE billing.invoices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users (id),
  status billing.invoice_status,
  ghost_id integer REFERENCES ghosts (id)
);

CREATE FUNCTION public.answer() RETURNS integer LANGUAGE sql AS $body$ SELECT 41; SELECT 42; $body$;

CREATE VIEW active_users AS SELECT * FROM users WHERE name <> ';';

GRANT SELECT ON users TO reporting;

CREATE TABLE USERS (id int);

CREATE TABLE broken (id int REFERENCES);

CREATE INDEX ON users (lower(name));
