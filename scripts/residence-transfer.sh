#!/usr/bin/env bash
#
# Transfert de résidence en ligne de commande (export / import chiffrés).
#
#   ./scripts/residence-transfer.sh export <résidence> [fichier.proximo]
#   ./scripts/residence-transfer.sh import <fichier.proximo> [nom] [code]
#
# <résidence> = identifiant (uuid) OU nom exact de la résidence.
#
# Le fichier produit est identique à celui de la console superadmin (même
# format, même chiffrement) : un export fait ici se restaure depuis
# l'interface, et inversement.
#
# La phrase de passe est demandée en interactif (jamais dans l'historique du
# shell, jamais dans les journaux du reverse-proxy).
#
# Usage prévu : sauvegarde planifiée, migration de serveur, restauration.
set -euo pipefail

CONTAINER="${PROXIMO_BACKEND_CONTAINER:-proximo-backend-1}"

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

command -v docker >/dev/null || { echo "docker requis" >&2; exit 1; }
docker ps --format '{{.Names}}' | grep -qx "$CONTAINER" || {
  echo "Conteneur $CONTAINER introuvable (arrêté ?)" >&2; exit 1;
}

cli_js() {
  cat <<'JS'
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { ResidenceTransferService } = require('/app/dist/admin/residence-transfer.service.js');

async function main() {
  const [mode, target, passphrase, extra1, extra2] = process.argv.slice(2);
  const prisma = new PrismaClient();
  const service = new ResidenceTransferService(prisma);
  try {
    if (mode === 'export') {
      const residence = await prisma.residence.findFirst({
        where: {
          OR: [{ id: target }, { name: target }],
        },
      });
      if (!residence) throw new Error(`Résidence introuvable : ${target}`);
      const { buffer, filename } = await service.exportResidence(
        residence.id,
        passphrase,
        'cli',
      );
      fs.writeFileSync('/tmp/transfer-out.proximo', buffer);
      process.stderr.write(`OK ${filename} ${buffer.length}\n`);
      return;
    }

    if (mode === 'import') {
      const file = fs.readFileSync(target);
      const report = await service.importResidence(file, {
        passphrase,
        residenceName: extra1 || undefined,
        residenceCode: extra2 || undefined,
        emailConflict: 'rename',
      });
      process.stdout.write(JSON.stringify(report, null, 2));
      return;
    }

    throw new Error(`Mode inconnu : ${mode}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`ERREUR ${error.message}\n`);
  process.exit(1);
});
JS
}

mode="${1:-}"
[ -n "$mode" ] || usage
shift || true

case "$mode" in
  export)
    target="${1:-}"; out="${2:-}"
    [ -n "$target" ] || usage
    printf 'Phrase de passe (12 caractères minimum) : '
    read -rs passphrase; echo
    printf 'Confirmer : '
    read -rs confirm; echo
    [ "$passphrase" = "$confirm" ] || { echo "Les deux saisies diffèrent." >&2; exit 1; }
    [ "${#passphrase}" -ge 12 ] || { echo "12 caractères minimum." >&2; exit 1; }

    cli_js > /tmp/proximo-cli.js
    docker cp /tmp/proximo-cli.js "$CONTAINER":/tmp/proximo-cli.js >/dev/null
    rm -f /tmp/proximo-cli.js
    docker exec "$CONTAINER" node /tmp/proximo-cli.js export "$target" "$passphrase" 2>/tmp/proximo-export.err || {
      cat /tmp/proximo-export.err >&2; docker exec "$CONTAINER" rm -f /tmp/proximo-cli.js >/dev/null 2>&1 || true; exit 1;
    }
    filename=$(awk '/^OK /{print $2}' /tmp/proximo-export.err)
    rm -f /tmp/proximo-export.err
    out="${out:-./$filename}"
    docker cp "$CONTAINER":/tmp/transfer-out.proximo "$out" >/dev/null
    docker exec "$CONTAINER" rm -f /tmp/transfer-out.proximo /tmp/proximo-cli.js >/dev/null 2>&1 || true
    size=$(du -h "$out" | cut -f1)
    echo "✅ Export chiffré : $out ($size)"
    echo "   Conservez la phrase de passe SÉPARÉMENT : sans elle, le fichier est illisible."
    ;;

  import)
    file="${1:-}"; name="${2:-}"; code="${3:-}"
    [ -f "$file" ] || { echo "Fichier introuvable : $file" >&2; exit 1; }
    printf 'Phrase de passe du fichier : '
    read -rs passphrase; echo

    cli_js > /tmp/proximo-cli.js
    docker cp /tmp/proximo-cli.js "$CONTAINER":/tmp/proximo-cli.js >/dev/null
    rm -f /tmp/proximo-cli.js
    docker cp "$file" "$CONTAINER":/tmp/transfer-in.proximo >/dev/null
    docker exec "$CONTAINER" node /tmp/proximo-cli.js import /tmp/transfer-in.proximo "$passphrase" "$name" "$code"
    status=$?
    docker exec "$CONTAINER" rm -f /tmp/transfer-in.proximo /tmp/proximo-cli.js >/dev/null 2>&1 || true
    exit $status
    ;;

  *) usage ;;
esac
