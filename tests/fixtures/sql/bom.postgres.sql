CREATE TABLE users (id int primary key);
-- QA-007: this file starts with a UTF-8 byte-order mark (EF BB BF).
CREATE TABLE posts (id int primary key, user_id int references users (id));
CREATE VIEW recent_posts AS SELECT * FROM posts;
