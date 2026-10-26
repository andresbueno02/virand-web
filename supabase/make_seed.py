#!/usr/bin/env python3
"""Genera supabase/seed.sql a partir de data/*.json. Idempotente: no pisa lo que ya exista en la base
(pisos por slug; fotos/FAQ/opiniones solo si la tabla está vacía; textos con 'do nothing')."""
import json, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
def j(p): return json.load(open(os.path.join(ROOT, p), encoding='utf8'))
def s(v):
    if v is None: return 'null'
    return "'" + str(v).replace("'", "''") + "'"
def n(v): return 'null' if v is None else str(v)
def arr(l): return "array[" + ",".join(s(x) for x in l) + "]::text[]"

out = ["-- Generado por supabase/make_seed.py. Ejecutar DESPUÉS de schema.sql. Seguro de repetir.\n"]
P = j('data/pisos.json')['pisos']
rows = []
for i, p in enumerate(P):
    rows.append("(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)" % (
        s(p['slug']), 'true' if p.get('activo', True) else 'false', s(p['nombre']['es']), s(p['nombre'].get('en')),
        s(p['zona']), s(p.get('barrio')), n(p.get('lat')), n(p.get('lng')), n(p['viajeros']), n(p.get('dormitorios')),
        n(p.get('camas')), n(p.get('banos')), arr(p.get('servicios', [])), s(p['descripcion'].get('es')),
        s(p['descripcion'].get('en')), n(p.get('nota')), n(p.get('precio_desde')), i))
out.append("insert into public.flats (slug,active,name_es,name_en,zona,barrio,lat,lng,viajeros,dormitorios,camas,banos,servicios,desc_es,desc_en,nota,base_price,sort) values\n" + ",\n".join(rows) + "\non conflict (slug) do nothing;\n")

ph = []
for p in P:
    for k, f in enumerate(p['fotos']):
        ph.append("(%s,%s,%s,%s,%d)" % (s(p['slug']), s(f['src']), s(f['alt'].get('es')), s(f['alt'].get('en')), k))
out.append("insert into public.flat_photos (flat_id,path,alt_es,alt_en,sort)\nselect f.id, v.path, v.alt_es, v.alt_en, v.sort from (values\n" + ",\n".join(ph) +
           "\n) as v(slug,path,alt_es,alt_en,sort) join public.flats f on f.slug = v.slug\nwhere not exists (select 1 from public.flat_photos x where x.flat_id = f.id);\n")

F = j('data/faq.json')['faq']
fr = ["(%s,%s,%s,%s,%s,%d)" % (s(q['pregunta']['es']), s(q['pregunta'].get('en')), s(q['respuesta']['es']), s(q['respuesta'].get('en')), 'true' if q.get('revisar') else 'false', i) for i, q in enumerate(F)]
out.append("insert into public.faq (q_es,q_en,a_es,a_en,needs_review,sort)\nselect * from (values\n" + ",\n".join(fr) + "\n) as v(q_es,q_en,a_es,a_en,needs_review,sort)\nwhere not exists (select 1 from public.faq);\n")

R = j('data/opiniones.json')['opiniones']
rr = ["(%s,%s,%s,%s,%d,%d)" % (s(o['texto']['es']), s(o['texto'].get('en')), s(o['autor']['es']), s(o['autor'].get('en')), o['nota'], i) for i, o in enumerate(R)]
out.append("insert into public.reviews (text_es,text_en,author_es,author_en,rating,sort)\nselect * from (values\n" + ",\n".join(rr) + "\n) as v(text_es,text_en,author_es,author_en,rating,sort)\nwhere not exists (select 1 from public.reviews);\n")

T = []
for lang in ('es', 'en'):
    for k, v in j('data/i18n/%s.json' % lang).items():
        T.append("(%s,%s,%s)" % (s(k), s(lang), s(v)))
out.append("insert into public.site_texts (key,lang,value) values\n" + ",\n".join(T) + "\non conflict (key,lang) do nothing;\n")
open(os.path.join(ROOT, 'supabase', 'seed.sql'), 'w', encoding='utf8').write("\n".join(out))
print('flats', len(P), 'photos', len(ph), 'faq', len(F), 'reviews', len(R), 'texts', len(T))
