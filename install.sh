#!/usr/bin/env bash
# ============================================================
# Proximo — Installation automatisée (Docker)
#
# Usage :
#   ./install.sh                 # interactif (recommandé)
#   ./install.sh --yes           # valeurs par défaut, non interactif
#   ./install.sh --port 8080     # personnaliser le port HTTP
#
# Ce script :
#   1. Vérifie Docker + Docker Compose (installation guidée si absent)
#   2. Génère un .env sécurisé (secrets aléatoires) s'il n'existe pas
#   3. Lance la stack (db + backend + frontend + nginx)
#   4. Attend que l'API soit prête et affiche l'URL
#   5. Rappelle d'ouvrir /install pour créer l'administrateur
# ============================================================
set -euo pipefail

# ─── Couleurs ────────────────────────────────────────────────
C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_BOLD=$'\033[1m'; C_RESET=$'\033[0m'
info()  { echo "${C_GREEN}✔${C_RESET} $*"; }
warn()  { echo "${C_YELLOW}⚠${C_RESET} $*"; }
error() { echo "${C_RED}✘${C_RESET} $*" >&2; }
title() { echo; echo "${C_BOLD}== $* ==${C_RESET}"; }

# ─── Options ─────────────────────────────────────────────────
ASSUME_YES=0
HTTP_PORT=8080
# Exécuté via « curl … | bash » : stdin est un pipe, l'interactif est
# impossible → on applique les valeurs par défaut.
if [[ ! -t 0 ]]; then
  ASSUME_YES=1
fi
while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) ASSUME_YES=1; shift ;;
    --port) HTTP_PORT="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --help|-h)
      cat <<'EOF'
Usage : ./install.sh [options]

Options :
  --yes        Non interactif (valeurs par défaut, pas d'édition du .env)
  --port PORT  Port HTTP exposé (défaut : 8080)
  --domain D   Domaine public (ex. proximo.example.com) — configure CORS/URLs

Sans option, le script pose les questions nécessaires (recommandé).
EOF
      exit 0 ;;
    *) error "Option inconnue : $1 (voir ./install.sh --help)"; exit 1 ;;
  esac
done

# ─── Prérequis : docker + compose ────────────────────────────
title "Vérification des prérequis"
command -v docker >/dev/null 2>&1 || { error "Docker n'est pas installé."; cat <<'EOF'

Installez Docker puis relancez ce script :
  https://docs.docker.com/engine/install/

Ou en une ligne (Linux) :
  curl -fsSL https://get.docker.com | sh
EOF
  exit 1; }
info "Docker présent : $(docker --version | awk '{print $3}' | tr -d ',')"

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
  info "Docker Compose présent (plugin)"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
  info "Docker Compose présent (standalone)"
else
  error "Docker Compose n'est pas installé (plugin 'compose' manquant)."
  exit 1
fi

# ─── Répertoire ──────────────────────────────────────────────
# Support du one-liner « curl | bash » : si le script n'est pas exécuté
# depuis un clone du dépôt (docker-compose.yml absent), on clone le dépôt.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
if [[ ! -f docker-compose.yml ]]; then
  warn "docker-compose.yml introuvable — clonage du dépôt…"
  if command -v git >/dev/null 2>&1; then
    git clone --depth 1 https://github.com/Atlanwhite147/proximo.git .
  else
    error "git n'est pas installé — impossible de récupérer le dépôt."
    error "Clonez le dépôt manuellement : git clone https://github.com/Atlanwhite147/proximo.git"
    exit 1
  fi
fi

# ─── .env ────────────────────────────────────────────────────
title "Configuration (.env)"
if [[ -f .env ]]; then
  info ".env existant — conservé tel quel."
  warn "Pour régénérer les secrets, supprimez .env et relancez."
else
  POSTGRES_PASSWORD="$(openssl rand -hex 32)"
  JWT_ACCESS_SECRET="$(openssl rand -hex 32)"
  JWT_REFRESH_SECRET="$(openssl rand -hex 32)"

  # Domaine optionnel : configure CORS + URLs publiques en conséquence.
  if [[ -n "${DOMAIN:-}" ]]; then
    PUBLIC_URL="https://${DOMAIN}"
    CORS_ORIGINS="${PUBLIC_URL}"
  else
    PUBLIC_URL="http://localhost:${HTTP_PORT}"
    CORS_ORIGINS="http://localhost:${HTTP_PORT}"
  fi

  cat > .env <<EOF
# Généré par install.sh le $(date -Iseconds) — gardez ce fichier secret.
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=2592000

# Origines autorisées (CORS + anti-CSRF).
CORS_ORIGINS=${CORS_ORIGINS}
HTTP_PORT=${HTTP_PORT}
APP_URL=${PUBLIC_URL}
FRONTEND_URL=${PUBLIC_URL}
API_URL=${PUBLIC_URL}/api

# Emails déclarés administrateurs dès l'inscription (optionnel).
ADMIN_EMAILS=

# Google OAuth (optionnel) — voir .env.example pour la configuration.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=

# Emails transactionnels — Brevo recommandé (optionnel).
BREVO_API_KEY=
BREVO_FROM_EMAIL=
BREVO_FROM_NAME=Proximo

# SMTP générique (optionnel, alternative à Brevo).
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Proximo <no-reply@proximo.local>
SYNDIC_EMAIL=
EOF
  chmod 600 .env
  info ".env généré avec des secrets aléatoires."
  if [[ "$ASSUME_YES" == "0" ]]; then
    echo
    read -r -p "Ouvrir le .env pour personnaliser (domaine, Google, emails) ? [o/N] " REP
    if [[ "${REP,,}" == "o" || "${REP,,}" == "oui" ]]; then
      ${EDITOR:-vi} .env
    fi
  fi
fi

# ─── Lancement ───────────────────────────────────────────────
title "Lancement de la stack (db + backend + frontend + nginx)"
# Images pré-buildées publiées sur GHCR par la CI : on les tire pour
# éviter la compilation. Si elles n'existent pas encore (tout premier
# déploiement avant le premier run CI), build local en secours.
if $COMPOSE pull >/dev/null 2>&1; then
  info "Images GHCR récupérées (pas de compilation)."
  $COMPOSE up -d
else
  warn "Images GHCR indisponibles — build local (quelques minutes)…"
  $COMPOSE up -d --build
fi

title "Vérification de l'API"
for i in $(seq 1 60); do
  if curl -fsS "http://localhost:${HTTP_PORT}/api/health" >/dev/null 2>&1; then
    info "API prête après ${i}×2 s"
    break
  fi
  sleep 2
  if [[ "$i" == "60" ]]; then
    error "L'API n'a pas démarré. Consultez les logs : $COMPOSE logs backend"
    exit 1
  fi
done

# ─── Récapitulatif ───────────────────────────────────────────
title "🎉 Proximo est installé"
echo "  ${C_BOLD}Ouvrez :${C_RESET}  http://localhost:${HTTP_PORT}"
echo "  ${C_BOLD}Étape 1 :${C_RESET} l'assistant d'installation (/install) crée"
echo "            votre compte administrateur et le nom de la résidence."
echo "  ${C_BOLD}Étape 2 :${C_RESET} activez la double authentification dans"
echo "            votre profil (recommandé pour l'administrateur)."
echo "  ${C_BOLD}Étape 3 :${C_RESET} invitez vos voisins via l'onglet"
echo "            « Inviter un voisin » (QR code)."
echo
echo "  Logs :    $COMPOSE logs -f"
echo "  Arrêt :   $COMPOSE down        (les données sont conservées)"
echo "  Effacer : $COMPOSE down -v     (⚠ supprime la base de données)"
