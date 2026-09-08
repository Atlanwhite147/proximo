# 🤝 Proximo

**Plateforme open source de vie de résidence (multi-résidences) : annonces entre voisins, signalements au syndic, discussions, invitations QR.**

Prêtez un outil, proposez un service, donnez ce qui vous encombre, signalez
une fuite — Proximo met en relation les habitants d'une même résidence,
**sans jamais révéler d'adresse exacte ni de coordonnées personnelles**.

[![Licence](https://img.shields.io/github/license/bounette14701-oss/proximo)](LICENSE)
[![CI](https://github.com/bounette14701-oss/proximo/actions/workflows/ci.yml/badge.svg)](https://github.com/bounette14701-oss/proximo/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![PostGIS](https://img.shields.io/badge/PostgreSQL%2016%20%2B%20PostGIS-4169E1?logo=postgresql)

---

## ✨ Fonctionnalités

### 👥 Comptes & accès

| Fonctionnalité | Description |
|---|---|
| **Inscription & connexion** | Email + mot de passe (Argon2id) ou Google — sessions JWT en cookies HTTP-only, refresh token révocable avec rotation, « Se souvenir de moi » (90 j) |
| **Connexion Google** | OAuth2 / OpenID Connect (bouton « Continuer avec Google »), identité vérifiée par Google |
| **Validation des membres** | Nouveaux comptes en attente (`PENDING`) jusqu'à validation par un admin (sauf emails déclarés administrateurs) ; suspension, réactivation et suppression depuis le back-office |
| **Rôles** | Habitant (`USER`), administrateur local (`ADMIN`, gère **sa** résidence) ou **`SUPERADMIN`** (plateforme, toutes les résidences) — élévation/rétrogradation depuis le back-office (garde-fous : impossible de se modifier soi-même) |
| **Multi-résidences** | Chaque résidence a son **code d'accès** et ses invitations QR ; l'inscription est rattachée à la résidence du code ou du jeton. Le **SUPERADMIN** gère toutes les résidences (création, membres, paramètres, interrupteurs mail) depuis sa console « Toutes les résidences » |
| **Double authentification (admin)** | TOTP optionnelle et recommandée (Google Authenticator / Authy) — QR code au premier setup, vérification stricte du code à 6 chiffres à la connexion, activable dans Sécurité du compte |

### 📦 Annonces entre voisins

| Fonctionnalité | Description |
|---|---|
| **Publication** | 5 catégories : prêt de matériel (🔧), service entre voisins (🤝), don (🎁), avis aux résidents (📢), autre — avec titre, description, bâtiment/étage (au choix), résidence |
| **Gestion** | Modifier, clôturer, supprimer (propriétaire) — les annonces fermées restent visibles sur leur lien direct |
| **Recherche** | Par mot-clé (titre/description) et par catégorie, pagination |
| **Option « notifier la résidence »** | Case à cocher à la publication (défaut : désactivée) — si cochée, tous les habitants reçoivent un email avec l'annonce (si l'interrupteur « nouvelle annonce » de la résidence est actif) |

### 🛠️ Signalements au syndic

| Fonctionnalité | Description |
|---|---|
| **Déclaration** | Catégories : fuite d'eau, panne d'ascenseur, dégradation, autre — avec localisation libre (hall, étage, parking…) et **jusqu'à 5 pièces jointes** (JPG/PNG/WEBP/PDF, 10 Mo max chacune) |
| **Alerte agence automatique** | Email récapitulatif à **l'adresse de l'agence de la résidence** **avec les pièces jointes attachées** (type, localisation, auteur, description) |
| **Alerte habitants** | Email « nouveau signalement » à **tous les habitants** (avec pièces jointes) — piloté par les interrupteurs mail de la résidence |
| **Suivi** | Statut visible : nouveau / en cours / résolu — n'importe quel habitant peut marquer un signalement traité (le déclarant est prévenu par email) |
| **Visibilité** | Chaque signalement a sa page détail publique (habitants ACTIVE) avec ses pièces jointes téléchargeables |

### 💬 Discussions (annonces & signalements)

| Fonctionnalité | Description |
|---|---|
| **Fil de commentaires** | Chaque annonce et chaque signalement a **sa discussion dédiée** — questions, précisions, retours entre voisins |
| **Compteur** | Badge « 💬 N » sur les cartes des listes et de l'accueil pour repérer les discussions actives |
| **Modération** | L'auteur du commentaire ou un admin peut supprimer ; 20 commentaires/min max par utilisateur |

### 📲 Invitations & vie de la résidence

| Fonctionnalité | Description |
|---|---|
| **Invitations par QR code** | Lien d'invitation lié à la résidence, usage unique et expirable (72 h) — page d'atterrissage expliquant Proximo (annonces, signalements, messagerie), le déroulement en 3 étapes (compte → validation → accès direct) et l'ajout à l'écran d'accueil du téléphone |
| **Accès mobile** | Onglet « Admin » dans la barre de navigation mobile pour les admins ; aide contextuelle « 📲 Ajouter Proximo à l'écran d'accueil » (étapes iOS Safari / Android Chrome) |
| **Messagerie 1-1** | Conversations privées entre voisins, messages non lus, marquage lu — depuis le profil du propriétaire d'une annonce |
| **Accueil personnalisé** | Dernières annonces, signalements en cours, accès rapides — réservé aux membres validés |

### ✉️ Emails & notifications

| Fonctionnalité | Description |
|---|---|
| **Transport (superadmin)** | **Brevo** (API transactionnelle, recommandé) ou **SMTP** générique (Nodemailer), expéditeur et **email de test** — configuré par le SUPERADMIN dans Réglages → Envoi d'emails |
| **Interrupteurs par résidence** | 3 interrupteurs gérés par l'admin local (Réglages) ou le SUPERADMIN (console résidences) : signalement → agence, signalement → habitants, annonce → habitants |
| **Quota Brevo & file d'attente** | Le plan gratuit Brevo (300 emails/jour) est surveillé : compteur restant affiché dans l'admin, et si le quota est atteint les emails partent dans une **file d'attente** (`EmailOutbox`) avec **renvoi automatique** (~10 min après réinitialisation) + bouton « Renvoyer maintenant » — aucun email perdu |
| **Opt-out individuel** | Chaque habitant peut désactiver ses emails de masse (signalements, annonces) depuis son profil |
| **Templates sobres** | Emails au design épuré (bleu électrique `#0052FF`, CSS inline compatible Gmail/Outlook), objet préfixé du nom de résidence, **pièces jointes attachées** aux mails agence et habitants |

### 🛡️ Sécurité & vie privée

| Fonctionnalité | Description |
|---|---|
| **Confidentialité** | L'adresse exacte, les emails et coordonnées des habitants ne sont **jamais** exposés via l'API publique — les listings n'exposent pas l'email du propriétaire, les signalements non plus |
| **Sessions** | Cookies HTTP-only + SameSite=Lax + Secure (HTTPS), refresh tokens hashés (SHA-256) révocables avec rotation (détection de rejeu) |
| **Protections** | Argon2id, validation stricte (whitelist + rejet des champs inconnus), SQL paramétré, anti-CSRF, rate limiting par IP, Helmet + CSP, uploads filtrés (MIME + extension + taille + noms UUID) |
| **Back-office protégé** | Les routes admin exigent le rôle ADMIN (scopé à sa résidence) ou SUPERADMIN, + 2FA vérifiée dans la session si activée |

## 🧱 Stack technique

- **Frontend** — Next.js 14 (App Router) + Tailwind CSS, rendu autonome (standalone)
- **Backend** — NestJS 10 (TypeScript strict), validation stricte des entrées (class-validator)
- **Base de données** — PostgreSQL 16 + PostGIS 3.4, ORM Prisma 5
- **Infrastructure** — Docker Compose, Nginx en reverse proxy
- **Aucun composant d'intelligence artificielle** — zéro dépendance LLM, par conception

## 📁 Architecture

```
proximo/
├── .github/workflows/ci.yml   # CI : lint, tests, builds, images Docker
├── docker-compose.yml         # Orchestration complète (db, backend, frontend, nginx)
├── nginx/nginx.conf           # Reverse proxy (/ → frontend, /api → backend)
├── backend/                   # API NestJS
│   ├── prisma/schema.prisma   # Modèle (Residence, User, Listing, Incident,
│   │                          #  EmailSettings, EmailOutbox, Invitation…)
│   ├── prisma/migrations/     # Migrations SQL versionnées
│   └── src/
│       ├── auth/              # JWT + cookies HTTP-only, rotation, Google OAuth2, 2FA TOTP
│       ├── listings/          # Annonces + recherche (PostGIS)
│       ├── comments/          # Discussions publiques (annonces & signalements)
│       ├── messages/          # Messagerie 1-1 + notifications email
│       ├── incidents/         # Signalements syndic + pièces jointes (upload sécurisé)
│       ├── invitations/       # Invitations QR (jeton usage unique / expirable)
│       ├── admin/             # Back-office (multi-résidences, membres, rôles,
│       │                      #  résidences, interrupteurs mail)
│       ├── email/             # Emails transactionnels (Brevo / SMTP, templates,
│       │                      #  quota 300/j + file d'attente EmailOutbox)
│       ├── users/             # Profils + réglages de notification
│       └── common/            # Guards : JWT, rôles, statut, admin, anti-CSRF, rate limiting
└── frontend/                  # Next.js (App Router)
    │    └── src/app/               # Pages : accueil, annonces, messagerie, signalements,
    │                               #          admin (multi-résidences), rejoindre (QR), install
```

## 🚀 Démarrage rapide (1 commande)

**Prérequis :** Docker ≥ 24 avec le plugin Compose v2.

```bash
# Installation complète : vérifie Docker, génère un .env sécurisé
# (secrets aléatoires), tire les images pré-buildées (ou compile),
# démarre la stack et ouvre l'assistant d'installation.
curl -fsSL https://raw.githubusercontent.com/bounette14701-oss/proximo/main/install.sh | bash
```

…ou en version « manuelle » :

```bash
git clone https://github.com/bounette14701-oss/proximo.git
cd proximo
./install.sh --yes      # non interactif ; voir ./install.sh --help
```

L'application est alors disponible sur **http://localhost:8080** — au premier
lancement, vous êtes redirigé vers **`/install`** : l'assistant crée votre
compte administrateur et configure le nom de la résidence en 2 minutes.
Ensuite, connectez-vous et invitez vos voisins (QR code).

> **Images pré-buildées :** la CI publie `ghcr.io/bounette14701-oss/proximo-{backend,frontend}`.
> `install.sh` les télécharge automatiquement (pas de compilation) et retombe
> sur un build local si elles n'existent pas encore.

```bash
docker compose ps        # état des services
docker compose logs -f   # journaux
docker compose down      # arrêt (les données sont conservées)
docker compose down -v   # arrêt + suppression des données
```

## ⚙️ Installation manuelle (sans script)

```bash
git clone https://github.com/bounette14701-oss/proximo.git
cd proximo
cp .env.example .env
# Générer des secrets robustes :
#   openssl rand -hex 32   → POSTGRES_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
docker compose up -d --build
```

Ouvrez **http://localhost:8080** → redirection automatique vers `/install`.

## ☁️ Déploiement sur Oracle Cloud Always Free (gratuit)

Le script [`scripts/deploy-oracle.sh`](scripts/deploy-oracle.sh) déploie Proximo
sur une VM **Oracle Cloud Always Free** (2 VM 1 OCPU/1 Go RAM gratuites pour
toujours) — il installe Docker, clone le dépôt, génère un `.env` sécurisé,
démarre la stack et vérifie l'API, le tout via SSH :

```bash
# Depuis votre machine — remplacez par l'IP publique de votre VM
./scripts/deploy-oracle.sh --host 129.146.xx.xx \
  --user opc \
  --domain proximo.residence.fr \
  --tunnel-token <token-cloudflare>   # optionnel : expose en HTTPS via Cloudflare
```

- **Sans tunnel** : l'app répond sur `http://IP:8080` (HTTP seulement) ;
- **Avec tunnel** (`--tunnel-token`) : ajoutez le Public Hostname dans
  Zero Trust → Networks → Tunnels → service `http://localhost:8080`
  — vous n'avez alors **pas besoin d'ouvrir le port 8080** dans la Security List.
- Après déploiement : ouvrez `https://votre-domaine` → l'assistant `/install`
  crée le compte admin et le nom de la résidence.

📖 **Guide pas à pas complet** (création du compte Oracle, clé SSH, VM,
tunnel, Security List, pièges Always Free) :
**[docs/DEPLOY_ORACLE.md](docs/DEPLOY_ORACLE.md)**

**Security List Oracle** : seul le port 22 (SSH) est nécessaire si vous passez
par un tunnel Cloudflare ; sinon ouvrez aussi `8080` (Instance → Security Lists).

## 🔐 Configuration

| Variable | Description | Défaut |
|---|---|---|
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL (**obligatoire**) | — |
| `JWT_ACCESS_SECRET` | Secret de signature du token d'accès (**obligatoire**) | — |
| `JWT_REFRESH_SECRET` | Secret du refresh token (**obligatoire**) | — |
| `CORS_ORIGINS` | Origines autorisées (séparées par des virgules) | `http://localhost:3000` |
| `JWT_ACCESS_TTL` | Durée de vie du token d'accès (s) | `900` (15 min) |
| `JWT_REFRESH_TTL` | Durée de vie du refresh token (s) | `2592000` (30 j) |
| `BREVO_API_KEY` | Clé API Brevo (envoi transactionnel, recommandé) | *(vide → mode simulé)* |
| `BREVO_FROM_EMAIL` / `BREVO_FROM_NAME` | Expéditeur des emails Brevo | `no-reply@proximo.local` / `Proximo` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Alternative SMTP (Nodemailer) | *(vide)* |
| `NEXT_PUBLIC_API_URL` | URL de l'API vue par le navigateur (vide = même origine) | *(vide)* |
| `HTTP_PORT` | Port HTTP exposé | `8080` |

> **Sécurité :** aucun secret n'est versionné. Les fichiers `.env` sont ignorés
> par git. En production, pensez à HTTPS (TLS terminé sur le reverse proxy)
> — les cookies sont alors marqués `Secure` automatiquement.
>
> **Configuration par l'admin (sans SSH)** : le SUPERADMIN configure le
> transport (Réglages → Envoi d'emails : Brevo/SMTP, expéditeur, email de
> test, compteur Brevo et renvoi de la file d'attente) ; chaque admin local
> pilote les interrupteurs mail de sa résidence (Réglages), le SUPERADMIN
> ceux de toutes les résidences (console « Toutes les résidences »).

## 📡 API (résumé)

Toutes les routes sont préfixées par `/api`.

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | `/auth/register` | public (limitée) | Inscription — pose les cookies de session |
| POST | `/auth/login` | public (limitée) | Connexion (email ou Google) |
| POST | `/auth/refresh` | cookie refresh | Rotation de session |
| POST | `/auth/logout` | cookie refresh | Déconnexion + révocation |
| GET | `/auth/me` | connecté | Utilisateur courant |
| GET | `/listings` | compte validé | Recherche (catégorie, texte, pagination) |
| GET | `/listings/:id` | compte validé | Détail (résidence uniquement, pas d'adresse) |
| POST | `/listings` | connecté | Créer une annonce (+ option « notifier la résidence ») |
| PATCH | `/listings/:id` | propriétaire | Modifier / changer le statut |
| DELETE | `/listings/:id` | propriétaire | Supprimer |
| GET | `/incidents` | compte validé | Signalements (sans l'email des auteurs) |
| GET | `/incidents/:id/public` | compte validé | Détail public d'un signalement + pièces jointes |
| POST | `/incidents` | connecté (limitée) | Déclarer un signalement (+ photos) |
| PATCH | `/incidents/:id/resolve` | connecté | Marquer un signalement traité |
| GET | `/incidents/:id/attachments/:attachmentId` | compte validé | Télécharger une pièce jointe |
| GET | `/comments/listing/:id` | compte validé | Commentaires d'une annonce |
| GET | `/comments/incident/:id` | compte validé | Commentaires d'un signalement |
| POST | `/comments` | connecté (limitée) | Publier un commentaire |
| DELETE | `/comments/:id` | auteur/admin | Supprimer un commentaire |
| GET | `/messages` | connecté | Conversations + non-lus |
| GET | `/messages/:id` | participant | Fil de messages (marque lus) |
| POST | `/messages` | connecté (limitée) | Envoyer un message |
| GET | `/geocode?q=…` | public (limitée) | Recherche d'adresse (géocodage, repli si nécessaire) |
| GET | `/invitations/:token` | public | Consulter une invitation |
| POST | `/admin/invitations` | admin (2FA) | Générer une invitation + QR |
| GET | `/admin/residences` · POST | **SUPERADMIN** | Liste / créer une résidence (console plateforme) |
| PATCH | `/admin/residences/:id` | **SUPERADMIN** | Nom, code, agence, email syndic **+ interrupteurs mail de la résidence** |
| GET | `/admin/users` · PATCH · DELETE | admin (2FA) | Membres (validation, suspension, rôles) — scopé à la résidence de l'admin |
| GET | `/admin/settings` · PATCH | admin (2FA) | Réglages syndic de la résidence de l'admin (agence, email, interrupteurs mail) |
| GET | `/admin/email-settings` · PATCH | **SUPERADMIN** | Transport (Brevo/SMTP, expéditeur) + **quota Brevo et file d'attente** |
| POST | `/admin/email-settings/test` · `/flush` | **SUPERADMIN** | Email de test / **renvoyer la file d'attente** |
| GET | `/health` | public | Healthcheck (état API + base) |

## 🛡️ Sécurité

- **Mots de passe** hachés avec **Argon2id** (paramètres OWASP) — jamais stockés en clair
- **Tokens** en **cookies HTTP-only, `SameSite=Lax`, `Secure` en production** —
  inaccessible au JavaScript, protégé contre les attaques XSS
- **Refresh tokens** opaques, stockés **hashés (SHA-256)** en base, **révocables**,
  avec **rotation** à chaque utilisation (détection de rejeu)
- **Validation stricte** de toutes les entrées (class-validator, whitelist,
  rejet des champs inconnus) + anti-injection (requêtes SQL paramétrées Prisma)
- **Anti-CSRF** : vérification de l'origine des requêtes mutantes
- **Rate limiting** par IP réelle (derrière nginx) : 300 req/min global,
  limites renforcées sur l'authentification, la messagerie, les commentaires
  et le géocodage (login : 10/min)
- **En-têtes HTTP** durcis (Helmet + Nginx), pas de version exposée (`poweredByHeader: false`)
- **Uploads contrôlés** : MIME + extension vérifiés, taille max 10 Mo, nom de
  fichier généré côté serveur (UUID), fichiers invalides supprimés
- **Vie privée** : les coordonnées exactes, emails et adresses ne sortent
  jamais de l'API publique (listings et signalements sans email d'auteur)

## 💻 Développement local

```bash
# Base de données seule (PostGIS)
docker compose up -d db

# Backend (http://localhost:3001)
cd backend
npm install
cp ../.env.example ../.env   # puis ajuster DATABASE_URL en local
npx prisma migrate deploy
npm run start:dev

# Frontend (http://localhost:3000)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > .env.local
npm run dev
```

## ✅ Qualité & CI

Chaque push sur `main` (et chaque pull request) déclenche :

1. **Backend** : lint (ESLint, zéro warning) → tests unitaires (Jest) → build
2. **Frontend** : lint (ESLint) → build
3. **Docker** : validation `docker compose config` → **publication des images
   sur GHCR** (`ghcr.io/bounette14701-oss/proximo-{backend,frontend}`,
   tags `latest` + `sha-…`) — ces images sont utilisées par `install.sh`

```bash
cd backend && npm run lint && npm test && npm run build
cd frontend && npm run lint && npm run build
```

## 📄 Licence

Distribué sous licence **Apache 2.0** — voir [LICENSE](LICENSE).
Contributions bienvenues : consultez [CONTRIBUTING.md](CONTRIBUTING.md).
