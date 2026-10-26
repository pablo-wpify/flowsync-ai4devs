#!/usr/bin/env bash
# PostToolUse hook (Write|Edit): formatea con Prettier el fichero editado si vive en frontend/.
#
# Lee el payload JSON del hook por stdin y toma la ruta de tool_input.file_path
# (Write y Edit la reciben siempre absoluta); tool_response.filePath queda como respaldo.
#
# Salidas:
#   0 — formateado, o fichero fuera de frontend/ / ignorado por Prettier: nada que hacer.
#   2 — algo falló. El mensaje va a stderr, que Claude Code muestra a Claude y al usuario.
#       La edición ya está aplicada (PostToolUse no puede deshacerla); solo falta el formato.

set -uo pipefail

fail() {
  echo "format-frontend: $*" >&2
  exit 2
}

command -v jq >/dev/null 2>&1 || fail "jq no está instalado; no se puede leer el payload del hook."

project_dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
frontend_dir="$(realpath -m "$project_dir/frontend")"

payload="$(cat)"
file="$(jq -r '.tool_input.file_path // .tool_response.filePath // empty' <<<"$payload")" \
  || fail "payload del hook no es JSON válido."
[ -n "$file" ] || exit 0

# Normaliza ".." y symlinks antes de comparar, para que el filtro no dependa del texto de la ruta.
file="$(realpath -m "$file")"
case "$file" in
  "$frontend_dir"/*) ;;
  *) exit 0 ;;
esac

prettier="$frontend_dir/node_modules/.bin/prettier"
[ -x "$prettier" ] || fail "no encuentro $prettier; ejecuta 'npm install' en frontend/. $file quedó sin formatear."

cd "$frontend_dir" || fail "no puedo entrar en $frontend_dir."
if ! output="$("$prettier" --write --ignore-unknown --log-level=warn "$file" 2>&1)"; then
  fail "Prettier falló sobre $file (quedó sin formatear):
$output"
fi
[ -z "$output" ] || echo "$output" >&2
exit 0
