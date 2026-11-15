#!/usr/bin/env python3
"""Fabrique les données d'une attraction à partir d'un extrait OpenStreetMap (.osm).

Usage : python3 tools/make_site.py extrait.osm tools/specs/<site>.json sites/<site>.data.js [apercu.png]

Le fichier de spécification (JSON) décrit :
  origin        [lat, lon] du point (0, 0) ; x vers l'est, z vers le sud, en mètres
  bbox          [x0, x1, z0, z1] zone conservée autour de l'attraction
  track_ways    identifiants des tronçons de voie (assemblés automatiquement en circuit fermé)
  start_way     tronçon de départ (gare) et "start_reversed" si son sens OSM est inverse au sens de marche
  profile       [[s, h] ou [s, h, "lin"], ...] hauteur estimée en fonction de la distance au sol
  level, flat   hauteur de la gare et [fin, début] de la zone forcée à ce niveau (début et fin de circuit)
  tags          {repère: s} repères le long de la voie (st0, st1, lift0, lift1, brk, blk1…)
  keep          [[s0, s1], ...] zones non lissées (droites)
  paths, polys  {nom: identifiant OSM} chemins et polygones exportés à part (file, sortie, gare…)
  drop_ways     identifiants à ne pas mettre dans le décor
  (tunnels)     calculés : tronçons du circuit tagués tunnel=yes (ou covered=yes et layer<0) -> OSM.tunnels=[[s0,s1],…]
  phys          {roll, drag} frottements utilisés pour le contrôle de vitesse affiché
OpenStreetMap ne donne pas les hauteurs : le profil est une estimation, vérifiée ici aux croisements.
"""
import sys, json, math, collections, xml.etree.ElementTree as ET

osm, spec_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
png = sys.argv[4] if len(sys.argv) > 4 else None
spec = json.load(open(spec_path))
root = ET.parse(osm).getroot()
lat0, lon0 = spec['origin']
NODE = {n.get('id'): (float(n.get('lat')), float(n.get('lon'))) for n in root.iter('node')}
NTAG = {n.get('id'): {t.get('k'): t.get('v') for t in n.findall('tag')} for n in root.iter('node') if n.find('tag') is not None}
WAY = {w.get('id'): w for w in root.iter('way')}
tags = lambda e: {t.get('k'): t.get('v') for t in e.findall('tag')}
nds = lambda w: [x.get('ref') for x in w.findall('nd') if x.get('ref') in NODE]
kx = 111320 * math.cos(math.radians(lat0))
def xy(i, r=2):
    la, lo = NODE[i]
    return (round((lo - lon0) * kx, r), round(-(la - lat0) * 111320, r))
dist = lambda a, b: math.hypot(b[0] - a[0], b[1] - a[1])

# ── circuit : assemblage des tronçons
track = [str(i) for i in spec['track_ways']]
ends = collections.defaultdict(list)
for m in track:
    n = nds(WAY[m]); ends[n[0]].append(m); ends[n[-1]].append(m)
cur = str(spec['start_way']); seq = nds(WAY[cur])
if spec.get('start_reversed'): seq = seq[::-1]
used = {cur}; chain = list(seq); last = seq[-1]
while True:
    nx = [m for m in ends[last] if m not in used]
    if not nx: break
    m = nx[0]; used.add(m); n = nds(WAY[m])
    if n[0] != last: n = n[::-1]
    chain += n[1:]; last = n[-1]
assert len(used) == len(track), 'tronçons non reliés : %s' % [m for m in track if m not in used]
assert chain[0] == chain[-1], 'le circuit ne se referme pas'
raw = [xy(i) for i in chain[:-1]]
L0 = sum(dist(raw[i], raw[(i + 1) % len(raw)]) for i in range(len(raw)))
# tronçons du circuit en tunnel (OSM tunnel=yes, ou covered=yes avec layer<0) : intervalles [s0, s1] le long de la voie
def is_tunnel(t):
    try: lay = float(t.get('layer', 0))
    except ValueError: lay = 0
    return t.get('tunnel') in ('yes', 'building_passage') or (t.get('covered') == 'yes' and lay < 0)
tun_edges = set()
for m in track:
    if is_tunnel(tags(WAY[m])):
        nn = nds(WAY[m]); tun_edges |= {frozenset(e) for e in zip(nn, nn[1:])}
cumr = [0.0]
for i in range(len(raw)): cumr.append(cumr[-1] + dist(raw[i], raw[(i + 1) % len(raw)]))
tunnels = []
for i in range(len(raw)):
    if frozenset((chain[i], chain[i + 1])) in tun_edges:
        if tunnels and abs(tunnels[-1][1] - cumr[i]) < 1e-6: tunnels[-1][1] = cumr[i + 1]
        else: tunnels.append([cumr[i], cumr[i + 1]])
tunnels_ground = tunnels

def resample(pts, step):
    P = pts + [pts[0]]; cum = [0]
    for i in range(len(P) - 1): cum.append(cum[-1] + dist(P[i], P[i + 1]))
    n = round(cum[-1] / step); o = []; j = 0
    for k in range(n):
        s = k * cum[-1] / n
        while cum[j + 1] < s: j += 1
        f = (s - cum[j]) / ((cum[j + 1] - cum[j]) or 1)
        o.append((P[j][0] + (P[j + 1][0] - P[j][0]) * f, P[j][1] + (P[j + 1][1] - P[j][1]) * f))
    return o
def smooth(a, w, passes):
    for _ in range(passes):
        a = [tuple(sum(a[(i + k) % len(a)][c] * (w + 1 - abs(k)) for k in range(-w, w + 1)) / ((w + 1) ** 2) for c in range(len(a[0]))) for i in range(len(a))]
    return a
pts = resample(raw, 1.0); n = len(pts); S = lambda i: i * L0 / n
sw, sp = spec.get('smooth', [3, 2]); sm = smooth(pts, sw, sp)
keep = lambda s: any(a <= s <= b for a, b in spec.get('keep', []))
pts = smooth([pts[i] if keep(S(i)) else sm[i] for i in range(n)], 1, 1)

# ── profil en hauteur
H = spec['profile']; level = spec['level']
def hraw(s):
    for a, b in zip(H, H[1:]):
        if a[0] <= s <= b[0]:
            f = (s - a[0]) / (b[0] - a[0])
            if len(a) < 3: f = (1 - math.cos(math.pi * f)) / 2
            return a[1] + (b[1] - a[1]) * f
    return level
hs = [h[0] for h in smooth([(hraw(S(i)),) for i in range(n)], 3, 2)]
fa, fb = spec['flat']
for i in range(n):
    if S(i) < fa or S(i) > fb: hs[i] = level

def inter(a, b, c, e):
    d1 = (b[0] - a[0], b[1] - a[1]); d2 = (e[0] - c[0], e[1] - c[1]); den = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(den) < 1e-9: return False
    u = ((c[0] - a[0]) * d2[1] - (c[1] - a[1]) * d2[0]) / den; v = ((c[0] - a[0]) * d1[1] - (c[1] - a[1]) * d1[0]) / den
    return 0 <= u <= 1 and 0 <= v <= 1
print('longueur au sol %.1f m, %d points' % (L0, n))
for i in range(n):
    for j in range(i + 8, n):
        if i == 0 and j > n - 8: continue
        if inter(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]):
            print('  croisement s=%d (h %.1f) x s=%d (h %.1f)  écart %.1f m' % (S(i), hs[i], S(j), hs[j], abs(hs[i] - hs[j])))
ph = spec.get('phys', {}); roll = ph.get('roll', .098); drag = ph.get('drag', .0006)
T = spec['tags']; v = 5.5; mn = (99, 0); mx = 0; s3 = 0
for i in range(n):
    ds = math.hypot(dist(pts[i], pts[(i + 1) % n]), hs[(i + 1) % n] - hs[i]); s3 += ds
    if T['lift1'] + 12 < S(i) < T['brk']:
        a = -9.81 * (hs[(i + 1) % n] - hs[i]) / ds - roll - drag * v * v
        v = math.sqrt(max(1, v * v + 2 * a * ds))
        if v < mn[0]: mn = (round(v, 1), round(S(i)))
        mx = max(mx, v)
print('longueur 3D %.1f m ; vitesse mini %s m/s à s=%s ; maxi %.1f m/s (%d km/h) ; aux freins %.1f m/s' % (s3, mn[0], mn[1], mx, mx * 3.6, v))
step = spec.get('cp_step', 3); tagi = {round(s * n / L0): k for k, s in T.items()}
cps = []
for i in range(0, n, step):
    row = [round(pts[i][0], 2), round(hs[i], 2), round(pts[i][1], 2), 0]
    for k in range(i, i + step):
        if k in tagi: row.append(tagi[k])
    cps.append(row)

# tunnels : conversion de s (au sol) en abscisse du moteur (longueur 3D le long de la spline Catmull-Rom des points de contrôle, comme engine/core.js)
def engine_s(sg):
    m = len(cps); SUB = 24; dense = [0.0]; prev = None; fi = sg * n / L0 / step
    def pt(i, t):
        P = [cps[(i + d) % m] for d in (-1, 0, 1, 2)]; t2 = t * t; t3 = t2 * t
        return [.5 * ((2 * P[1][k]) + (-P[0][k] + P[2][k]) * t + (2 * P[0][k] - 5 * P[1][k] + 4 * P[2][k] - P[3][k]) * t2 + (-P[0][k] + 3 * P[1][k] - 3 * P[2][k] + P[3][k]) * t3) for k in range(3)]
    i0 = int(fi); out = None; acc = 0.0; prev = None
    for i in range(i0 + 1):
        for j in range(SUB):
            q = pt(i, j / SUB)
            if prev: acc += math.dist(q, prev)
            prev = q
            if i == i0 and j == int(round((fi - i0) * SUB)) % SUB: return acc
    return acc
tunnels = [[round(engine_s(a), 1), round(engine_s(b), 1)] for a, b in tunnels_ground]
print('tunnels : s au sol', tunnels_ground, '-> s moteur', tunnels)

# ── décor
X0, X1, Z0, Z1 = spec['bbox']; inb = lambda p: X0 <= p[0] <= X1 and Z0 <= p[1] <= Z1
drop = set(track) | {str(i) for i in spec.get('drop_ways', [])} | {str(i) for i in spec.get('paths', {}).values()}
KEYS = ('building', 'highway', 'natural', 'landuse', 'leisure', 'water', 'waterway', 'barrier', 'amenity', 'tourism', 'man_made', 'railway')
feats = []; others = []
def area(p): return sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p))) / 2
def inside(pt, P):
    c = False; j = len(P) - 1
    for i in range(len(P)):
        if (P[i][1] > pt[1]) != (P[j][1] > pt[1]) and pt[0] < (P[j][0] - P[i][0]) * (pt[1] - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]: c = not c
        j = i
    return c
def add(t, p, closed, holes=None):
    kind = next((k + '=' + t[k] for k in KEYS if k in t), None)
    if kind and kind != 'landuse=commercial' and any(inb(q) for q in p):
        f = {'k': kind, 'n': t.get('name'), 'c': 1 if closed else 0, 'p': p}
        if closed and holes:  # anneaux intérieurs (multipolygone) : lac dans une place, îlot…, orientés à l'opposé de l'anneau extérieur (remplissage « nonzero » du canevas)
            h = [q if area(q) * area(p) < 0 else q[::-1] for q in holes if len(q) > 3 and inside(q[0], p)]
            if h: f['h'] = h
        feats.append(f)
for wid, w in WAY.items():
    t = tags(w); n_ = nds(w)
    if not t or not n_: continue
    p = [list(xy(i, 1)) for i in n_]
    if t.get('roller_coaster'):
        if wid not in track and wid not in drop and any(inb(q) for q in p): others.append(p)  # drop_ways / paths : tronçons exportés à part (ex. voie de garage), pas dessinés comme voie voisine
        continue
    if wid in drop: continue
    add(t, p, n_[0] == n_[-1])
for r in root.iter('relation'):
    t = tags(r)
    if t.get('type') == 'multipolygon':
        holes = [[list(xy(i, 1)) for i in nds(WAY[m.get('ref')])] for m in r.findall('member') if m.get('type') == 'way' and m.get('role') == 'inner' and m.get('ref') in WAY]
        for m in r.findall('member'):
            if m.get('type') == 'way' and m.get('role') == 'outer' and m.get('ref') in WAY:
                n_ = nds(WAY[m.get('ref')])
                if n_: add(t, [list(xy(i, 1)) for i in n_], n_[0] == n_[-1], holes)
res = {'cps': cps, **({'tunnels': tunnels} if tunnels else {}), 'feats': feats, 'others': others,
       'paths': {k: [list(xy(i, 1)) for i in nds(WAY[str(v)])] for k, v in spec.get('paths', {}).items()},
       'polys': {k: [list(xy(i, 1)) for i in nds(WAY[str(v)])] for k, v in spec.get('polys', {}).items()},
       'trees': [list(xy(i, 1)) for i, t in NTAG.items() if t.get('natural') == 'tree' and inb(xy(i))],
       'pois': [[list(xy(i, 1)), t.get('name')] for i, t in NTAG.items() if t.get('name') and inb(xy(i))]}
open(out, 'w').write('/* Données © contributeurs OpenStreetMap (ODbL) — tracé au sol et alentours. Hauteurs estimées. Généré par tools/make_site.py. */\nconst OSM=' + json.dumps(res, separators=(',', ':'), ensure_ascii=False) + ';\n')
print('écrit', out, '-', len(feats), 'éléments de décor,', len(others), 'autres voies')

if png:
    from PIL import Image, ImageDraw
    sc = spec.get('png_scale', 5); im = Image.new('RGB', (int((X1 - X0) * sc), int((Z1 - Z0) * sc)), (112, 150, 92)); dr = ImageDraw.Draw(im)
    P = lambda p: ((p[0] - X0) * sc, (p[1] - Z0) * sc)
    col = {'building': (170, 92, 72), 'landuse=forest': (44, 92, 52), 'natural=wood': (44, 92, 52), 'landuse=grass': (146, 190, 112), 'natural=water': (72, 120, 196), 'waterway': (72, 120, 196), 'highway': (226, 206, 160), 'highway=service': (150, 150, 150)}
    for o in ('landuse', 'natural', 'leisure', 'waterway', 'highway', 'building'):
        for f in feats:
            if not f['k'].startswith(o): continue
            c = col.get(f['k']) or col.get(f['k'].split('=')[0]) or (200, 80, 200); pp = [P(p) for p in f['p']]
            if f['c'] and not f['k'].startswith('highway') and len(pp) > 2: dr.polygon(pp, fill=c)
            else: dr.line(pp, fill=c, width=3)
    for o in others: dr.line([P(p) for p in o], fill=(90, 90, 110), width=2)
    for k, p in res['paths'].items(): dr.line([P(q) for q in p], fill=(255, 0, 255), width=2); dr.text(P(p[0]), k, fill=(255, 255, 0))
    for k, p in res['polys'].items(): dr.line([P(q) for q in p], fill=(255, 255, 255), width=2)
    for i in range(n):
        h = hs[i]; c = (int(min(255, 40 + h * 7)), int(max(0, 200 - h * 6)), 40)
        dr.line([P(pts[i]), P(pts[(i + 1) % n])], fill=c, width=4)
        if i % 25 == 0: x, y = P(pts[i]); dr.ellipse([x - 3, y - 3, x + 3, y + 3], fill='black'); dr.text((x + 5, y - 12), '%d|%.0f' % (S(i), h), fill='black')
    im.save(png); print('aperçu', png)
