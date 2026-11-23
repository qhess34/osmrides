#!/bin/sh
# Lance l'éditeur OSMrides d'une version publiée sur un dépôt de jeu (docs/versions.md).
#   sh editeur.sh v1            # dépôt de jeu = dossier courant
#   sh editeur.sh v1 ../osmrides_parks
#   sh editeur.sh local         # éditeur de ce dépôt osmrides (développement)
# Télécharge une fois la version dans ~/.cache/osmrides/<version> (archive GitHub de l'étiquette), puis node editor/server.js
# avec T2Z_ROOT = dépôt de jeu : l'éditeur et le moteur viennent de la version, jeu.html et lieux/ du dépôt de jeu.
# Node 22, aucune dépendance. Variables PORT, HOST, OSM_CONFIG : editor/README.md.
set -e
V=${1:?version attendue, par exemple v1}
JEU=$(cd "${2:-.}" && pwd)
case "$V" in
  local) LIB=$(cd "$(dirname "$0")/.." && pwd) ;;
  v[0-9]*|main)
    LIB=${XDG_CACHE_HOME:-$HOME/.cache}/osmrides/$V
    if [ "$V" = main ] || [ ! -f "$LIB/editor/server.js" ]; then
      rm -rf "$LIB" && mkdir -p "$LIB"
      curl -fsSL "https://codeload.github.com/qhess34/osmrides/tar.gz/$V" | tar -xz -C "$LIB" --strip-components=1
    fi ;;
  *) echo "version inconnue : $V (v1, v2…, main ou local)" >&2; exit 1 ;;
esac
[ -d "$JEU/lieux" ] || { echo "pas de dossier lieux/ dans $JEU" >&2; exit 1; }
T2Z_ROOT="$JEU" exec node "$LIB/editor/server.js"
