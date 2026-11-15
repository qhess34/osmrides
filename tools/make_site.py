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
  inversions    [{type:'corkscrew', s0, s1, n, r} | {type:'loop', s0, s1, len, h, w, e, at, side}] : vrilles (dévers) et loopings insérés (linéaire ESTIMÉ) -> OSM.inversions (s moteur)
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

# ── inversions (spec "inversions", facultatif) : [{type:'corkscrew', s0, s1, n, r}, {type:'loop', s0, s1, len, h, w, e, at, side}] (s au sol)
#   corkscrew (vrille) : la voie tourne de 360° × n autour de son axe (dévers = rotation, cps[3]) ; déport hélicoïdal de r m (la voie tourne autour de la ligne de cœur)
#   loop (looping) : le tracé OSM au sol ne contient pas la boucle (vue de dessus, elle se réduit à une ligne) : entre s0 et s1, la voie est remplacée par une boucle
#   ESTIMÉE (linéaire ajouté) : longueur totale len le long de la voie, hauteur h, ellipse vue de dessus (largeur w, entrée et sortie décalées de e) ; dévers par transport
#   parallèle (voie tête en bas au sommet). Les points de contrôle y sont posés tous les mètres.
rows = [[pts[i][0], hs[i], pts[i][1], 0.0, S(i)] for i in range(n)]  # [x, h, z, dévers°, s au sol]
def tan2(i):
    a = pts[(i - 1) % n]; b = pts[(i + 1) % n]; l = dist(a, b) or 1
    return ((b[0] - a[0]) / l, (b[1] - a[1]) / l)
def nrm3(v): l = math.sqrt(sum(c * c for c in v)) or 1; return tuple(c / l for c in v)
def cross3(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
dot3 = lambda a, b: sum(x * y for x, y in zip(a, b))
INV = sorted(spec.get('inversions', []), key=lambda v: -v['s0'])  # de la fin vers le début : l'insertion d'une boucle ne décale pas les éléments suivants à traiter
inv_ground = []
for iv in INV:
    s0, s1 = iv['s0'], iv['s1']
    if iv['type'] == 'corkscrew':
        nn, r = iv.get('n', 1), iv.get('r', 1.2)
        for i, w in enumerate(rows):
            if s0 <= w[4] <= s1:
                u = (w[4] - s0) / (s1 - s0); b = 2 * math.pi * nn * (u - math.sin(2 * math.pi * u) / (2 * math.pi)) * (1 if iv.get('dir', 1) > 0 else -1)
                tx, tz = tan2(i)  # R0 = T × Y = (-tz, 0, tx) : la voie tourne autour de la ligne de cœur, r m au-dessus d'elle
                w[0] += r * math.sin(b) * -tz; w[2] += r * math.sin(b) * tx; w[1] += r * (1 - math.cos(b)); w[3] = math.degrees(b)
        inv_ground.append((iv, s0, s1))
    elif iv['type'] == 'loop':
        i0 = next(i for i, w in enumerate(rows) if w[4] >= s0); i1 = max(i for i, w in enumerate(rows) if w[4] <= s1)
        A, B = rows[i0], rows[i1]; Lg = math.hypot(B[0] - A[0], B[2] - A[2]); tx, tz = (B[0] - A[0]) / Lg, (B[2] - A[2]) / Lg
        sd = iv.get('side', 1); nx, nz = -tz * sd, tx * sd
        dc = Lg * iv.get('at', .5); hc = A[1] + (B[1] - A[1]) * dc / Lg; bh, W, e = iv.get('h', 20) / 2, iv.get('w', 6), iv.get('e', 3)
        ease = lambda u: (1 - math.cos(math.pi * u)) / 2
        def curve(a, k):  # (d le long de la corde A→B, décalage latéral, hauteur) : entrée, boucle (θ de 0 à 2π), sortie
            P = [(dc * j / k, -e / 2 * ease(j / k), A[1] + (hc - A[1]) * j / k) for j in range(k + 1)]
            for j in range(1, k + 1):
                th = 2 * math.pi * j / k; P.append((dc + a * math.sin(th), -e / 2 + e * th / (2 * math.pi) + W * math.sin(th / 2) ** 2, hc + bh * (1 - math.cos(th))))
            P += [(dc + (Lg - dc) * j / k, e / 2 * (1 - ease(j / k)), hc + (B[1] - hc) * j / k) for j in range(1, k + 1)]
            C = [0.0]
            for j in range(1, len(P)): C.append(C[-1] + math.dist(P[j], P[j - 1]))
            return P, C
        target = iv.get('len', 4 * Lg); lo, hi = .5, 80.0
        for _ in range(40):
            a = (lo + hi) / 2
            if curve(a, 300)[1][-1] < target: lo = a
            else: hi = a
        P, C = curve(a, 3000); m = max(2, round(C[-1])); new = []; j = 0
        for k in range(m + 1):
            c = C[-1] * k / m
            while j < len(C) - 2 and C[j + 1] < c: j += 1
            f = (c - C[j]) / ((C[j + 1] - C[j]) or 1); d, lat, h = [P[j][q] + (P[j + 1][q] - P[j][q]) * f for q in range(3)]
            new.append([A[0] + tx * d + nx * lat, h, A[2] + tz * d + nz * lat, 0.0, A[4] + (B[4] - A[4]) * k / m])
        Q = rows[i0 - 1:i0] + new + rows[i1 + 1:i1 + 2]; R = None; bank = []
        for k in range(1, len(Q) - 1):  # dévers = angle entre le repère transporté (sans torsion) et le repère « naïf » du moteur (T × vertical)
            T3 = nrm3((Q[k + 1][0] - Q[k - 1][0], Q[k + 1][1] - Q[k - 1][1], Q[k + 1][2] - Q[k - 1][2])); R0 = nrm3((-T3[2], 0, T3[0])); U0 = cross3(R0, T3)
            R = R0 if R is None else nrm3(tuple(R[c] - dot3(R, T3) * T3[c] for c in range(3)))
            U = cross3(R, T3); b = math.degrees(math.atan2(-dot3(U, R0), dot3(U, U0)))
            if bank: b += 360 * round((bank[-1] - b) / 360)
            bank.append(b)
        rest = bank[-1] - 360 * round(bank[-1] / 360)  # torsion résiduelle (déport latéral) répartie sur l'élément : la voie ressort droite
        for k, w in enumerate(new): w[3] = bank[k] - rest * k / (len(new) - 1)
        rows[i0:i1 + 1] = new
        print('looping s=%g..%g : corde %.1f m -> %.1f m le long de la voie (demi-longueur %.1f m, hauteur %.1f m, largeur vue de dessus %.1f m), dévers max %.0f°' % (s0, s1, Lg, C[-1], a, 2 * bh, W + e / 2, max(abs(x) for x in bank)))
        inv_ground.append((iv, A[4], B[4]))
nr = len(rows); SG = [w[4] for w in rows]; P2 = [(w[0], w[2]) for w in rows]; HS = [w[1] for w in rows]

def inter(a, b, c, e):
    d1 = (b[0] - a[0], b[1] - a[1]); d2 = (e[0] - c[0], e[1] - c[1]); den = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(den) < 1e-9: return False
    u = ((c[0] - a[0]) * d2[1] - (c[1] - a[1]) * d2[0]) / den; v = ((c[0] - a[0]) * d1[1] - (c[1] - a[1]) * d1[0]) / den
    return 0 <= u <= 1 and 0 <= v <= 1
print('longueur au sol %.1f m, %d points' % (L0, n))
for i in range(nr):
    for j in range(i + 8, nr):
        if i == 0 and j > nr - 8: continue
        if inter(P2[i], P2[(i + 1) % nr], P2[j], P2[(j + 1) % nr]):
            print('  croisement s=%d (h %.1f) x s=%d (h %.1f)  écart %.1f m' % (SG[i], HS[i], SG[j], HS[j], abs(HS[i] - HS[j])))
ph = spec.get('phys', {}); roll = ph.get('roll', .098); drag = ph.get('drag', .0006)
T = spec['tags']; v = 5.5; mn = (99, 0); mx = 0; s3 = 0
for i in range(nr):
    ds = math.hypot(dist(P2[i], P2[(i + 1) % nr]), HS[(i + 1) % nr] - HS[i]); s3 += ds
    if T['lift1'] + 12 < SG[i] < T['brk']:
        a = -9.81 * (HS[(i + 1) % nr] - HS[i]) / ds - roll - drag * v * v
        v = math.sqrt(max(1, v * v + 2 * a * ds))
        if v < mn[0]: mn = (round(v, 1), round(SG[i]))
        mx = max(mx, v)
print('longueur 3D %.1f m ; vitesse mini %s m/s à s=%s ; maxi %.1f m/s (%d km/h) ; aux freins %.1f m/s' % (s3, mn[0], mn[1], mx, mx * 3.6, v))
step = spec.get('cp_step', 3)
inInv = lambda s: any(a - 6 <= s <= b + 6 for _, a, b in inv_ground)
CR = []; i = 0  # rangs des points de contrôle : tous les `step` points, chaque point dans les inversions
while i < nr: CR.append(i); i += 1 if inInv(SG[i]) else step
tagr = {}
for k, s in T.items():
    ti = round(s * n / L0) if not inv_ground else min(range(nr), key=lambda r: abs(SG[r] - s))
    tagr.setdefault(max(c for c in CR if c <= ti), []).append(k)
cps = []
for i in CR:
    w = rows[i]; row = [round(w[0], 2), round(w[1], 2), round(w[2], 2), round(w[3], 1) if w[3] else 0]
    row += tagr.get(i, [])
    cps.append(row)

# tunnels : conversion de s (au sol) en abscisse du moteur (longueur 3D le long de la spline Catmull-Rom des points de contrôle, comme engine/core.js)
def engine_s(sg):
    m = len(cps); SUB = 24
    if inv_ground:  # rang fractionnaire du point de s au sol sg, puis indice fractionnaire du point de contrôle
        r = next((q for q in range(1, nr) if SG[q] >= sg), nr - 1); rf = r - 1 + (sg - SG[r - 1]) / ((SG[r] - SG[r - 1]) or 1)
        jj = max(q for q in range(len(CR)) if CR[q] <= rf); nx_ = CR[jj + 1] if jj + 1 < len(CR) else nr; fi = jj + (rf - CR[jj]) / (nx_ - CR[jj])
    else: fi = sg * n / L0 / step
    def pt(i, t):
        P = [cps[(i + d) % m] for d in (-1, 0, 1, 2)]; t2 = t * t; t3 = t2 * t
        return [.5 * ((2 * P[1][k]) + (-P[0][k] + P[2][k]) * t + (2 * P[0][k] - 5 * P[1][k] + 4 * P[2][k] - P[3][k]) * t2 + (-P[0][k] + 3 * P[1][k] - 3 * P[2][k] + P[3][k]) * t3) for k in range(3)]
    i0 = int(fi); acc = 0.0; prev = None
    for i in range(i0 + 1):
        for j in range(SUB):
            q = pt(i, j / SUB)
            if prev: acc += math.dist(q, prev)
            prev = q
            if i == i0 and j == int(round((fi - i0) * SUB)) % SUB: return acc
    return acc
tunnels = [[round(engine_s(a), 1), round(engine_s(b), 1)] for a, b in tunnels_ground]
print('tunnels : s au sol', tunnels_ground, '-> s moteur', tunnels)
inversions = [{'type': iv['type'], 's0': round(engine_s(a), 1), 's1': round(engine_s(b), 1), 'n': iv.get('n', 1)} for iv, a, b in sorted(inv_ground, key=lambda q: q[1])]
if inversions: print('inversions (s moteur) :', inversions)

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
res = {'cps': cps, **({'tunnels': tunnels} if tunnels else {}), **({'inversions': inversions} if inversions else {}), 'feats': feats, 'others': others,
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
    for i in range(nr):
        h = HS[i]; c = (int(min(255, 40 + h * 7)), int(max(0, 200 - h * 6)), 40)
        dr.line([P(P2[i]), P(P2[(i + 1) % nr])], fill=c, width=4)
        if i % 25 == 0: x, y = P(P2[i]); dr.ellipse([x - 3, y - 3, x + 3, y + 3], fill='black'); dr.text((x + 5, y - 12), '%d|%.0f' % (SG[i], h), fill='black')
    im.save(png); print('aperçu', png)
