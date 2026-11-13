-- SchemaFlow fixture: SQLite. Expected: 4 tables, 3 relationships, 1 summary warning (PRAGMA).
PRAGMA foreign_keys = ON;

CREATE TABLE authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  published_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE [tags] (
  [id] INTEGER PRIMARY KEY,
  [label] TEXT NOT NULL UNIQUE
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
) WITHOUT ROWID;

CREATE INDEX idx_posts_author ON posts(author_id);
