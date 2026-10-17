CREATE TABLE flair_adventure_sessions (
 id CHAR(36) NOT NULL PRIMARY KEY,
 owner_id CHAR(36) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
 state_json JSON NOT NULL,
 created_at TIMESTAMP(6) NOT NULL,
 updated_at TIMESTAMP(6) NOT NULL,
 created_by VARCHAR(80),
 last_modified_by VARCHAR(80),
 version BIGINT NOT NULL DEFAULT 0,
 KEY idx_flair_adventure_owner_status(owner_id,status,created_at),
 CONSTRAINT fk_flair_adventure_owner FOREIGN KEY(owner_id) REFERENCES users(id)
);
