-- QA-008: SQLite allows columns without a type.
CREATE TABLE t (id int primary key, name, note);
CREATE TABLE u (
  id INTEGER PRIMARY KEY,
  t_id REFERENCES t (id),
  label
);
