'use strict';
/* ══════════ TRAINS, ZONES DU CIRCUIT (repères OSM de la voie, engine/voies/trace.js) ══════════ */
const BOB=SITE.kind==='bob',INV=SITE.kind==='inverted',STL=SITE.kind==='steel',PH=Object.assign({roll:.098,drag:.0006,vmin:3},SITE.phys);
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
/* Valeurs déduites (osmrides#53, décision du propriétaire : SITE ne les donne plus, l'éditeur ne sert qu'à corriger un cas particulier ; priorité GAME.site > SITE > déduction) :
   - dropAfter : distance entre le haut du lift (S_LIFT1) et le point où la voie redescend, déduite du profil des hauteurs : sommet atteint dans les 60 m qui suivent le lift,
     puis premier point à plus de 1 m sous ce sommet (seuil de 1 m ESTIMÉ ; sert au cri des passagers). Sans lift : 14 m (valeur d'origine du moteur).
   - holdBack : distance entre l'arrêt au frein final et la fin du circuit (L - S_HOLD) ; sans SITE.holdBack, S_HOLD vient du rail de transfert, sinon de la fin du frein final OSM (repère fin), sinon 4 m.
   - loadSide : voir quai.js (côté de la file par rapport à la voie de gare).
   Les valeurs déduites sont exposées dans DEDUIT (éditeur, comparaison avec SITE). */
const D_DROP=(()=>{if(TAG.lift1==null)return null;const a=TAG.lift1;let top=-1e9,sTop=a;for(let s=a;s<=a+60&&s<L-5;s+=.5){const h=hAt(s);if(h>top){top=h;sTop=s;}}
  for(let s=sTop;s<=a+150&&s<L-5;s+=.5)if(hAt(s)<top-1)return +(s-a).toFixed(1);return null;})();
const S_ST=stationStop(),S_LIFT0=TAG.lift0,S_LIFT1=TAG.lift1,S_REL=S_LIFT1+TLEN*.75,S_BRK=TAG.brk,S_HOLD=SITE.holdBack!=null?L-SITE.holdBack:SITE.yard&&SITE.yard.device==='traverser'&&TAG.tr1!=null?TAG.tr1-(SITE.yard.post!=null?SITE.yard.post:.6):TAG.fin!=null?TAG.fin:L-4,S_DROP=S_LIFT1+(SITE.dropAfter!=null?SITE.dropAfter:D_DROP!=null?D_DROP:14);

/* Faisabilité du profil (osmrides#53 lot 2, éditeur) : le train part du haut du lift (S_REL, 5,5 m/s) et suit la gravité jusqu'au début du premier frein de bloc (sinon le frein final),
   avec l'accélération de exploitation.js (pente, roulement, traînée ; usure 30, ESTIMÉE), sans le plancher de vitesse PH.vmin. Rend la vitesse la plus basse et son abscisse ;
   « bloque » = le train s'arrêterait (ou ne dépasserait pas PH.vmin) avant la fin : profil infaisable. Estimation, hors freins de bloc et trim. null sans lift. */
function faisabilite(){if(S_LIFT1==null)return null;const end=typeof BZ0!=='undefined'&&BZ0.length?BZ0[0]:S_BRK!=null?S_BRK:L-4,ds=.25;let e=5.5*5.5/2,vm=5.5,sm=S_REL;
  for(let s=S_REL;s<end;s+=ds){const v=Math.sqrt(Math.max(0,2*e)),a=-9.81*(hAt(s)-hAt(s-TLEN))/TLEN-(PH.roll+30*.0003)-PH.drag*v*v;e+=a*ds;if(e<0)e=0;const w=Math.sqrt(2*e);if(w<vm){vm=w;sm=s;}}
  return {vMin:+vm.toFixed(2),s:+sm.toFixed(1),sOrig:+(sm*PROF.L0/L).toFixed(1),bloque:vm<PH.vmin,vmin:PH.vmin,fin:+end.toFixed(1)};}
// Repères lus dans OSM par tools/make_site.py (roller_coaster:track) : blkN = arrêt du frein de bloc N, bzN = début de sa zone ; brk/fin = début / fin du frein final ;
// tr0/tr1 = rail de transfert (pont transbordeur) ; pre0/pre1 = frein avant gare. S_HOLD (arrêt au frein final) : SITE.holdBack s'il est donné, sinon fin du rail de transfert
// (pont droit), sinon fin du frein final OSM (fin), sinon 4 m avant la gare.
const BLK=Object.keys(TAG).filter(k=>/^blk\d+$/.test(k)).map(k=>TAG[k]).sort((a,b)=>a-b); // freins de bloc en parcours
const BZ0=BLK.map(b=>{const k=Object.keys(TAG).find(q=>/^blk\d+$/.test(q)&&TAG[q]===b),a=TAG['bz'+k.slice(3)];return a!=null&&a<b?a:b-9;}); // début de chaque zone de frein de bloc (OSM, sinon 9 m avant l'arrêt)
// courbure signée (virage à droite > 0) : sert au balancement des bobs dans la gouttière
const KAP=TR.map((f,i)=>{const a=TR[(i-2+N)%N].T,b=TR[(i+2)%N].T;return ((b.x-a.x)*f.R.x+(b.z-a.z)*f.R.z)/(4*DS);});
/* Frein avant gare (SITE.preBrake:{back, len, name}) : zone de freinage de stockage juste avant l'entrée en gare, un train de long, avec pneus.
   Arrêt de l'avant du train à S_PSB = L - back (back : distance au début de la gare, s=0) ; zone de PSB_A à S_PSB. Le train qui quitte
   le frein final (ou le rail mobile du parcours) va s'y arrêter et y attend que la gare soit libre. */
// Repères OSM pre0/pre1 (tools/make_site.py) : utilisés si back / len ne sont pas donnés.
const PSB=SITE.preBrake||null,S_PSB=PSB?(PSB.back==null&&TAG.pre1!=null?Math.min(TAG.pre1,L-.5):L-(PSB.back!=null?PSB.back:1)):L,
  PSB_A=PSB?(PSB.len==null&&TAG.pre0!=null&&TAG.pre0<S_PSB-TLEN?TAG.pre0:S_PSB-(PSB.len||TLEN+.5)):L;
if(PSB&&PSB_A<S_HOLD+1)throw new Error('SITE.preBrake : pas de place entre le frein final et la gare');
/* Zones toutes équivalentes (propriétaire, issue #36) : la gare est une zone d'attente comme les autres ; entre deux zones d'attente consécutives, un canton ordinaire ;
   le garage est branché sur une zone d'attente quelconque du circuit, YZ = SITE.yard.at : 'St' (gare), 'B<k>' (frein de bloc k), 'Fin' (frein final), 'Pre' (frein avant gare) ;
   alias compatibles 'station' = 'St', 'brake' = 'Fin'. ANCH = point d'arrêt de l'avant du train dans cette zone (point de raccordement). « Frein final » n'est plus qu'un nom.
   Pont transbordeur droit : seulement sur le frein final (sa géométrie suit le rail de transfert OSM, S_HOLD). Aiguillage en amont (yard.back) : gare ou zone à marche arrière (contrôle après ZONES). */
// Déclaration à la couche « voies » (engine/voies/reseau.js) : longueur des trains, hauteur du garage, zones d'attente dans l'ordre de marche, raccordement du garage.
(()=>{const YD=SITE.yard;const YZ=(a=>a==null||a==='station'?'St':a==='brake'?'Fin':String(a))(YD.at);
if(!/^(St|Fin|Pre|B\d+)$/.test(YZ)||(YZ==='Pre'&&!PSB)||(YZ[0]==='B'&&!(+YZ.slice(1)>=1&&+YZ.slice(1)<=BLK.length)))throw new Error('SITE.yard.at : zone d\'attente inconnue « '+YD.at+' » (St, B1…B'+BLK.length+', Fin'+(PSB?', Pre':'')+', ou les alias station / brake)');
if(YD.device==='traverser'&&YZ!=='Fin')throw new Error('SITE.yard : pont transbordeur droit seulement sur le frein final (at:\'brake\')');
  Object.assign(VOIES,{long:TLEN,hauteur:ST_Y,raccord:YZ,
    attentes:[{id:'St',s:S_ST,dit:'la gare',conseil:' (bloquez au besoin l\'autre train au frein final).'}]
      .concat(BLK.map((b,i)=>({id:'B'+(i+1),s:b,bloc:true,dit:'le frein de bloc '+(i+1)})),[{id:'Fin',s:S_HOLD,dit:'le frein final',horsP:' : entrée en gare bloquée.'}],
        PSB?[{id:'Pre',s:S_PSB,dit:'« '+(PSB.name||'Frein avant gare')+' »'}]:[])});})();
