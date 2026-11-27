#!/usr/bin/env node
'use strict';
// Import OSM en ligne de commande (docs/ref/import-osm.md) : même calcul que l'éditeur (editor/import-osm.js), sans réseau.
//   node tools/import-osm.js <extrait.osm|.json>[,<autre>…] <fiche.json> <sortie.data.js> [--actuel=<fichier.data.js>] [--cats=circuit,batiments,…] [--sans-nouveaux] [--log]
// --actuel : fichier actuel (réimport sélectif : ce qui n'est pas choisi en est repris tel quel ; aperçu des écarts) ; --cats : catégories (défaut : toutes) ;
// --sans-nouveaux : sans f.t ni OSM.levels (comparaison avec un fichier de tools/make_site.py) ; --log : journal du calcul.
const fs = require('fs'), I = require('../editor/import-osm.js');
const a = process.argv.slice(2), pos = a.filter(x => !x.startsWith('--')), opt = k => (a.find(x => x.startsWith('--' + k + '=')) || '').slice(k.length + 3);
if (pos.length < 3) { console.error('usage : node tools/import-osm.js <extrait.osm|.json>[,…] <fiche.json> <sortie.data.js> [--actuel=f] [--cats=…] [--sans-nouveaux] [--log]'); process.exit(2); }
const els = I.mergeElements(pos[0].split(',').map(f => fs.readFileSync(f, 'utf8')));
const B = I.build(els, fs.readFileSync(pos[1], 'utf8'), { sansNouveaux: a.includes('--sans-nouveaux') });
const cur = opt('actuel') ? fs.readFileSync(opt('actuel'), 'utf8') : null, cats = opt('cats') ? opt('cats').split(',') : null;
const res = I.merge(cur, B, cats), t = I.text(res);
if (a.includes('--log')) console.log(B.log.join('\n'));
for (const w of B.warnings) console.log('ATTENTION', w);
if (cur) for (const [c, s] of Object.entries(I.summary(cur, res))) if (s.changes.length) console.log(s.label + ' : ' + s.changes.length + ' écart(s)\n  ' + s.changes.slice(0, 30).join('\n  ') + (s.changes.length > 30 ? '\n  …' : ''));
fs.writeFileSync(pos[2], t); console.log('écrit', pos[2], JSON.stringify(I.counts(res)));
