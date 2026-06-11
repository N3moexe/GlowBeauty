# 🚀 GlowBeauty — Plan de mise en ligne (Railway)

> Objectif : passer du mode démo local à une vraie boutique en ligne.
> Durée estimée : ~1 heure pour les étapes 1–4. Les étapes 5–6 dépendent
> de délais externes (comptes marchands, domaine).

---

## Étape 1 — Créer le compte et le projet Railway (~10 min)

1. Va sur **https://railway.app** → "Login with GitHub" (utilise le compte N3moexe).
2. Clique **New Project** → **Deploy from GitHub repo** → choisis `N3moexe/GlowBeauty`.
3. Branche à déployer : `feat/glowbeauty-rebrand-and-cms-persistence`
   (ou `main` après merge — recommandé).
4. Railway détecte automatiquement Node.js. Vérifie dans Settings :
   - **Build command** : `pnpm build`
   - **Start command** : `pnpm start`

## Étape 2 — Ajouter la base de données MySQL (~5 min)

1. Dans le projet Railway : **+ New** → **Database** → **MySQL**.
2. Une fois créée, ouvre l'onglet **Variables** de la base et copie `MYSQL_URL`.
3. Dans le service GlowBeauty → **Variables** → ajoute :
   - `DATABASE_URL` = (colle la valeur de MYSQL_URL)

## Étape 3 — Variables d'environnement (~10 min)

Dans le service GlowBeauty → **Variables**, ajoute :

| Variable | Valeur | Note |
|---|---|---|
| `NODE_ENV` | `production` | obligatoire |
| `JWT_SECRET` | (64 caractères aléatoires) | génère avec : `openssl rand -hex 32` |
| `APP_URL` | `https://glowbeauty.com` | ton domaine final |
| ~~`ALLOW_DEV_ADMIN`~~ | ❌ NE PAS AJOUTER | backdoor dev uniquement |

## Étape 4 — Migrations + compte admin (~10 min)

1. Dans Railway → service GlowBeauty → onglet **Settings** → note l'URL
   temporaire (`xxx.up.railway.app`).
2. Lance les migrations depuis ton PC (Git Bash) :
   ```bash
   cd /c/Users/nemo/Downloads/senbonsplans
   DATABASE_URL="<colle l'URL MySQL Railway>" pnpm db:push
   DATABASE_URL="<colle l'URL MySQL Railway>" pnpm setup:admin
   ```
3. Ouvre `https://xxx.up.railway.app/admin` → connecte-toi avec le compte
   admin créé → vérifie que les réglages se sauvegardent (ils persistent
   maintenant, plus de mode démo !).
4. ⚠️ Le catalogue démarre VIDE en production (les 14 produits démo ne sont
   pas copiés). Ajoute tes vrais produits via Admin → Produits.

## Étape 5 — Domaine (~15 min + délai DNS)

1. Railway → Settings → **Domains** → **Custom Domain** → `glowbeauty.com`.
2. Chez ton registrar (ex. Namecheap, OVH) : ajoute le CNAME que Railway affiche.
3. HTTPS est automatique. Vérifie `https://glowbeauty.com/sitemap.xml`.
4. **Google Search Console** : ajoute la propriété → soumets le sitemap.

## Étape 6 — Paiements & e-mails (délais externes)

### Wave (recommandé en premier — le plus simple au Sénégal)
1. Crée un compte **Wave Business** : https://business.wave.com
2. Demande l'accès API (Wave Checkout) → récupère la clé.
3. Railway Variables : `WAVE_API_KEY` = ta clé.
4. Active "Wave" dans Admin → Réglages → Paiements.

### Orange Money (ensuite)
1. https://developer.orange.com → Orange Money Web Payment.
2. Railway Variables : `ORANGE_MONEY_API_KEY`.

### E-mails de confirmation (SMTP)
Option simple : **Brevo** (gratuit jusqu'à 300 mails/jour) :
1. Compte sur https://brevo.com → SMTP & API → récupère les identifiants.
2. Railway Variables :
   - `SMTP_HOST` = `smtp-relay.brevo.com`
   - `SMTP_PORT` = `587`
   - `SMTP_USER` / `SMTP_PASS` = identifiants Brevo

---

## ✅ Checklist finale avant ouverture

- [ ] Commander un produit test de bout en bout (panier → paiement → mail)
- [ ] Vérifier l'admin sur téléphone (le thème est responsive)
- [ ] `https://glowbeauty.com/produit/<slug-inexistant>` renvoie bien 404
- [ ] Search Console : sitemap soumis, aucune erreur de couverture
- [ ] Supprimer les produits/données de test

## 💰 Coût estimé

| Service | Prix |
|---|---|
| Railway (app + MySQL) | ~5–10 $/mois |
| Domaine glowbeauty.com | ~12 $/an |
| Brevo (e-mails) | Gratuit |
| Wave Business | Commission par transaction |

---
*Généré le 11 juin 2026 — le code est prêt (build ✅, 170 tests ✅, SEO ✅).*
