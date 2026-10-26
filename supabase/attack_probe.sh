#!/usr/bin/env bash
# Pruebas ofensivas NO destructivas contra tu propio proyecto, usando solo lo que cualquiera puede obtener de la web
# (URL + clave anon). Cada prueba intenta algo que NO debería funcionar y falla si funciona.
set -u
cd "$(dirname "$0")/.."
CFG=assets/js/config.js
URL=$(sed -n "s/.*supabaseUrl: *'\([^']*\)'.*/\1/p" $CFG); KEY=$(sed -n "s/.*supabaseAnonKey: *'\([^']*\)'.*/\1/p" $CFG)
PASS=0; FAIL=0; B=/tmp/atk_body
ok(){ PASS=$((PASS+1)); echo "  ok    $1"; }; bad(){ FAIL=$((FAIL+1)); echo "  FALLO $1"; }
H=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY")
code(){ curl -s -o $B -w "%{http_code}" --max-time 20 "$@"; }
leaks(){ grep -qiE "$1" $B; }   # ¿el cuerpo contiene datos que no debería?

echo "== A. Fuga de datos privados por rutas alternativas =="
c=$(code "${H[@]}" "$URL/rest/v1/public_flats?select=*,flat_photos(*)"); if [ "$c" = 200 ] && leaks '"flat_id"|"id":'; then bad "embedding public_flats→flat_photos filtra ($c)"; else ok "embedding de tablas privadas por vistas ($c)"; fi
c=$(code "${H[@]}" "$URL/rest/v1/public_photos?select=*,flats(*)"); if [ "$c" = 200 ] && leaks 'export_token|name_es'; then bad "embedding public_photos→flats filtra"; else ok "embedding inverso bloqueado ($c)"; fi
c=$(code "${H[@]}" "$URL/rest/v1/public_flats?select=export_token"); if [ "$c" = 200 ]; then bad "export_token legible en la vista"; else ok "export_token no existe en la vista ($c)"; fi
c=$(code "${H[@]}" "$URL/rest/v1/public_flats?select=id,base_price,active"); if [ "$c" = 200 ] && leaks '"base_price"|"active"'; then bad "columnas internas expuestas"; else ok "columnas internas no expuestas ($c)"; fi
for t in bookings ical_sources ical_blocks admins day_prices seasons; do c=$(code "${H[@]}" "$URL/rest/v1/$t?select=*&limit=1"); if [ "$c" = 200 ] && ! grep -q '^\[\]$' $B; then bad "$t legible ($c)"; else ok "$t no legible ($c)"; fi; done
echo "== B. Inyección y filtros maliciosos =="
c=$(code "${H[@]}" -G "$URL/rest/v1/public_flats" --data-urlencode "slug=eq.x' OR '1'='1" --data-urlencode "select=slug"); if [ "$c" = 200 ] && [ "$(cat $B)" = "[]" ]; then ok "SQLi por filtro devuelve vacío"; else bad "filtro raro: $c $(head -c 100 $B)"; fi
c=$(code "${H[@]}" "$URL/rest/v1/public_flats?select=slug&order=slug;DROP%20TABLE%20flats&limit=1"); n=$(curl -s -I "${H[@]}" -H "Prefer: count=exact" "$URL/rest/v1/public_flats?select=slug&limit=1" | tr -d '\r' | sed -n 's/.*\/\([0-9]*\)$/\1/p'); [ "${n:-0}" -ge 16 ] && ok "order con SQL no ejecuta nada (tabla intacta: $n filas)" || bad "¡tabla alterada! ($n filas)"
c=$(code "${H[@]}" "$URL/rest/v1/public_flats?select=slug&order=zzz"); [ "$c" = 400 ] && ok "columna inexistente en order -> 400" || bad "order inexistente -> $c"
c=$(code "${H[@]}" "$URL/rest/v1/public_flats?select=slug&limit=100000"); n=$(python3 -c "import json;print(len(json.load(open('$B'))))" 2>/dev/null); if [ "${n:-0}" -le 1000 ]; then ok "límite de filas respetado ($n)"; else bad "volcado masivo ($n filas)"; fi
echo "== C. Funciones (RPC) =="
for f in touch_updated_at is_admin_x rls_auto_enable; do c=$(code -X POST "${H[@]}" -H "Content-Type: application/json" -d '{}' "$URL/rest/v1/rpc/$f"); case "$c" in 401|403|404) ok "rpc/$f inaccesible ($c)";; *) bad "rpc/$f responde $c";; esac; done
c=$(code -X POST "${H[@]}" -H "Content-Type: application/json" -d '{}' "$URL/rest/v1/rpc/public_availability"); [ "$c" = 200 ] && ! leaks 'guest|phone|notes|url' && ok "public_availability no filtra datos privados" || bad "public_availability $c"
c=$(code -X POST "${H[@]}" -H "Content-Type: application/json" -d '{"x":"y"}' "$URL/rest/v1/rpc/public_availability"); [ "$c" = 404 ] && ok "parámetros extra rechazados en RPC ($c)" || bad "RPC acepta parámetros extra ($c)"
c=$(code -X POST "${H[@]}" -H "Content-Type: application/json" -d '{}' "$URL/rest/v1/rpc/public_pricing"); [ "$c" = 200 ] && ! leaks 'export_token|guest|phone' && ok "public_pricing no filtra datos privados" || bad "public_pricing $c"
echo "== D. Escalada: escritura y borrado como anónimo =="
for spec in "POST|flats|{\"slug\":\"hack\"}" "PATCH|flats?slug=eq.loft-ipanema-malaga|{\"name_es\":\"hackeado\"}" "DELETE|flats?slug=eq.loft-ipanema-malaga|" "POST|admins|{\"user_id\":\"00000000-0000-0000-0000-000000000000\"}" "PATCH|site_texts?key=eq.hero.title|{\"value\":\"x\"}" "POST|day_prices|{\"day\":\"2030-01-01\"}"; do
  m=${spec%%|*}; r=${spec#*|}; p=${r%%|*}; d=${r#*|}
  if [ -n "$d" ]; then c=$(code -X "$m" "${H[@]}" -H "Content-Type: application/json" -d "$d" "$URL/rest/v1/$p"); else c=$(code -X "$m" "${H[@]}" "$URL/rest/v1/$p"); fi
  case "$c" in 401|403) ok "$m $p denegado ($c)";; *) bad "$m $p -> $c $(head -c 90 $B)";; esac
done
c=$(code "${H[@]}" "$URL/rest/v1/public_flats?slug=eq.loft-ipanema-malaga&select=name_es"); leaks 'hackeado' && bad "¡dato modificado por un anónimo!" || ok "los datos siguen intactos"
echo "== E. Autenticación =="
c=$(code -X POST -H "apikey: $KEY" -H "Content-Type: application/json" -d '{"email":"pentest-no-existe@example.invalid","password":"Prueba-1234567"}' "$URL/auth/v1/signup"); case "$c" in 400|401|403|422) ok "registro público rechazado ($c)";; *) bad "REGISTRO ACEPTADO ($c) $(head -c 100 $B)";; esac
c=$(code -X POST -H "apikey: $KEY" -H "Content-Type: application/json" -d '{"email":"pentest-no-existe@example.invalid","password":"mal"}' "$URL/auth/v1/token?grant_type=password"); m1=$(cat $B)
c2=$(code -X POST -H "apikey: $KEY" -H "Content-Type: application/json" -d '{"email":"otro-inexistente@example.invalid","password":"mal"}' "$URL/auth/v1/token?grant_type=password"); [ "$m1" = "$(cat $B)" ] && ok "mensaje de login genérico ($c)" || bad "mensaje de login distinto entre usuarios"
c=$(code -X POST -H "apikey: $KEY" -H "Content-Type: application/json" -d '{"email":"pentest-no-existe@example.invalid","create_user":true}' "$URL/auth/v1/otp"); case "$c" in 400|401|403|422) ok "OTP/magic link no crea usuarios ($c)";; *) bad "OTP responde $c $(head -c 100 $B)";; esac
c=$(code "${H[@]}" "$URL/auth/v1/admin/users"); case "$c" in 401|403) ok "API de admin de usuarios cerrada ($c)";; *) bad "admin/users -> $c";; esac
echo "== F. Storage =="
c=$(code -X POST "${H[@]}" -H "Content-Type: application/json" -d '{"prefix":"","limit":5}' "$URL/storage/v1/object/list/flats"); if [ "$c" = 200 ] && ! grep -q '^\[\]$' $B; then bad "se puede LISTAR el bucket público ($c)"; else ok "bucket no listable por anónimos ($c)"; fi
c=$(code "${H[@]}" "$URL/storage/v1/bucket"); if [ "$c" = 200 ] && leaks '"name"'; then echo "  aviso  buckets visibles para anon ($c): $(head -c 120 $B)"; else ok "lista de buckets no expuesta ($c)"; fi
c=$(code -X DELETE "${H[@]}" "$URL/storage/v1/object/flats/x"); case "$c" in 400|401|403|404) ok "borrado anónimo en storage denegado ($c)";; *) bad "DELETE storage $c";; esac
c=$(code -X POST "${H[@]}" -H "Content-Type: text/html" -d '<script>alert(1)</script>' "$URL/storage/v1/object/flats/xss.html"); case "$c" in 400|401|403) ok "subida anónima de HTML denegada ($c)";; *) bad "SUBIDA ANÓNIMA $c";; esac
echo "== G. Superficie extra (GraphQL, funciones, introspección) =="
c=$(code -X POST "${H[@]}" -H "Content-Type: application/json" -d '{"query":"{ __schema { queryType { fields { name } } } }"}' "$URL/graphql/v1"); if grep -q "not enabled" $B; then ok "GraphQL desactivado"; elif [ "$c" = 200 ]; then echo "  info   GraphQL responde; tipos visibles a anónimos: $(python3 -c "import json;d=json.load(open('$B'));print([f['name'] for f in d['data']['__schema']['queryType']['fields']])" 2>/dev/null | head -c 300)"; if leaks 'bookings|ical_sources|admins'; then bad "GraphQL expone tablas privadas"; else ok "GraphQL no expone tablas privadas"; fi; else ok "GraphQL inaccesible ($c)"; fi
c=$(code "${H[@]}" "$URL/rest/v1/"); case "$c" in 401|403) ok "esquema OpenAPI cerrado a anon ($c)";; 200) leaks 'bookings|ical_sources' && bad "OpenAPI lista tablas privadas" || ok "OpenAPI no lista tablas privadas";; *) ok "raíz REST ($c)";; esac
c=$(code -X POST "${H[@]}" -H "Content-Type: application/json" -d '{"items":[{"key":"a","es":"hola"}]}' "$URL/functions/v1/translate"); echo "  info   /functions/v1/translate -> $c (404 = aún sin desplegar; 403 = rechaza a no admins)"
echo; echo "Resultado: $PASS correctas, $FAIL fallos"; [ "$FAIL" -eq 0 ]
