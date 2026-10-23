-- Collaborative specifications only: this migration creates no checkout, manufacturing approval,
-- Aura license, verification badge, balance, or automatic reward.
-- Author UUIDs are historical pseudonymous attribution; account labels resolve at read time.
-- Owner erasure deletes its project and all dependent records; account deletion removes memberships/votes.
-- No private uploads or public storage URLs are introduced here.

CREATE TABLE atelier_projects (
    id CHAR(36) NOT NULL PRIMARY KEY,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80),
    last_modified_by VARCHAR(80),
    version BIGINT NOT NULL DEFAULT 0,
    owner_id CHAR(36) NOT NULL,
    title VARCHAR(160) NOT NULL,
    brief VARCHAR(4000) NOT NULL,
    visibility VARCHAR(20) NOT NULL,
    state VARCHAR(35) NOT NULL,
    specification_json LONGTEXT NOT NULL,
    latest_revision_id CHAR(36),
    revision_number INT NOT NULL DEFAULT 0,
    creation_key VARCHAR(80) NOT NULL,
    activity_at DATETIME(6) NOT NULL,
    CONSTRAINT uq_atelier_creation UNIQUE(owner_id, creation_key),
    CONSTRAINT fk_atelier_owner FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX ix_atelier_owner_activity(owner_id,activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE atelier_project_members (
    id CHAR(36) NOT NULL PRIMARY KEY,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80),
    last_modified_by VARCHAR(80),
    version BIGINT NOT NULL DEFAULT 0,
    project_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    role VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    accepted_at DATETIME(6),
    CONSTRAINT uq_atelier_member UNIQUE(project_id,user_id),
    CONSTRAINT fk_atelier_member_project FOREIGN KEY(project_id) REFERENCES atelier_projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_atelier_member_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX ix_atelier_invites(user_id,status,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE atelier_project_revisions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80),
    last_modified_by VARCHAR(80),
    project_id CHAR(36) NOT NULL,
    parent_revision_id CHAR(36),
    source_revision_id CHAR(36),
    author_id CHAR(36) NOT NULL,
    number INT NOT NULL,
    title VARCHAR(160) NOT NULL,
    brief VARCHAR(4000) NOT NULL,
    specification_json LONGTEXT NOT NULL,
    request_id VARCHAR(80) NOT NULL,
    request_digest VARCHAR(64) NOT NULL,
    contribution_license VARCHAR(60) NOT NULL,
    voting_ends_at DATETIME(6),
    CONSTRAINT uq_atelier_revision_number UNIQUE(project_id,number),
    CONSTRAINT uq_atelier_revision_request UNIQUE(project_id,request_id),
    CONSTRAINT fk_atelier_revision_project FOREIGN KEY(project_id) REFERENCES atelier_projects(id) ON DELETE CASCADE,
    INDEX ix_atelier_revision_author(author_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE atelier_project_comments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80),
    last_modified_by VARCHAR(80),
    project_id CHAR(36) NOT NULL,
    revision_id CHAR(36) NOT NULL,
    author_id CHAR(36) NOT NULL,
    anchor VARCHAR(100) NOT NULL,
    body VARCHAR(4000) NOT NULL,
    request_id VARCHAR(80) NOT NULL,
    CONSTRAINT uq_atelier_comment_request UNIQUE(project_id,author_id,request_id),
    CONSTRAINT fk_atelier_comment_project FOREIGN KEY(project_id) REFERENCES atelier_projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_atelier_comment_revision FOREIGN KEY(revision_id) REFERENCES atelier_project_revisions(id) ON DELETE CASCADE,
    INDEX ix_atelier_comments(project_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE atelier_project_reviews (
    id CHAR(36) NOT NULL PRIMARY KEY,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80),
    last_modified_by VARCHAR(80),
    project_id CHAR(36) NOT NULL,
    revision_id CHAR(36) NOT NULL,
    author_id CHAR(36) NOT NULL,
    decision VARCHAR(30) NOT NULL,
    notes VARCHAR(4000) NOT NULL,
    request_id VARCHAR(80) NOT NULL,
    CONSTRAINT uq_atelier_review_request UNIQUE(project_id,author_id,request_id),
    CONSTRAINT fk_atelier_review_project FOREIGN KEY(project_id) REFERENCES atelier_projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_atelier_review_revision FOREIGN KEY(revision_id) REFERENCES atelier_project_revisions(id) ON DELETE CASCADE,
    INDEX ix_atelier_reviews(project_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE atelier_project_votes (
    id CHAR(36) NOT NULL PRIMARY KEY,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by VARCHAR(80),
    last_modified_by VARCHAR(80),
    version BIGINT NOT NULL DEFAULT 0,
    project_id CHAR(36) NOT NULL,
    revision_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    interested BOOLEAN NOT NULL,
    CONSTRAINT uq_atelier_vote UNIQUE(revision_id,user_id),
    CONSTRAINT fk_atelier_vote_project FOREIGN KEY(project_id) REFERENCES atelier_projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_atelier_vote_revision FOREIGN KEY(revision_id) REFERENCES atelier_project_revisions(id) ON DELETE CASCADE,
    CONSTRAINT fk_atelier_vote_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX ix_atelier_vote_count(revision_id,interested)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
