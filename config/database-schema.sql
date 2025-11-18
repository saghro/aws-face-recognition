-- ============================================================================
-- Schéma de la base faces_db
-- Provisionne la table principale utilisée par Lambda et par l’application web
-- ============================================================================

CREATE DATABASE IF NOT EXISTS faces_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE faces_db;

CREATE TABLE IF NOT EXISTS person (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lastname VARCHAR(190) NOT NULL,
  firstname VARCHAR(190) NOT NULL,
  identity VARCHAR(255) DEFAULT NULL,
  object_key VARCHAR(512) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_person_name (lastname, firstname),
  UNIQUE KEY uniq_identity (identity),
  KEY idx_object_key (object_key(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Utilisateur applicatif (adapter HOST et mot de passe aux besoins)
CREATE USER IF NOT EXISTS 'mydbuser'@'%' IDENTIFIED BY 'MySecurePassword123!';
GRANT SELECT, INSERT, UPDATE, DELETE ON faces_db.person TO 'mydbuser'@'%';
FLUSH PRIVILEGES;
