-- FINORA : Bank Statement -> Filled ITR
-- MySQL 8 / MariaDB 10.4+ (XAMPP compatible)

CREATE DATABASE IF NOT EXISTS finora_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE finora_db;

-- 1. USERS & PROFILE ---------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(150) NULL UNIQUE,            -- login with email OR mobile; at least one required (checked in app)
  mobile        VARCHAR(15)  NULL UNIQUE,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  mobile_verified TINYINT(1) NOT NULL DEFAULT 0,
  password_hash VARCHAR(255) NULL,                   -- optional: customers log in with OTP only
  role          ENUM('customer','expert','admin') NOT NULL DEFAULT 'customer',
  is_verified   TINYINT(1) NOT NULL DEFAULT 0,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  last_login_ip VARCHAR(45) NULL,
  failed_otp_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until  DATETIME NULL,                      -- temporary lock after too many wrong OTPs
  mfa_secret    VARBINARY(255) NULL,                -- TOTP secret, AES encrypted in app
  mfa_enabled   TINYINT(1) NOT NULL DEFAULT 0,
  google_sub    VARCHAR(40) NULL UNIQUE,            -- Google account id, set on first Google sign-in
  mfa_backup_hashes TEXT NULL,                      -- JSON array of SHA-256 hashes of one-time backup codes
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- OTP login: one-time codes (store only a hash, never the plain OTP)
CREATE TABLE IF NOT EXISTS otp_codes (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NULL,                  -- NULL for first-time signup until verified
  channel     ENUM('mobile','email') NOT NULL,
  target      VARCHAR(150) NOT NULL,                 -- mobile number or email
  purpose     ENUM('login','signup','sensitive_action') NOT NULL DEFAULT 'login',
  otp_hash    CHAR(64) NOT NULL,                     -- HMAC-SHA256(otp, server secret)
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- max 5, then invalid
  expires_at  DATETIME NOT NULL,                    -- now + 5 minutes
  used_at     DATETIME NULL,
  request_ip  VARCHAR(45) NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_target (target, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Login sessions / devices (refresh tokens, "logout all devices")
CREATE TABLE IF NOT EXISTS login_sessions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  refresh_hash  CHAR(64) NOT NULL UNIQUE,            -- hash of refresh token
  device_info   VARCHAR(255) NULL,
  ip_address    VARCHAR(45) NULL,
  last_used_at  DATETIME NULL,
  expires_at    DATETIME NOT NULL,
  revoked_at    DATETIME NULL,
  rotated_at    DATETIME NULL,                       -- set when replaced by a newer token (vs. revoked outright)
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS taxpayer_profiles (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          BIGINT UNSIGNED NOT NULL,
  pan_encrypted    VARBINARY(255) NOT NULL,          -- AES encrypted in app
  pan_last4        CHAR(4) NOT NULL,                 -- for display only
  full_name        VARCHAR(120) NOT NULL,
  dob              DATE NOT NULL,
  residential_status ENUM('resident','nri','rnor') NOT NULL DEFAULT 'resident',
  occupation       ENUM('salaried','freelancer','business','investor','other') NOT NULL,
  address          VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 2. FILING CASE (one per user per assessment year) --------------------
CREATE TABLE IF NOT EXISTS itr_cases (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  assessment_year VARCHAR(9) NOT NULL,               -- e.g. 2026-27
  itr_form        ENUM('ITR-1','ITR-2','ITR-3','ITR-4','UNDECIDED') NOT NULL DEFAULT 'UNDECIDED',
  tax_regime      ENUM('old','new') NULL,
  status          ENUM('draft','processing','needs_review','ready','approved','filed','needs_expert')
                  NOT NULL DEFAULT 'draft',
  approved_hash   CHAR(64) NULL,                     -- fingerprint of the return the user approved
  approved_at     DATETIME NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_ay (user_id, assessment_year),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. DOCUMENTS ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id       BIGINT UNSIGNED NOT NULL,
  doc_type      ENUM('bank_statement','form16','ais','form26as','interest_cert','investment_proof','other') NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
  size_bytes    INT UNSIGNED NOT NULL DEFAULT 0,
  storage_path  VARCHAR(500) NOT NULL,
  file_hash     CHAR(64) NOT NULL,                   -- SHA-256, blocks duplicate upload
  status        ENUM('uploaded','processing','extracted','needs_review','accepted','rejected') NOT NULL DEFAULT 'uploaded',
  error_message VARCHAR(255) NULL,
  uploaded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_case_hash (case_id, file_hash),
  FOREIGN KEY (case_id) REFERENCES itr_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. BANK ACCOUNTS & TRANSACTIONS --------------------------------------
CREATE TABLE IF NOT EXISTS bank_accounts (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id      BIGINT UNSIGNED NOT NULL,
  bank_name    VARCHAR(80) NOT NULL,
  account_last4 CHAR(4) NOT NULL,
  account_type ENUM('savings','current','salary') DEFAULT 'savings',
  FOREIGN KEY (case_id) REFERENCES itr_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id        SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code      VARCHAR(40) NOT NULL UNIQUE,
  label     VARCHAR(80) NOT NULL,
  tax_head  ENUM('salary','house_property','business','capital_gains','other_sources','deduction','tax_paid','not_taxable') NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bank_transactions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id       BIGINT UNSIGNED NOT NULL,
  account_id    BIGINT UNSIGNED NOT NULL,
  document_id   BIGINT UNSIGNED NOT NULL,
  txn_date      DATE NOT NULL,
  description   VARCHAR(500) NOT NULL,
  debit         DECIMAL(14,2) NOT NULL DEFAULT 0,
  credit        DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance       DECIMAL(14,2) NULL,
  source_page   SMALLINT NULL,                       -- evidence location
  source_row    INT NULL,
  category_id   SMALLINT UNSIGNED NULL,
  ai_confidence DECIMAL(4,3) NULL,                   -- 0.000 - 1.000
  classified_by ENUM('rule','ai','user') NULL,
  class_reason  VARCHAR(160) NULL,                   -- why this category was suggested
  user_status   ENUM('unreviewed','confirmed','corrected','ignored') NOT NULL DEFAULT 'unreviewed',
  dup_hash      CHAR(64) NOT NULL,                   -- date+amount+desc hash
  KEY idx_case_date (case_id, txn_date),
  KEY idx_review (case_id, user_status),
  UNIQUE KEY uq_dup (account_id, dup_hash),
  FOREIGN KEY (case_id)     REFERENCES itr_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id)  REFERENCES bank_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB;

-- 5. TAX DOCUMENT DATA (Form 16, AIS, 26AS) ----------------------------
CREATE TABLE IF NOT EXISTS tax_facts (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id      BIGINT UNSIGNED NOT NULL,
  fact_key     VARCHAR(60) NOT NULL,                 -- gross_salary, tds_salary, interest_savings, 80c ...
  amount       DECIMAL(14,2) NOT NULL,
  source       ENUM('bank_txn','form16','ais','form26as','user') NOT NULL,
  document_id  BIGINT UNSIGNED NULL,
  confirmed    TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_fact (case_id, fact_key, source),
  KEY idx_case_key (case_id, fact_key),
  FOREIGN KEY (case_id) REFERENCES itr_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reconciliation_items (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id     BIGINT UNSIGNED NOT NULL,
  rule_key    VARCHAR(40) NOT NULL,                  -- stable id of the reconciliation rule
  title       VARCHAR(150) NOT NULL,                 -- "Salary: bank vs Form 16"
  source_a    VARCHAR(60) NULL,
  source_b    VARCHAR(60) NULL,
  message     VARCHAR(300) NULL,                     -- plain-language explanation
  value_a     DECIMAL(14,2) NULL,
  value_b     DECIMAL(14,2) NULL,
  status      ENUM('matched','mismatch','missing','resolved','escalated') NOT NULL,
  resolution_note VARCHAR(255) NULL,
  UNIQUE KEY uq_case_rule (case_id, rule_key),
  FOREIGN KEY (case_id) REFERENCES itr_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. QUESTIONS ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id     BIGINT UNSIGNED NOT NULL,
  question_key VARCHAR(40) NOT NULL,
  topic       ENUM('profile','income','investments','deductions','tax_paid','other') NOT NULL,
  question    VARCHAR(300) NOT NULL,
  why_needed  VARCHAR(300) NOT NULL,
  answer      VARCHAR(500) NULL,
  answered_at DATETIME NULL,
  UNIQUE KEY uq_case_question (case_id, question_key),
  FOREIGN KEY (case_id) REFERENCES itr_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. RULES & CALCULATION (deterministic, versioned) --------------------
CREATE TABLE IF NOT EXISTS tax_rulesets (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assessment_year VARCHAR(9) NOT NULL,
  version         VARCHAR(10) NOT NULL,
  config_json     JSON NOT NULL,                     -- slabs, std deduction, rebate, cess
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_ay_ver (assessment_year, version)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tax_calculations (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id      BIGINT UNSIGNED NOT NULL,
  ruleset_id   INT UNSIGNED NOT NULL,
  regime       ENUM('old','new') NOT NULL,
  gross_income DECIMAL(14,2) NOT NULL,
  deductions   DECIMAL(14,2) NOT NULL,
  taxable_income DECIMAL(14,2) NOT NULL,
  tax_payable  DECIMAL(14,2) NOT NULL,
  tds_credit   DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_payable  DECIMAL(14,2) NOT NULL,               -- negative = refund
  trace_json   JSON NOT NULL,                        -- step by step explanation
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES itr_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (ruleset_id) REFERENCES tax_rulesets(id)
) ENGINE=InnoDB;

-- 8. ITR OUTPUT --------------------------------------------------------
CREATE TABLE IF NOT EXISTS itr_fields (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id     BIGINT UNSIGNED NOT NULL,
  section     VARCHAR(60) NOT NULL,                  -- "Schedule S", "Part B-TI"
  field_code  VARCHAR(80) NOT NULL,
  label       VARCHAR(100) NOT NULL DEFAULT '',
  field_value VARCHAR(255) NOT NULL,
  evidence    VARCHAR(160) NULL,                     -- where this value came from
  evidence_fact_id BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_case_field (case_id, section, field_code),
  FOREIGN KEY (case_id) REFERENCES itr_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS validation_results (
  id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id   BIGINT UNSIGNED NOT NULL,
  document_id BIGINT UNSIGNED NULL,                  -- set when the finding comes from one document
  level     VARCHAR(20) NULL,                        -- return validation level (structural, arithmetic, ...)
  code      VARCHAR(40) NULL,
  severity  ENUM('error','warning','info') NOT NULL,
  message   VARCHAR(300) NOT NULL,
  resolved  TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (case_id) REFERENCES itr_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. EXPERT / PAYMENT / AUDIT -----------------------------------------
CREATE TABLE IF NOT EXISTS expert_reviews (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id       BIGINT UNSIGNED NOT NULL,
  expert_id     BIGINT UNSIGNED NULL,
  status        ENUM('requested','in_review','changes_needed','approved','cancelled') NOT NULL DEFAULT 'requested',
  request_note  VARCHAR(500) NULL,
  reviewed_hash CHAR(64) NULL,                       -- fingerprint of the return the expert approved
  requested_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decided_at    DATETIME NULL,
  FOREIGN KEY (case_id) REFERENCES itr_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (expert_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_review_status (status, requested_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS review_messages (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  review_id   BIGINT UNSIGNED NOT NULL,
  author_id   BIGINT UNSIGNED NULL,
  author_role ENUM('customer','expert','admin') NOT NULL,
  body        VARCHAR(2000) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES expert_reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id    BIGINT UNSIGNED NOT NULL,
  plan       ENUM('self','assisted','expert') NOT NULL,
  amount     DECIMAL(10,2) NOT NULL,
  gateway_ref VARCHAR(100) NULL,
  status     ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES itr_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_events (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id    BIGINT UNSIGNED NULL,
  user_id    BIGINT UNSIGNED NULL,
  action     VARCHAR(80) NOT NULL,                   -- upload, confirm_txn, approve_itr ...
  detail     JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_case (case_id)
) ENGINE=InnoDB;

-- 10. SEED DATA --------------------------------------------------------
INSERT IGNORE INTO categories (code,label,tax_head) VALUES
 ('salary','Salary credit','salary'),
 ('business_receipt','Business / freelance receipt','business'),
 ('interest','Bank interest','other_sources'),
 ('dividend','Dividend','other_sources'),
 ('capital_gain','Share / MF sale','capital_gains'),
 ('rent_received','Rent received','house_property'),
 ('invest_80c','PPF / ELSS / LIC (80C)','deduction'),
 ('health_ins','Health insurance (80D)','deduction'),
 ('tax_paid','Advance tax / self-assessment tax','tax_paid'),
 ('own_transfer','Own account transfer','not_taxable'),
 ('loan','Loan / EMI','not_taxable'),
 ('personal','Personal expense','not_taxable'),
 ('investment_purchase','Investment purchase (SIP / shares)','not_taxable'),
 ('refund_reversal','Refund / reversal','not_taxable'),
 ('cash_txn','Cash deposit / withdrawal','not_taxable'),
 ('unknown','Needs your review','not_taxable');

-- Tax rulesets (slabs, rebates, caps) are seeded by the server on start: server/src/modules/tax/rulesets.js

-- 11. ACCOUNT SETTINGS & NOTIFICATIONS ---------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
  user_id           BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  notify_processed  TINYINT(1) NOT NULL DEFAULT 1,   -- "document processed" alerts
  notify_returns    TINYINT(1) NOT NULL DEFAULT 1,   -- approval / status changes
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  case_id    BIGINT UNSIGNED NULL,
  type       VARCHAR(40) NOT NULL,                   -- document_processed | return_approved | approval_withdrawn
  title      VARCHAR(150) NOT NULL,
  body       VARCHAR(300) NULL,
  link       VARCHAR(200) NULL,
  read_at    DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_unread (user_id, read_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_resets (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,              -- only the hash is stored; the token lives in the emailed link
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_verifications (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  code_hash  CHAR(64) NOT NULL,                     -- only a hash of the 6-digit code is stored
  attempts   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_verif_user (user_id, used_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS filing_submissions (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  case_id     BIGINT UNSIGNED NOT NULL UNIQUE,
  provider    VARCHAR(20) NOT NULL,                  -- manual today; an authorised ERI adapter later
  ack_number  VARCHAR(30) NOT NULL,                  -- acknowledgement number from the e-Filing portal
  filed_on    DATE NOT NULL,
  e_verified  TINYINT(1) NOT NULL DEFAULT 0,
  return_hash CHAR(64) NULL,                         -- fingerprint of the return that was approved
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES itr_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB;
