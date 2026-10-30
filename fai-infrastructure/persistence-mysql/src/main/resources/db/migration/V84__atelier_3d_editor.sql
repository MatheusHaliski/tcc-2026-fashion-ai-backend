-- GLB originals remain encrypted, private and immutable. Public project visibility
-- does not grant source-file access. Deleting a project erases its 3D work as well.
CREATE TABLE atelier_3d_assets (
 id CHAR(36) PRIMARY KEY, created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL,
 created_by VARCHAR(80), last_modified_by VARCHAR(80), project_id CHAR(36) NOT NULL,
 filename VARCHAR(160) NOT NULL, sha256 CHAR(64) NOT NULL, bytes INT NOT NULL,
 inspection_json LONGTEXT NOT NULL, content_base64 LONGTEXT NOT NULL,
 CONSTRAINT fk_atelier_asset_project FOREIGN KEY(project_id) REFERENCES atelier_projects(id) ON DELETE CASCADE
);
CREATE TABLE atelier_3d_versions (
 id CHAR(36) PRIMARY KEY, created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL,
 created_by VARCHAR(80), last_modified_by VARCHAR(80), project_id CHAR(36) NOT NULL,
 asset_id CHAR(36) NOT NULL, sequence_number BIGINT NOT NULL, author VARCHAR(160) NOT NULL,
 request_id VARCHAR(80) NOT NULL, digest CHAR(64) NOT NULL,
 document_json LONGTEXT NOT NULL, gender_evidence_json LONGTEXT NOT NULL, tipo_look_id CHAR(36),
 CONSTRAINT uq_atelier_scene_sequence UNIQUE(project_id,sequence_number),
 CONSTRAINT uq_atelier_scene_request UNIQUE(project_id,request_id),
 CONSTRAINT fk_atelier_scene_project FOREIGN KEY(project_id) REFERENCES atelier_projects(id) ON DELETE CASCADE,
 CONSTRAINT fk_atelier_scene_asset FOREIGN KEY(asset_id) REFERENCES atelier_3d_assets(id) ON DELETE CASCADE,
 CONSTRAINT fk_atelier_scene_tipo FOREIGN KEY(tipo_look_id) REFERENCES TipoLook(id) ON DELETE SET NULL
);
CREATE TABLE atelier_3d_guests (
 id CHAR(36) PRIMARY KEY, created_at DATETIME(6) NOT NULL, updated_at DATETIME(6) NOT NULL,
 created_by VARCHAR(80), last_modified_by VARCHAR(80), project_id CHAR(36) NOT NULL,
 token_hash CHAR(64) NOT NULL, label VARCHAR(80) NOT NULL, role VARCHAR(16) NOT NULL,
 expires_at DATETIME(6) NOT NULL, revoked_at DATETIME(6), allow_export BOOLEAN NOT NULL DEFAULT FALSE,
 CONSTRAINT fk_atelier_guest_project FOREIGN KEY(project_id) REFERENCES atelier_projects(id) ON DELETE CASCADE
);
