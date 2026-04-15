-- ============================================================
-- TRUEPAYID DATABASE SCHEMA
-- Purpose: Trust, Intelligence & Fraud Prevention Layer for UPI
-- ============================================================

CREATE DATABASE IF NOT EXISTS truepayid CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE truepayid;

-- ============================================================
-- USERS TABLE
-- Core identity for every registered UPI entity
-- ============================================================
CREATE TABLE users (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    upi_id                VARCHAR(100) NOT NULL UNIQUE,
    phone                 VARCHAR(15)  NOT NULL UNIQUE,
    email                 VARCHAR(255) NOT NULL UNIQUE,
    full_name             VARCHAR(255) NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,
    transaction_pin_hash  VARCHAR(255),
    is_verified           BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    elderly_mode          BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_upi   (upi_id),
    INDEX idx_users_phone (phone),
    INDEX idx_users_email (email)
) ENGINE=InnoDB;

-- ============================================================
-- AUTH TOKENS TABLE
-- JWT refresh tokens + OTP management
-- ============================================================
CREATE TABLE auth_tokens (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      INT UNSIGNED NOT NULL,
    token_type   ENUM('refresh','otp','reset') NOT NULL,
    token_hash   VARCHAR(512) NOT NULL,
    expires_at   DATETIME     NOT NULL,
    is_used      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_auth_user   (user_id),
    INDEX idx_auth_token  (token_hash(64)),
    INDEX idx_auth_expiry (expires_at)
) ENGINE=InnoDB;

-- ============================================================
-- TRUST SCORES TABLE
-- Dynamic per-user trust rating (0–100), updated on events
-- ============================================================
CREATE TABLE trust_scores (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id        INT UNSIGNED NOT NULL UNIQUE,
    score          TINYINT UNSIGNED NOT NULL DEFAULT 50 CHECK (score BETWEEN 0 AND 100),
    level          ENUM('Unrated','Low','Medium','High','Excellent') NOT NULL DEFAULT 'Unrated',
    fraud_count    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    report_count   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    tx_count       INT UNSIGNED NOT NULL DEFAULT 0,
    last_updated   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ts_user  (user_id),
    INDEX idx_ts_score (score)
) ENGINE=InnoDB;

-- ============================================================
-- LOCATION HISTORY TABLE
-- City-level location tracking to detect anomalies
-- ============================================================
CREATE TABLE location_history (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    INT UNSIGNED NOT NULL,
    city       VARCHAR(100) NOT NULL,
    region     VARCHAR(100),
    country    VARCHAR(100) NOT NULL DEFAULT 'India',
    ip_hash    VARCHAR(64),           -- hashed for privacy
    frequency  INT UNSIGNED NOT NULL DEFAULT 1,
    last_seen  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_city (user_id, city),
    INDEX idx_loc_user (user_id)
) ENGINE=InnoDB;

-- ============================================================
-- TOKENIZED INTENTS TABLE
-- Delay tokens issued for high-risk / high-amount transactions
-- ============================================================
CREATE TABLE tokenized_intents (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    token           VARCHAR(64)  NOT NULL UNIQUE,
    sender_id       INT UNSIGNED NOT NULL,
    receiver_upi    VARCHAR(100) NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    notes           TEXT,
    risk_score      TINYINT UNSIGNED NOT NULL DEFAULT 0,
    risk_level      ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Low',
    status          ENUM('pending','confirmed','denied','expired') NOT NULL DEFAULT 'pending',
    expires_at      DATETIME NOT NULL,
    decided_at      DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ti_token  (token),
    INDEX idx_ti_sender (sender_id),
    INDEX idx_ti_status (status),
    INDEX idx_ti_expiry (expires_at)
) ENGINE=InnoDB;

-- ============================================================
-- TRANSACTIONS TABLE
-- Immutable record of every completed/failed transaction intent
-- ============================================================
CREATE TABLE transactions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sender_id       INT UNSIGNED NOT NULL,
    receiver_upi    VARCHAR(100) NOT NULL,
    receiver_id     INT UNSIGNED,          -- NULL if receiver not registered
    amount          DECIMAL(12,2) NOT NULL,
    notes           TEXT,
    risk_score      TINYINT UNSIGNED NOT NULL DEFAULT 0,
    risk_level      ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Low',
    status          ENUM('initiated','token_pending','completed','denied','failed') NOT NULL DEFAULT 'initiated',
    token_id        INT UNSIGNED,           -- linked tokenized intent if used
    sender_city     VARCHAR(100),
    receiver_city   VARCHAR(100),
    location_mismatch BOOLEAN NOT NULL DEFAULT FALSE,
    ai_features_json  JSON,               -- snapshot of features used for scoring
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id)   REFERENCES users(id)              ON DELETE RESTRICT,
    FOREIGN KEY (receiver_id) REFERENCES users(id)              ON DELETE SET NULL,
    FOREIGN KEY (token_id)    REFERENCES tokenized_intents(id)  ON DELETE SET NULL,
    INDEX idx_tx_sender   (sender_id),
    INDEX idx_tx_receiver (receiver_upi),
    INDEX idx_tx_status   (status),
    INDEX idx_tx_created  (created_at),
    INDEX idx_tx_risk     (risk_level)
) ENGINE=InnoDB;

-- ============================================================
-- FRAUD REPORTS TABLE
-- User-submitted fraud reports — feeds trust score algorithm
-- ============================================================
CREATE TABLE fraud_reports (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reporter_id         INT UNSIGNED NOT NULL,
    reported_upi        VARCHAR(100) NOT NULL,
    reported_id         INT UNSIGNED,
    category            ENUM('fake_identity','unauthorized','phishing','social_engineering','other') NOT NULL,
    custom_attack_type  VARCHAR(255),
    description         TEXT NOT NULL,
    transaction_id      INT UNSIGNED,
    status              ENUM('pending','reviewed','actioned','dismissed') NOT NULL DEFAULT 'pending',
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id)    REFERENCES users(id)        ON DELETE CASCADE,
    FOREIGN KEY (reported_id)    REFERENCES users(id)        ON DELETE SET NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
    INDEX idx_fr_reporter (reporter_id),
    INDEX idx_fr_reported (reported_upi),
    INDEX idx_fr_status   (status)
) ENGINE=InnoDB;

-- ============================================================
-- EMAIL LOGS TABLE
-- Tracks every outbound email for audit / deduplication
-- ============================================================
CREATE TABLE email_logs (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      INT UNSIGNED,
    recipient    VARCHAR(255) NOT NULL,
    email_type   ENUM('otp','login_alert','tx_initiated','high_risk','token_created','tx_result','fraud_report') NOT NULL,
    subject      VARCHAR(255) NOT NULL,
    status       ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
    error_msg    TEXT,
    sent_at      DATETIME,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_el_user   (user_id),
    INDEX idx_el_type   (email_type),
    INDEX idx_el_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- AUDIT LOGS TABLE
-- Immutable audit trail for every significant system action
-- ============================================================
CREATE TABLE audit_logs (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   INT UNSIGNED,
    details     JSON,
    ip_hash     VARCHAR(64),
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_al_user   (user_id),
    INDEX idx_al_action (action),
    INDEX idx_al_entity (entity_type, entity_id),
    INDEX idx_al_time   (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- INITIAL SEED: default trust score row created on user signup
-- (handled in application layer via SQLAlchemy event / service)
-- ============================================================
