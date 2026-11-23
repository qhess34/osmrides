'use strict';
/* ══════════ TRAINS, ZONES DU CIRCUIT (repères OSM de la voie, engine/voies/trace.js) ══════════ */
const BOB=SITE.kind==='bob',INV=SITE.kind==='inverted',STL=SITE.kind==='steel',LS=SITE.loadSide||1,PH=Object.assign({roll:.098,drag:.0006,vmin:3},SITE.phys);
const ST_Y=OSM.cps[0][1],CAR=SITE.car.len,NCARS=SITE.car.n,TLEN=CAR*NCARS,CSEATS=SITE.car.seats||2,SEATS=NCARS*CSEATS;
// Place r (0…CSEATS-1) d'un wagon : [décalage le long du wagon, décalage latéral]. Côte à côte par rangées de 2, ou l'un derrière l'autre (car.inline).
// car.abreast : nombre de places côte à côte par rangée (défaut 2 ; ex. 4 pour un wagon de coaster inversé, une seule rangée).
const S_COLS=SITE.car.inline?1:Math.min(SITE.car.abreast||2,CSEATS),S_ROWS=Math.ceil(CSEATS/S_COLS);
// car.inline : places réparties sur la longueur utile du wagon (≈ 45 % chacune pour deux places), un peu en arrière pour laisser la lapbar devant le passager avant.
// car.pitch : écart (m) d'axe à axe entre deux places l'une derrière l'autre (car.inline), centrées sur le wagon ; sans pitch : ≈ 45 % de la longueur.
const seatOff=r=>{const c=r%S_COLS,w=Math.floor(r/S_COLS),d=Math.min(.66*(S_ROWS-1),CAR-.5);return [S_ROWS<2?0:SITE.car.inline?(SITE.car.pitch?SITE.car.pitch*((S_ROWS-1)/2-w):CAR*.45*(.5-w/(S_ROWS-1))*(S_ROWS>2?2*(S_ROWS-1)/S_ROWS:1)-.05):d/2*(1-2*w/(S_ROWS-1))-.03,S_COLS>2?(c-(S_COLS-1)/2)*.6:S_COLS>1?(c?.33:-.33):0];};
// Sécurités des passagers : SITE.car.restraint = 'lapbar' | 'otsr' (harnais par-dessus les épaules) | 'belt' ; SITE.car.restraintPer = 'seat' | 'car' (une barre par place, ou une barre commune au wagon).
// Défauts par SITE.kind : wood → lapbar par place (Zeus, propriétaire), bob → lapbar par wagon (Trace du Hourra, propriétaire), inverted → otsr par place (OzIris), steel → otsr par place (Goudurix, estimé, à confirmer).
const RES_KIND=SITE.car.restraint||({wood:'lapbar',bob:'lapbar',inverted:'otsr',steel:'otsr'})[SITE.kind]||'lapbar',RES_PER=SITE.car.restraintPer||(SITE.kind==='bob'?'car':'seat'),RES_T=1.5,RES_AIR=.5,RES_NAME={lapbar:'lapbars',otsr:'harnais',belt:'ceintures'}[RES_KIND]||'lapbars'; // RES_T : durée d'ouverture / de fermeture (s, estimée)
// Arrêt en gare : SITE.stopBack m avant la fin de gare ; si l'arrière du train dépasserait alors du bâtiment de gare (SITE.stationPoly), le train avance d'autant
// (au plus jusqu'à la fin de gare TAG.st1) : un train long dans une gare courte reste sous le toit, portillons compris.
// Arrêt en gare : st1 - SITE.stopBack ; repère OSM « stp » (tools/make_site.py : fin du dernier tronçon tagué station quand la gare est prolongée par des
// tronçons d'un autre type, « moving » d'OzIris, issue #13) : la tête s'arrête là (SITE.stopBack ignoré) ; puis avancé si l'arrière dépasse du bâtiment.
function stationStop(){const s0=TAG.stp!=null?TAG.stp:TAG.st1-(SITE.stopBack||0),P=SITE.stationPoly;if(!P||P.length<3)return s0;
  const pin=(x,z)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i][1]>z)!==(P[j][1]>z)&&x<(P[j][0]-P[i][0])*(z-P[i][1])/(P[j][1]-P[i][1])+P[i][0])c=!c;return c;};
  const f=mkF();let a=null;for(let q=-8;q<=TAG.st1;q+=.1){frameAt(q,f);if(pin(f.p.x,f.p.z)){a=q;break;}}if(a===null)return s0;
  return a+TLEN-s0>.1?Math.min(TAG.st1,a+.3+TLEN):s0;} // dépassement de plus de 10 cm : on avance (marge 0,3 m)
const S_ST=stationStop(),S_LIFT0=TAG.lift0,S_LIFT1=TAG.lift1,S_REL=S_LIFT1+TLEN*.75,S_BRK=TAG.brk,S_HOLD=SITE.holdBack!=null?L-SITE.holdBack:SITE.yard&&SITE.yard.device==='traverser'&&TAG.tr1!=null?TAG.tr1-(SITE.yard.post!=null?SITE.yard.post:.6):TAG.fin!=null?TAG.fin:L-4,S_DROP=S_LIFT1+(SITE.dropAfter||14);
// Repères lus dans OSM par tools/make_site.py (roller_coaster:track) : blkN = arrêt du frein de bloc N, bzN = début de sa zone ; brk/fin = début / fin du frein final ;
// tr0/tr1 = rail de transfert (pont transbordeur) ; pre0/pre1 = frein avant gare. S_HOLD (arrêt au frein final) : SITE.holdBack s'il est donné, sinon fin du rail de transfert
// (pont droit), sinon fin du frein final OSM (fin), sinon 4 m avant la gare.
const BLK=Object.keys(TAG).filter(k=>/^blk\d+$/.test(k)).map(k=>TAG[k]).sort((a,b)=>a-b); // freins de bloc en parcours
const BZ0=BLK.map(b=>{const k=Object.keys(TAG).find(q=>/^blk\d+$/.test(q)&&TAG[q]===b),a=TAG['bz'+k.slice(3)];return a!=null&&a<b?a:b-9;}); // début de chaque zone de frein de bloc (OSM, sinon 9 m avant l'arrêt)
// courbure signée (virage à droite > 0) : sert au balancement des bobs dans la gouttière
const KAP=TR.map((f,i)=>{const a=TR[(i-2+N)%N].T,b=TR[(i+2)%N].T;return ((b.x-a.x)*f.R.x+(b.z-a.z)*f.R.z)/(4*DS);});
