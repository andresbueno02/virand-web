#!/bin/bash
# Ejecuta las pruebas con JavaScriptCore (no hace falta Node). Sale con código != 0 si alguna falla.
set -e
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
[ -x "$JSC" ] || JSC=/System/Library/Frameworks/JavaScriptCore.framework/Helpers/jsc
TMP="$(mktemp -t virand-tests).js"
trap 'rm -f "$TMP"' EXIT
cat assets/js/ranges.js assets/js/ical.js assets/js/search.js assets/js/whatsapp.js admin/js/logic.js assets/js/data-source.js tests/cases.js > "$TMP"
echo 'if (__testExit) throw new Error("hay pruebas que fallan");' >> "$TMP"
"$JSC" "$TMP"
