-- Schéma MySQL — Lekol Konekte
-- Étape 1 : Fondation + Auth
-- Étape 2 : Vérification courriel (OTP) + modèle de données complet
-- Exécuter : mysql -u root -p < db/schema.sql

CREATE DATABASE IF NOT EXISTS lekol_konekte
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lekol_konekte;

-- ============================================================
-- Comptes & authentification
-- ============================================================

-- utilisateurs : compte + rôle unique
CREATE TABLE IF NOT EXISTS utilisateurs (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  nom               VARCHAR(120) NOT NULL,
  courriel          VARCHAR(180) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  role              ENUM('parent','eleve','admin','direction') NOT NULL DEFAULT 'parent',
  statut            ENUM('actif','inactif') NOT NULL DEFAULT 'actif',
  courriel_verifie  TINYINT(1) NOT NULL DEFAULT 0,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- codes_verification : OTP pour vérifier le courriel (et, plus tard, réinit. mot de passe)
CREATE TABLE IF NOT EXISTS codes_verification (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  id_utilisateur INT NOT NULL,
  code_hash      VARCHAR(255) NOT NULL,
  type           ENUM('verification_courriel','reinitialisation_mdp') NOT NULL DEFAULT 'verification_courriel',
  tentatives     INT NOT NULL DEFAULT 0,
  utilise        TINYINT(1) NOT NULL DEFAULT 0,
  expire_le      DATETIME NOT NULL,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- parents : infos complémentaires liées à un utilisateur de rôle 'parent'
CREATE TABLE IF NOT EXISTS parents (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  id_utilisateur INT NOT NULL,
  telephone      VARCHAR(40),
  adresse        VARCHAR(255),
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- eleves : rattaché à un parent (au moins un)
CREATE TABLE IF NOT EXISTS eleves (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  id_parent          INT NOT NULL,
  nom                VARCHAR(120) NOT NULL,
  date_naissance     DATE,
  niveau             VARCHAR(60),
  statut_inscription ENUM('en_attente','accepte','refuse','confirmee') NOT NULL DEFAULT 'en_attente',
  FOREIGN KEY (id_parent) REFERENCES parents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Modèle métier (tables créées ; logique aux étapes suivantes)
-- ============================================================

CREATE TABLE IF NOT EXISTS ecole (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  nom                   VARCHAR(150) NOT NULL,
  coordonnees_bancaires VARCHAR(255),
  coordonnees_moncash   VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inscriptions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve        INT NOT NULL,
  annee_scolaire  VARCHAR(9) NOT NULL,
  statut          ENUM('en_attente','complement_demande','accepte','refuse','confirmee')
                    NOT NULL DEFAULT 'en_attente',
  date_soumission DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS documents_soumis (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  id_inscription      INT NOT NULL,
  type                ENUM('acte_naissance','bulletin','photo','autre') NOT NULL,
  url_fichier         VARCHAR(500) NOT NULL,
  statut_verification ENUM('en_attente','valide','rejete') NOT NULL DEFAULT 'en_attente',
  televerse_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_inscription) REFERENCES inscriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tarifs (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  type_frais     ENUM('inscription','releve','duplicata') NOT NULL,
  montant        DECIMAL(10,2) NOT NULL,
  devise         ENUM('HTG','USD') NOT NULL DEFAULT 'HTG',
  date_effective DATE NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS paiements (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  type_frais   ENUM('inscription','releve','duplicata') NOT NULL,
  id_reference INT NOT NULL,
  montant      DECIMAL(10,2) NOT NULL,
  devise       ENUM('HTG','USD') NOT NULL DEFAULT 'HTG',
  preuve_url   VARCHAR(500),
  statut       ENUM('en_attente','valide','rejete') NOT NULL DEFAULT 'en_attente',
  cree_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valide_par   INT,
  valide_le    DATETIME,
  FOREIGN KEY (valide_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS matieres (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL,
  niveau      VARCHAR(60) NOT NULL,
  coefficient DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  actif       TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uniq_matiere_niveau (nom, niveau)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notes (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve          INT NOT NULL,
  id_matiere        INT,
  matiere           VARCHAR(100) NOT NULL,
  periode           ENUM('1er_trimestre','2e_trimestre','3e_trimestre') NOT NULL,
  annee_scolaire    VARCHAR(9) NOT NULL,
  valeur            DECIMAL(5,2) NOT NULL,
  statut_validation ENUM('saisie','validee') NOT NULL DEFAULT 'saisie',
  saisie_par        INT,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (id_matiere) REFERENCES matieres(id) ON DELETE SET NULL,
  FOREIGN KEY (saisie_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS publications_notes (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  niveau         VARCHAR(60) NOT NULL,
  annee_scolaire VARCHAR(9) NOT NULL,
  trimestre      ENUM('1er_trimestre','2e_trimestre','3e_trimestre') NOT NULL,
  publie_par     INT,
  publie_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_publication (niveau, annee_scolaire, trimestre),
  FOREIGN KEY (publie_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS documents_officiels (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve           INT NOT NULL,
  type               ENUM('bulletin','releve','duplicata') NOT NULL,
  url_pdf            VARCHAR(500) NOT NULL,
  identifiant_unique VARCHAR(64) NOT NULL UNIQUE,
  date_generation    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Traçabilité : tout changement de statut (dossier, paiement, document)
CREATE TABLE IF NOT EXISTS historique_statut (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  entite         ENUM('inscription','paiement','document_soumis') NOT NULL,
  id_entite      INT NOT NULL,
  ancien_statut  VARCHAR(40),
  nouveau_statut VARCHAR(40) NOT NULL,
  commentaire    VARCHAR(500),
  id_auteur      INT,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_auteur) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;
