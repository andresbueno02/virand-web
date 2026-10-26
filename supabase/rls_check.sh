#!/usr/bin/env bash
# Comprueba con la clave PÚBLICA (anon) que el público no puede leer ni escribir nada privado.
# Uso: bash supabase/rls_check.sh   (lee URL y clave de assets/js/config.js, o de SUPABASE_URL / SUPABASE_ANON_KEY)
set -u
cd "$(dirname "$0")/.."
CFG=assets/js/config.js
URL="${SUPABASE_URL:-$(sed -n "s/.*supabaseUrl: *'\([^']*\)'.*/\1/p" $CFG)}"
KEY="${SUPABASE_ANON_KEY:-$(sed -n "s/.*supabaseAnonKey: *'\([^']*\)'.*/\1/p" $CFG)}"
[ -n "$URL" ] && [ -n "$KEY" ] || { echo "Falta supabaseUrl/supabaseAnonKey"; exit 2; }
FAIL=0; PASS=0
ok()  { PASS=$((PASS+1)); echo "  ok   $1"; }
bad() { FAIL=$((FAIL+1)); echo "  FALLA $1"; }
req() { # método ruta [cuerpo] -> escribe /tmp/rls_body y devuelve el código HTTP
  if [ -n "${3:-}" ]; then
    curl -s -o /tmp/rls_body -w "%{http_code}" --max-time 20 -X "$1" "$URL$2" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "$3"
  else
    curl -s -o /tmp/rls_body -w "%{http_code}" --max-time 20 -X "$1" "$URL$2" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
  fi
}
echo "== 1. Tablas privadas: anon NO debe poder leer =="
for t in admins flats flat_photos rates faq reviews site_texts bookings ical_sources ical_blocks; do
  c=$(req GET "/rest/v1/$t?select=*&limit=1")
  if [ "$c" = "401" ] || [ "$c" = "403" ] || grep -qi "permission denied" /tmp/rls_body; then ok "GET $t -> $c"; else bad "GET $t -> $c (¡legible!)"; fi
done
echo "== 2. Escritura de anon denegada =="
denied() { [ "$1" = "401" ] || [ "$1" = "403" ] || grep -qi "permission denied\|row-level security\|Unauthorized\|policy" /tmp/rls_body; }
for pair in 'flats|{"slug":"zz-test"}' 'bookings|{"notes":"x"}' 'ical_sources|{"label":"x"}' 'faq|{"q_es":"x"}'; do
  t="${pair%%|*}"; body="${pair#*|}"
  c=$(req POST "/rest/v1/$t" "$body")
  if denied "$c"; then ok "POST $t -> $c"; else bad "POST $t -> $c $(head -c 100 /tmp/rls_body)"; fi
done
c=$(req POST "/storage/v1/object/flats/rls-test.txt" 'x'); if denied "$c"; then ok "Storage subida anon -> $c"; else bad "Storage subida anon -> $c $(head -c 100 /tmp/rls_body)"; fi
echo "== 3. Vistas públicas: sí legibles y sin datos privados =="
chk() { # vista mínimo_filas
  c=$(req GET "/rest/v1/$1?select=*")
  python3 - "$1" "$2" "$c" <<'PY'
import sys,json
v,mn,c=sys.argv[1],int(sys.argv[2]),sys.argv[3]
try: d=json.load(open('/tmp/rls_body'))
except Exception: d=None
txt=open('/tmp/rls_body').read()
priv=[w for w in ('export_token','guest_name','phone','ical','"id"') if w in txt]
if c=='200' and isinstance(d,list) and len(d)>=mn and not priv: print('  ok   %s -> %d filas'%(v,len(d)))
else: print('  FALLA %s -> http %s, filas %s, privados %s'%(v,c,len(d) if isinstance(d,list) else '?',priv)); sys.exit(1)
PY
  [ $? -eq 0 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
}
chk public_flats 16; chk public_photos 100; chk public_faq 5; chk public_reviews 1; chk public_texts 100
echo "== 4. RPC =="
c=$(req POST "/rest/v1/rpc/public_availability" '{}')
python3 - "$c" <<'PY'
import sys,json
c=sys.argv[1]
try: d=json.load(open('/tmp/rls_body'))
except Exception: d={}
ok = c=='200' and isinstance(d.get('pisos'),dict) and len(d['pisos'])>=16 and all(isinstance(v.get('ocupado'),list) and 'obsoleto' in v for v in d['pisos'].values()) and 'guest' not in json.dumps(d)
print('  ok   public_availability -> %d pisos'%len(d['pisos']) if ok else '  FALLA public_availability -> http %s %s'%(c,json.dumps(d)[:160])); sys.exit(0 if ok else 1)
PY
[ $? -eq 0 ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
c=$(req POST "/rest/v1/rpc/is_admin" '{}'); if [ "$c" = "200" ] && [ "$(tr -d ' \n' </tmp/rls_body)" = "false" ]; then ok "is_admin() anon -> false"; else bad "is_admin() anon -> $c $(cat /tmp/rls_body)"; fi
echo "== 5. Ajustes de Auth =="
if curl -s --max-time 15 "$URL/auth/v1/settings" -H "apikey: $KEY" | python3 -c "import sys,json; sys.exit(0 if json.load(sys.stdin).get('disable_signup') else 1)"; then ok "registro público desactivado"; else bad "REGISTRO PÚBLICO ACTIVADO (Authentication → Sign In / Providers → desactivar 'Allow new users to sign up')"; fi
echo; echo "Resultado: $PASS correctas, $FAIL fallos"; [ "$FAIL" -eq 0 ]
