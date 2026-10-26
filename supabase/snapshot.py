#!/usr/bin/env python3
"""Guarda en data/snapshot.json lo que ve el público (vistas public_*). Es la copia de seguridad de la web
y, de paso, mantiene activo el proyecto gratuito de Supabase (que se pausa tras 7 días sin uso).
Solo usa la clave pública (anon) de assets/js/config.js: no hace falta ningún secreto."""
import json, os, re, sys, urllib.request, datetime
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
cfg = open(os.path.join(ROOT, 'assets/js/config.js'), encoding='utf8').read()
url = os.environ.get('SUPABASE_URL') or re.search(r"supabaseUrl:\s*'([^']+)'", cfg).group(1)
key = os.environ.get('SUPABASE_ANON_KEY') or re.search(r"supabaseAnonKey:\s*'([^']+)'", cfg).group(1)

def get(view):
    req = urllib.request.Request('%s/rest/v1/%s?select=*' % (url, view), headers={'apikey': key, 'Authorization': 'Bearer ' + key})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def rpc(name):
    req = urllib.request.Request('%s/rest/v1/rpc/%s' % (url, name), data=b'{}', method='POST',
                                 headers={'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

snap = {'flats': get('public_flats'), 'photos': get('public_photos'), 'faq': get('public_faq'),
        'reviews': get('public_reviews'), 'texts': get('public_texts')}
if not snap['flats'] or not snap['texts']:
    sys.exit('Respuesta vacía: no se sobrescribe la copia existente.')
out = os.path.join(ROOT, 'data', 'snapshot.json')
# precios por temporada/día: opcionales. Si la llamada falla, se conserva el valor anterior de la copia.
try:
    pricing = rpc('public_pricing')
    if not isinstance(pricing, dict) or 'pisos' not in pricing: raise ValueError('formato inesperado')
except Exception as e:
    print('Aviso: no se pudo leer public_pricing (%s); se conserva el anterior.' % e)
    try: pricing = json.load(open(out, encoding='utf8')).get('pricing')
    except Exception: pricing = None
if pricing is not None: snap['pricing'] = pricing
new = json.dumps(snap, ensure_ascii=False, indent=1, sort_keys=True) + '\n'
old = open(out, encoding='utf8').read() if os.path.exists(out) else ''
if new == old:
    print('Sin cambios.')
else:
    open(out, 'w', encoding='utf8').write(new)
    print('Copia guardada: %d pisos, %d fotos, %d preguntas, %d opiniones, %d textos' % tuple(len(snap[k]) for k in ('flats', 'photos', 'faq', 'reviews', 'texts')))
