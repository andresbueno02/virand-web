#!/usr/bin/env python3
"""Genera supabase/dist/<función>.ts en UN solo archivo (core.js + index.ts) para pegarlo en el editor de
Edge Functions del panel de Supabase. Si usas el CLI no hace falta: `supabase functions deploy translate`."""
import os, re, sys
name = sys.argv[1] if len(sys.argv) > 1 else 'translate'
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'functions', name)
core = open(os.path.join(base, 'core.js'), encoding='utf8').read()
idx = open(os.path.join(base, 'index.ts'), encoding='utf8').read()
idx = re.sub(r'^import "\./core\.js";\n', '', idx, flags=re.M)
head = [l for l in idx.splitlines() if l.startswith('import ')]
rest = '\n'.join(l for l in idx.splitlines() if not l.startswith('import '))
out = '\n'.join(head) + '\n\n// ---- core.js (lógica pura) ----\n' + core + '\n// ---- index.ts ----\n' + rest + '\n'
os.makedirs(os.path.join(os.path.dirname(base), '..', 'dist'), exist_ok=True)
dst = os.path.join(os.path.dirname(base), '..', 'dist', name + '.ts')
open(dst, 'w', encoding='utf8').write(out); print('Generado', os.path.normpath(dst), len(out), 'bytes')
