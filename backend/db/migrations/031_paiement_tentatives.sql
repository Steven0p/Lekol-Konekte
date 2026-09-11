-- Suivi des tentatives de paiement mobile.
--
-- Jusqu'ici, une demande ne retenait qu'une seule référence plopplop
-- (paiements.reference_externe), écrasée à chaque relance. Or le bouton
-- « Réessayer » est proposé précisément quand le parent doute que sa première
-- tentative ait abouti — c'est-à-dire quand elle est le plus susceptible
-- d'être en cours de paiement. La tentative précédente devenait alors
-- introuvable : plopplop n'ayant pas de webhook, la seule façon d'apprendre
-- qu'une transaction a abouti est de l'interroger PAR SA RÉFÉRENCE. Une
-- référence écrasée = un paiement réellement débité qui ne sera jamais crédité.
--
-- Une ligne par démarrage, donc, et la vérification parcourt désormais toutes
-- les tentatives encore ouvertes d'une demande.
--
-- paiements.reference_externe est conservée (dernière référence connue,
-- affichée à l'économat) mais n'est plus la source de vérité : la garder évite
-- une fenêtre d'erreurs si la migration est appliquée avant le redéploiement
-- du service.

CREATE TABLE IF NOT EXISTS paiement_tentatives (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  id_paiement            INT NOT NULL,
  methode                ENUM('moncash','natcash','kashpaw') NOT NULL,
  -- Référence générée côté serveur, unique, jamais fournie par le client.
  reference_externe      VARCHAR(64) NOT NULL,
  -- Identifiant de transaction renvoyé par plopplop une fois le paiement abouti.
  transaction_externe_id VARCHAR(64),
  -- ouverte      : démarrée, pas encore confirmée par l'agrégateur
  -- confirmee    : transaction aboutie ET imputée à la demande
  -- non_imputee  : transaction aboutie mais NON imputée (demande déjà réglée
  --                par une autre tentative, montant divergent, ou transaction
  --                déjà utilisée ailleurs). À traiter par l'économat.
  statut                 ENUM('ouverte','confirmee','non_imputee') NOT NULL DEFAULT 'ouverte',
  -- Montant réellement envoyé à l'agrégateur (gourdes entières : plopplop
  -- rejette les décimales). C'est à lui que le montant confirmé est comparé.
  montant_envoye         INT NOT NULL,
  montant_confirme       DECIMAL(10,2),
  cree_le                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verifiee_le            DATETIME,
  UNIQUE KEY uq_tentatives_reference (reference_externe),
  UNIQUE KEY uq_tentatives_transaction (transaction_externe_id),
  KEY idx_tentatives_ouvertes (statut, cree_le),
  FOREIGN KEY (id_paiement) REFERENCES paiements(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Reprise des tentatives déjà enregistrées, pour ne pas perdre les paiements
-- mobiles en cours au moment de la migration.
INSERT INTO paiement_tentatives
  (id_paiement, methode, reference_externe, transaction_externe_id, statut, montant_envoye, montant_confirme)
SELECT
  p.id,
  p.methode_paiement,
  p.reference_externe,
  p.transaction_externe_id,
  CASE WHEN p.transaction_externe_id IS NOT NULL THEN 'confirmee' ELSE 'ouverte' END,
  CEIL(p.montant),
  CASE WHEN p.transaction_externe_id IS NOT NULL THEN p.montant ELSE NULL END
FROM paiements p
WHERE p.methode_paiement <> 'manuel'
  AND p.reference_externe IS NOT NULL;
