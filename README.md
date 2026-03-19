# CohabiConnect — Backend API

Backend de la plateforme CohabiConnect (cohabitation solidaire étudiante · Bouaké).  
Stack : **Supabase** (base de données PostgreSQL) + **Vercel** (API serverless) + **Resend** (emails).

---

## Structure du projet

```
cohabiconnect-backend/
├── api/
│   ├── inscription.js          # POST   Créer un utilisateur + paiement
│   ├── utilisateurs.js         # GET    Profil utilisateur
│   ├── matching.js             # GET    Matchs de colocataires
│   ├── signalement.js          # GET/POST/PATCH  Médiation
│   ├── notifications.js        # GET/PATCH  Notifications
│   └── admin/
│       ├── paiements.js        # GET    Liste paiements (admin)
│       └── valider.js          # POST   Valider/rejeter + email (admin)
├── lib/
│   ├── supabase.js             # Client Supabase (service_role)
│   └── email.js                # Envoi email via Resend
├── supabase/
│   └── migrations/
│       └── 001_init.sql        # Schéma complet (tables, RLS, triggers)
├── public/
│   └── (placer CohabiConnect.html ici)
├── .env.example
├── .gitignore
├── vercel.json
└── package.json
```

---

## Étape 1 — Configurer Supabase

1. Créer un compte sur [supabase.com](https://supabase.com) → **New Project**
2. Nommer le projet `cohabiconnect`, choisir la région **Europe (Frankfurt)**
3. Dans **SQL Editor**, copier-coller le contenu de `supabase/migrations/001_init.sql` et exécuter
4. Dans **Settings > API**, copier :
   - `Project URL` → `SUPABASE_URL`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Étape 2 — Configurer Resend (emails)

1. Créer un compte sur [resend.com](https://resend.com)
2. **Domains** → ajouter `cohabiconnect.ci` et configurer les DNS (ou utiliser le domaine Resend par défaut pour tester)
3. **API Keys** → créer une clé → `RESEND_API_KEY`

> Pour tester sans domaine vérifié, remplacer `FROM_EMAIL` par `onboarding@resend.dev`

---

## Étape 3 — Préparer le dépôt GitHub

```bash
# Dans le dossier cohabiconnect-backend
git init
git add .
git commit -m "Initial commit — CohabiConnect backend"

# Créer un repo sur github.com puis :
git remote add origin https://github.com/TON_USERNAME/cohabiconnect-backend.git
git branch -M main
git push -u origin main
```

> ⚠️ Vérifier que `.env` n'est PAS dans le commit (`git status`)

---

## Étape 4 — Déployer sur Vercel

### Méthode 1 — Interface Vercel (recommandé)

1. Aller sur [vercel.com](https://vercel.com) → **Add New Project**
2. Importer le repo GitHub `cohabiconnect-backend`
3. Dans **Environment Variables**, ajouter :

| Nom | Valeur |
|-----|--------|
| `SUPABASE_URL` | `https://XXXXX.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` |
| `ADMIN_SECRET_KEY` | `votre_cle_32_chars` |
| `RESEND_API_KEY` | `re_xxx` |
| `FROM_EMAIL` | `CohabiConnect <admin@cohabiconnect.ci>` |
| `APP_URL` | `https://cohabiconnect.vercel.app` |

4. Cliquer **Deploy** → l'URL publique s'affiche (ex: `https://cohabiconnect.vercel.app`)

### Méthode 2 — CLI Vercel

```bash
npm install -g vercel
vercel login
vercel                  # déploiement preview
vercel --prod           # déploiement production
```

---

## Référence des routes API

### Inscription utilisateur
```
POST /api/inscription
Content-Type: application/json

{
  "prenom": "Aminata",
  "nom": "Koné",
  "email": "aminata@uao.ci",
  "telephone": "+225 07 12 34 56 78",
  "etablissement": "UAO Bouaké",
  "filiere": "L2 Droit",
  "genre": "femme",
  "role": "chercheur",
  "operateur": "wave",
  "numeroPaiement": "+225 07 12 34 56 78",
  "reference": "CCI-A3F9K2"
}
```

### Admin — Liste paiements
```
GET /api/admin/paiements?statut=en_attente
x-admin-key: VOTRE_ADMIN_SECRET_KEY
```

### Admin — Valider un paiement (+ envoi email auto)
```
POST /api/admin/valider
x-admin-key: VOTRE_ADMIN_SECRET_KEY
Content-Type: application/json

{
  "paiementId": "uuid-du-paiement",
  "action": "valider",
  "note": "Paiement Wave confirmé"
}
```

### Admin — Rejeter un paiement
```
POST /api/admin/valider
x-admin-key: VOTRE_ADMIN_SECRET_KEY
Content-Type: application/json

{
  "paiementId": "uuid-du-paiement",
  "action": "rejeter",
  "note": "Numéro de référence incorrect"
}
```

### Matching
```
GET /api/matching?utilisateurId=uuid
```

### Signalement
```
POST /api/signalement
Content-Type: application/json

{
  "auteurId": "uuid",
  "cibleId": "uuid",
  "typeProbleme": "Conflit de cohabitation",
  "description": "...",
  "urgence": "normale"
}
```

### Notifications
```
GET  /api/notifications?utilisateurId=uuid
PATCH /api/notifications
Content-Type: application/json
{ "utilisateurId": "uuid" }   // toutes lues
{ "utilisateurId": "uuid", "notificationId": "uuid" }  // une seule
```

---

## Connecter le frontend HTML au backend

Dans `CohabiConnect.html`, après déploiement, remplacer la simulation de paiement par un vrai appel API :

```javascript
// Dans la fonction processPayment() — remplacer nextFStep(5) par :
async function soumettreInscription() {
  const response = await fetch('https://cohabiconnect.vercel.app/api/inscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prenom:        document.getElementById('field-prenom').value,
      nom:           document.getElementById('field-nom').value,
      email:         document.getElementById('field-email').value,
      telephone:     document.getElementById('field-tel').value,
      etablissement: document.getElementById('field-etab').value,
      role:          selectedRole,
      operateur:     selectedPayment,
      numeroPaiement: document.getElementById('payment-phone-input').value,
      reference:     generatedRef  // la ref générée côté client
    })
  })
  const data = await response.json()
  if (response.ok) {
    nextFStep(5)  // passer à confirmation
  } else {
    alert(data.error)
  }
}
```

---

## Sécurité

- La clé `SUPABASE_SERVICE_ROLE_KEY` ne doit **jamais** être exposée côté client
- Le header `x-admin-key` protège toutes les routes `/api/admin/*`
- Générer `ADMIN_SECRET_KEY` avec : `openssl rand -hex 32`
- Le fichier `.env` est dans `.gitignore` — ne jamais le committer

---

## Technologies

| Composant | Service | Gratuit jusqu'à |
|-----------|---------|-----------------|
| Base de données | Supabase (PostgreSQL) | 500 MB, 2 projets |
| API serverless | Vercel | 100 GB bandwidth/mois |
| Emails | Resend | 3 000 emails/mois |
| Hébergement frontend | Vercel Static | Illimité |
