-- ============================================================
-- CohabiConnect — Migration initiale Supabase
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- TABLE : utilisateurs (profils inscrits)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS utilisateurs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ DEFAULT now(),

  -- Identité
  prenom        TEXT NOT NULL,
  nom           TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  telephone     TEXT NOT NULL,
  whatsapp      TEXT,
  etablissement TEXT NOT NULL,
  filiere       TEXT,
  genre         TEXT CHECK (genre IN ('homme','femme','autre')),

  -- Rôle sur la plateforme
  role          TEXT NOT NULL CHECK (role IN ('chercheur','proprietaire')),

  -- Photo de profil (base64 ou URL Supabase Storage)
  photo_url     TEXT,

  -- Préférences de vie
  preferences   JSONB DEFAULT '{}',

  -- Statut compte
  statut        TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','actif','suspendu','rejete'))
);

-- ────────────────────────────────────────────────────────────
-- TABLE : paiements (frais d'inscription 2000 FCFA)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paiements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ DEFAULT now(),

  utilisateur_id  UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
  reference       TEXT UNIQUE NOT NULL,          -- ex: CCI-A3F9K2
  operateur       TEXT NOT NULL CHECK (operateur IN ('wave','mtn','orange','moov')),
  numero_payeur   TEXT NOT NULL,
  montant         INTEGER NOT NULL DEFAULT 2000,

  -- Validation admin
  statut          TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','valide','rejete')),
  valide_par      TEXT,                          -- identifiant admin
  valide_at       TIMESTAMPTZ,
  rejete_at       TIMESTAMPTZ,
  note_admin      TEXT,

  -- Email de confirmation
  email_envoye    BOOLEAN DEFAULT false,
  email_envoye_at TIMESTAMPTZ
);

-- ────────────────────────────────────────────────────────────
-- TABLE : logements (proposés par les propriétaires)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ DEFAULT now(),

  proprietaire_id UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
  titre           TEXT NOT NULL,
  description     TEXT,
  adresse         TEXT NOT NULL,
  quartier        TEXT,
  loyer_total     INTEGER NOT NULL,
  nb_colocataires INTEGER DEFAULT 2,
  disponible_le   DATE,
  photos          TEXT[] DEFAULT '{}',
  equipements     JSONB DEFAULT '[]',
  statut          TEXT DEFAULT 'disponible' CHECK (statut IN ('disponible','complet','suspendu'))
);

-- ────────────────────────────────────────────────────────────
-- TABLE : matchings (entre chercheurs)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matchings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ DEFAULT now(),

  demandeur_id    UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
  cible_id        UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
  score           NUMERIC(5,2),                  -- % compatibilité
  statut          TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','accepte','refuse')),

  UNIQUE(demandeur_id, cible_id)
);

-- ────────────────────────────────────────────────────────────
-- TABLE : signalements / médiation
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signalements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ DEFAULT now(),

  auteur_id       UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cible_id        UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  type_probleme   TEXT NOT NULL,
  description     TEXT,
  urgence         TEXT DEFAULT 'normale' CHECK (urgence IN ('faible','normale','urgente')),
  statut          TEXT DEFAULT 'ouvert' CHECK (statut IN ('ouvert','en_cours','cloture')),
  resolu_at       TIMESTAMPTZ
);

-- ────────────────────────────────────────────────────────────
-- TABLE : notifications (historique)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ DEFAULT now(),

  utilisateur_id  UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,                 -- 'paiement_valide', 'nouveau_match', etc.
  titre           TEXT NOT NULL,
  message         TEXT,
  lu              BOOLEAN DEFAULT false,
  metadata        JSONB DEFAULT '{}'
);

-- ────────────────────────────────────────────────────────────
-- INDEX
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_paiements_statut       ON paiements(statut);
CREATE INDEX IF NOT EXISTS idx_paiements_utilisateur  ON paiements(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_email     ON utilisateurs(email);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_statut    ON utilisateurs(statut);
CREATE INDEX IF NOT EXISTS idx_matchings_demandeur    ON matchings(demandeur_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_lu  ON notifications(utilisateur_id, lu);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────
ALTER TABLE utilisateurs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE logements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE signalements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;

-- Politique : service_role bypass (pour les API routes Vercel côté serveur)
CREATE POLICY "service_role_all_utilisateurs"  ON utilisateurs    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_paiements"     ON paiements       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_logements"     ON logements       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_matchings"     ON matchings       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_signalements"  ON signalements    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_notifications" ON notifications   FOR ALL USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- TRIGGER : auto-créer notification quand paiement validé
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notifier_validation_paiement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.statut = 'valide' AND OLD.statut = 'en_attente' THEN
    INSERT INTO notifications (utilisateur_id, type, titre, message, metadata)
    VALUES (
      NEW.utilisateur_id,
      'paiement_valide',
      'Inscription validée !',
      'Votre paiement de 2 000 FCFA a été validé. Bienvenue sur CohabiConnect !',
      jsonb_build_object('reference', NEW.reference, 'operateur', NEW.operateur, 'montant', NEW.montant)
    );
    -- Activer le compte utilisateur
    UPDATE utilisateurs SET statut = 'actif' WHERE id = NEW.utilisateur_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_validation_paiement
  AFTER UPDATE ON paiements
  FOR EACH ROW
  EXECUTE FUNCTION notifier_validation_paiement();

-- ────────────────────────────────────────────────────────────
-- DONNÉES DE TEST (optionnel — commenter en production)
-- ────────────────────────────────────────────────────────────
/*
INSERT INTO utilisateurs (prenom, nom, email, telephone, etablissement, filiere, genre, role) VALUES
  ('Aminata',   'Koné',      'aminata.kone@uao.ci',     '+225 07 12 34 56 78', 'UAO Bouaké',    'L2 Droit',          'femme', 'chercheur'),
  ('Moussa',    'Traoré',    'moussa.traore@uao.ci',    '+225 05 98 76 54 32', 'INP-HB',        'L3 Génie Civil',    'homme', 'proprietaire'),
  ('Fatoumata', 'Diallo',    'fatoumata.d@uvci.ci',     '+225 01 45 67 89 01', 'UVCI',          'M1 Finance',        'femme', 'chercheur');

INSERT INTO paiements (utilisateur_id, reference, operateur, numero_payeur) VALUES
  ((SELECT id FROM utilisateurs WHERE email = 'aminata.kone@uao.ci'),   'CCI-A3F9K2', 'wave',   '+225 07 12 34 56 78'),
  ((SELECT id FROM utilisateurs WHERE email = 'moussa.traore@uao.ci'),  'CCI-B7D2M1', 'mtn',    '+225 05 98 76 54 32'),
  ((SELECT id FROM utilisateurs WHERE email = 'fatoumata.d@uvci.ci'),   'CCI-C1E5P9', 'orange', '+225 01 45 67 89 01');
*/
