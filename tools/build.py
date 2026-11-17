#!/usr/bin/env python3
"""Assemble une attraction en un seul fichier HTML autonome : python3 tools/build.py zeus dist/zeus.html"""
import sys, os, re
site, out = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(root, p), encoding='utf8').read()
ENGINE = ('core', 'garage', 'state', 'queue', 'sim', 'ui', 'render', 'save')  # même ordre que jeu.html
h = rd('jeu.html')
a = h.index('<script>\n/* Charge l\'attraction demandée'); b = h.index('</script>', a) + 9
parts = ''.join('<script>' + rd(f).replace('</script>', '<\\/script>') + '</script>\n' for f in ('sites/%s.data.js' % site, 'sites/%s.js' % site) + (('sites/%s.game.js' % site,) if os.path.exists(os.path.join(root, 'sites/%s.game.js' % site)) else ()) + tuple('engine/%s.js' % n for n in ENGINE))
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, 'w', encoding='utf8').write(h[:a] + parts + h[b:])
print('écrit', out)
