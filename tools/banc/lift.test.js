// Micro-test (c) : chaîne du lift (exploitation.js stepChaine / CHAINE, dessin.js, commit 3287a2f ; docs/ref/voie.md « Rendu de la voie »).
// AUTO : démarre à l'approche du train, rampe, s'arrête après son départ ; MANU : marche / arrêt au pupitre, refusés en AUTO ; bloquée net par une panne ou l'arrêt d'urgence.
// État dessiné lu dans les appels de dessin : taquets (couleur du trait : gris = arrêtée, clair = entraînée, brique = bloquée), phase CHAINE.pv qui avance seulement chaîne en marche.
require('./lib.js').essai('lift', async ({ ouvrir, ok }) => {
  const page = await ouvrir({}, { mode: 'career', width: 320, height: 240 }); // carrière : le bac à sable remet les pannes à zéro à chaque pas
  const r = await page.evaluate(() => {
    const S = { arret: '#9c9889', marche: '#d6d0b8', bloque: '#a2574b' }, trace = [], st0 = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (p) { if (p && Object.values(S).includes(this.strokeStyle)) trace.push(this.strokeStyle); return st0.apply(this, arguments); };
    const m = Math.floor((S_LIFT0 + S_LIFT1) / 2), f = frameAt(m, mkF()); cam.x = f.p.x; cam.z = f.p.z; cam.s = 10;
    const fr = n => { for (let i = 0; i < n; i++) { step(1 / 30); if (i % 5 === 4) render(5 / 30); } }; // le dessin (8 ms l'image) tous les 5 pas seulement
    const couleur = () => { trace.length = 0; render(1 / 30); const c = new Set(trace); return c.size === 1 ? [...c][0] : null; };
    const t = trains[0], o = trains[1], R = {}; o.st = 'garage'; t.wear = 0; G.wear.chain = 0; G.liftBroken = false;
    const place = (s, v) => { t.st = 'run'; t.s = s; t.v = v; t.wait = false; };
    fr(60); R.v0 = CHAINE.v; R.c0 = couleur();                                             // AUTO, train loin : chaîne arrêtée
    place(S_LIFT0 - 20, 0); const rampe = []; for (let i = 0; i < 150; i++) { t.s = S_LIFT0 - 20; t.v = 0; step(1 / 30); rampe.push(CHAINE.v); } render(1 / 30);
    R.vmax = Math.max(...rampe); R.lift_v = LIFT_V; R.v1s = rampe[29]; R.v4s = rampe[119]; // AUTO, train à moins de 25 m du pied : chaîne montée en rampe
    R.cMarche = couleur(); const p0 = CHAINE.pv; fr(30); R.pvMarche = CHAINE.pv - p0;
    place(S_LIFT1 + 5, 5); fr(30 * (LIFT_APRES + LIFT_RAMPE_FREIN + 2)); R.vApres = CHAINE.v; R.cApres = couleur();  // train parti du sommet : s'arrête après LIFT_APRES
    const p1 = CHAINE.pv; fr(30); R.pvArret = CHAINE.pv - p1;
    // MANU
    const off0 = G.liftOff; act('zone', 'Lift:t'); R.refuseAuto = !G.liftM && G.liftOff === off0;                    // en AUTO le bouton marche est refusé
    act('zone', 'Lift:m'); R.manu = G.liftM; R.manuOff = G.liftOff;                        // MANU : chaîne arrêtée comme elle était
    fr(30); R.manuV = CHAINE.v;
    act('zone', 'Lift:t'); fr(30 * LIFT_RAMPE_ACC + 10); R.marcheV = CHAINE.v; R.cManu = couleur();
    act('zone', 'Lift:t'); fr(30 * LIFT_RAMPE_FREIN + 10); R.arretV = CHAINE.v; R.cArret = couleur();
    act('zone', 'Lift:t'); fr(30 * LIFT_RAMPE_ACC + 10);                                     // relancée, puis bloquée
    G.liftBroken = true; fr(2); R.panneV = CHAINE.v; R.cPanne = couleur(); const p2 = CHAINE.pv; fr(30); R.pvPanne = CHAINE.pv - p2; G.liftBroken = false;
    fr(30 * LIFT_RAMPE_ACC + 10); G.estop = true; fr(2); R.urgV = CHAINE.v; R.cUrg = couleur(); G.estop = false;
    return R; });
  ok('AUTO, train loin : chaîne arrêtée, taquets gris', r.v0 === 0 && r.c0 === '#9c9889', r);
  ok('AUTO, train à moins de 25 m du pied : chaîne en rampe (3 s) jusqu\'à la vitesse du lift', r.v1s > .3 && r.v1s < .6 * r.lift_v && Math.abs(r.v4s - r.lift_v) < .01, r);
  ok('chaîne en marche : taquets clairs, phase visuelle qui avance', r.cMarche === '#d6d0b8' && r.pvMarche > .5, r);
  ok('AUTO, train parti du sommet : chaîne arrêtée après le délai, taquets gris immobiles', r.vApres === 0 && r.cApres === '#9c9889' && r.pvArret < .01, r);
  ok('AUTO : marche / arrêt refusés, MANU garde l\'état du moment (arrêtée)', r.refuseAuto && r.manu && r.manuOff && r.manuV === 0, r);
  ok('MANU : marche monte à la vitesse du lift (taquets clairs), arrêt la ramène à 0 (gris)', Math.abs(r.marcheV - r.lift_v) < .01 && r.cManu === '#d6d0b8' && r.arretV === 0 && r.cArret === '#9c9889', r);
  ok('panne du lift : chaîne bloquée net, taquets brique, phase immobile', r.panneV === 0 && r.cPanne === '#a2574b' && r.pvPanne < .01, r);
  ok('arrêt d\'urgence : chaîne bloquée net, taquets brique', r.urgV === 0 && r.cUrg === '#a2574b', r);
  await page.close();
});
