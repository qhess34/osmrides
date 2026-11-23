#!/usr/bin/env python3
"""Assemble une attraction en un seul fichier HTML autonome : python3 tools/build.py zeus dist/zeus.html"""
import sys, os, re
site, out = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIEU = 'lieux/parc/asterix'  # type/lieu des attractions (une seule pour l'instant)
rd = lambda p: open(os.path.join(root, p), encoding='utf8').read()
ENGINE = ('core', 'garage', 'state', 'queue', 'sim', 'ui', 'render', 'save')  # même ordre que engine/moteur.js
h = rd('jeu.html')
a = h.index('<script>\n/* Charge l\'élément demandé'); b = h.index('</script>', a) + 9
def tag(code): return '<script>' + code.replace('</script>', '<\\/script>') + '</script>\n'
files = ['lieux/index.js', LIEU + '/%s.data.js' % site, LIEU + '/%s.js' % site]
parts = ''.join(tag(rd(f)) for f in files) + tag("SITE.type='parc';SITE.lieu='asterix';")  # le chargeur de jeu.html n'est pas là : type et lieu posés ici
if os.path.exists(os.path.join(root, LIEU + '/%s.game.js' % site)): parts += tag(rd(LIEU + '/%s.game.js' % site))
parts += ''.join(tag(rd('engine/%s.js' % n)) for n in ENGINE)
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, 'w', encoding='utf8').write(h[:a] + parts + h[b:])
print('écrit', out)
