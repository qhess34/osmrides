#!/usr/bin/env python3
"""Génère les icônes de l'application (PNG) : python3 tools/make_icons.py [dossier]"""
import sys, math
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1] if len(sys.argv) > 1 else 'icons'
BG, GOLD, LINE = (15, 22, 38), (242, 193, 78), (50, 66, 106)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def icon(size, scale=1.0, rounded=False):
    S = 4 * size
    im = Image.new('RGB', (S, S), BG)
    d = ImageDraw.Draw(im)
    c = S / 2
    def P(u, v):  # coordonnées normalisées (0..1) -> pixels, contenu réduit par `scale` autour du centre
        return (c + (u - .5) * S * scale, c + (v - .5) * S * scale)
    # voie : colline, creux, boucle (vue de profil), stylisée
    pts = []
    for i in range(0, 301):
        t = i / 300
        u = .12 + .76 * t
        v = .62 - .30 * math.exp(-((t - .28) / .16) ** 2) + .10 * math.exp(-((t - .72) / .12) ** 2) * -1 - .14 * math.exp(-((t - .70) / .13) ** 2)
        pts.append(P(u, v))
    w = int(S * .028 * scale)
    # supports fins
    for t in (.10, .20, .30, .40, .50, .60, .70, .80, .90):
        p = pts[int(t * 300)]
        d.line([p, (p[0], P(0, .73)[1])], fill=LINE, width=max(1, int(w * .35)))
    d.line([P(.10, .73), P(.90, .73)], fill=LINE, width=int(w * .5))
    d.line(pts, fill=GOLD, width=w, joint='curve')
    for p in (pts[0], pts[-1]):
        d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=GOLD)
    f = ImageFont.truetype(FONT, int(S * .25 * scale))
    d.text(P(.5, .84), 'T2Z', font=f, fill=GOLD, anchor='mm')
    im = im.resize((size, size), Image.LANCZOS)
    return im

icon(192).save(f'{out}/icon-192.png')
icon(512).save(f'{out}/icon-512.png')
icon(512, .72).save(f'{out}/icon-maskable-512.png')   # contenu dans la zone de sécurité (80 %)
icon(180).save(f'{out}/apple-touch-icon.png')
