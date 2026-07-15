-- Migration 003 — Module Inscription
-- Ajoute un commentaire (motif de refus / demande de complément) à l'historique de statut.
-- Exécuter : mysql -u root -p lekol_konekte < db/migrations/003_inscription.sql
USE lekol_konekte;

ALTER TABLE historique_statut
  ADD COLUMN commentaire VARCHAR(500) AFTER nouveau_statut;
