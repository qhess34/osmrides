'use strict';
/* ══════════ ZONES DES MONTAGNES RUSSES (commande commune : engine/voies/zones.js ; docs/manoeuvres.md, « Principe de commande ») ══════════
   Le joueur commande des zones, jamais des trains : St (gare), Lift, B1…Bn (freins de bloc), Fin (frein final), RA / RB (pont droit :
   rail A du circuit, rail B du chariot), L1…Ln (voies de garage). Chaque zone a des freins (G.zk[z] = serrés) et, selon SITE.zones,
   des moteurs (pneus / roues de propulsion) : bouton Avancer au pupitre (pas de Reculer, #58 point 7 ; Arrêt seulement sur une zone sans freins, serrer les freins arrête déjà) ;
   moteurs de la gare : dessinés, commandés par le seul bouton Départ. Les zones de freinage B*, Fin, RA sont en AUTO par défaut (cantonnement) ;
   le joueur peut passer chacune en MANU (G.zm[z]) : ses freins et moteurs obéissent alors au pupitre. Gare, rail B et voies : toujours manuels.
   SITE.zones : { <zone ou groupe B / L> : {brake, drive} } (drive : true | 'fwd' | false) ; défauts : freins et moteurs partout, freins de bloc en marche avant seule
   (drive:'fwd', propriétaire 2026-11-17 : roues de propulsion, marche avant seule ; disposition ESTIMÉE ; true et 'fwd' se commandent pareil depuis la fin de l'AR). */
const ZCFG=z=>Object.assign({brake:true,drive:/^B\d/.test(z)?'fwd':true},SITE.zones&&SITE.zones[z.replace(/\d+$/,'')],SITE.zones&&SITE.zones[z]);
const ZONES=[{id:'St',name:'Gare',sec:'st'},{id:'Lift',name:'Lift',sec:'lift'}]
  .concat(BLK.map((_,i)=>({id:'B'+(i+1),name:'Bloc '+(i+1),sec:'brk',auto:true,bloc:true})),[{id:'Fin',name:'Frein final',sec:'brk',auto:true}],
    SG?[{id:'RB',name:YD.railName||'Rail du pont',sec:'brk',auto:true}]:TRAV?[{id:'RA',name:RA?RAS:'Rail du parcours',sec:'brk',auto:true},{id:'RB',name:'Rail du chariot',sec:'brk'}]:[],
    PSB?[{id:'Pre',name:PSB.name||'Frein avant gare',sec:'brk',auto:true}]:[],
    LANES.map((l,j)=>({id:'L'+(j+1),name:LANES.length>1?'Voie '+(j+1):l.name,sec:'gar'})))
  .map(Z=>Z.id==='Lift'?Z:Object.assign(Z,ZCFG(Z.id),Z.id==='St'?{brake:false}:{},Z.sec==='gar'?{brake:false,drive:false}:{})); // voies : bouton unique « Envoyer le train » #zL<k>_d (issues #11 et #61, laneDispatch dans engine/voies/garage.js), freins automatiques sans bouton
/* Frein de ralentissement (SITE.zones.B1.trim:{v}) : en passage normal (zone en AUTO, canton suivant libre), le train y est ramené à la vitesse v (m/s) puis continue ; il s'arrête
   seulement si le canton suivant est occupé ou si les freins sont serrés au pupitre. Par zone de frein de bloc : BTRIM[i] (m/s, 0 = pas de ralentissement). */
const BTRIM=BLK.map((_,i)=>{const Z=ZONES.find(o=>o.id==='B'+(i+1));return Z&&Z.trim&&Z.trim.v||0;});
/* Freins de bloc réglés par zone (osmrides#53, éditeur : GAME.site.zones.B<k>, bornes ESTIMÉES dans engine/montagnes-russes/schema.js) :
   - trim.v : vitesse limite (m/s), voir ci-dessus ; - launch : vitesse de lancement (m/s) à la relance d'un train arrêté, à la place de sa vitesse d'entrée (au moins VPROP, au plus trim.v) ;
   - stop : arrêt obligatoire en AUTO (le train s'arrête au frein même si le canton suivant est libre) ; - hold : temps d'arrêt (s) avant la relance, seulement avec stop.
   Sans ces clés rien ne change. BLAUNCH, BSTOP, BHOLD : par frein de bloc. */
const BZONE=i=>ZONES.find(o=>o.id==='B'+(i+1))||{};
const BLAUNCH=BLK.map((_,i)=>+BZONE(i).launch||0),BSTOP=BLK.map((_,i)=>!!BZONE(i).stop),BHOLD=BLK.map((_,i)=>Math.max(0,+BZONE(i).hold||0));
/* Roues de propulsion des freins de bloc (BDRV[i]) : en MANU, un train arrêté au frein n'en repart qu'au bouton AVANCER (#zB<k>_f, freins relâchés, canton suivant libre),
   poussé jusqu'à VPROP puis rendu à la gravité quand sa queue a passé le frein ; sans roues (drive:false), le relâchement suffit. En AUTO : inchangé. VPROP = PH.vmin, ESTIMÉ. */
// Aiguillage en amont (issue #38) : a > un train, sinon le train arrêté dans la zone de raccordement est sur l'appareil (entrée au garage : « Envoyer le train » de la voie)
if(LBK&&YZ!=='St'&&YD.a<TLEN+1)console.warn('SITE.yard.back : a = '+YD.a+' m, moins d\'un train : le train arrêté '+YZ+' est sur l\'appareil');
const BDRV=BLK.map((_,i)=>!!(ZONES.find(o=>o.id==='B'+(i+1))||{}).drive),VPROP=PH.vmin;
// S_PRE : arrêt avant le chariot du pont droit (aucun rail en ligne, frein final serré, rail occupé) = fin du frein final OSM (repère fin) si elle est avant le pont.
const S_PRE=TAG.fin!=null&&TAG.fin<R0-.4&&TAG.fin>S_BRK?TAG.fin:R0-.4;
const DEV_HOLD=HOLD_Z&&HOLD_Z[0]==='B'?+HOLD_Z.slice(1)-1:-1,devHoldAt=i=>devHoldIn('B'+(i+1)); // frein de bloc qui retient le train avant l'appareil (engine/voies/garage.js HOLD_Z)
const stHeld=()=>trains.some(t=>t.st==='station'&&!t.depReq); // freins de gare : serrés automatiquement tant qu'un train est à quai, relâchés par la seule séquence Départ
function tZone(t){ // zone où se trouve un train
  if(t.st==='station')return 'St';
  if(t.st==='garage')return TRAV&&(t.lane<0||onCar(t))?'RB':'L'+(t.lane+1);
  const z=zoneOf(t.s);
  if(z==='station')return 'St';
  if(z==='lift'||z==='prelift')return 'Lift';
  if(z==='course'){for(let i=0;i<BLK.length;i++)if(t.s>BLK[i]-10&&t.s<BLK[i]+.6)return 'B'+(i+1);return '';}
  if(PSB&&t.s>PSB_A)return 'Pre';
  if(TRAV&&t.s>R0+.5)return SG||bIn()?'RB':'RA';
  return 'Fin';
}
