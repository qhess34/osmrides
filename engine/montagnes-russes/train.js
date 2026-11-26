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
   - loadSide : voir quai.js (côté de la file par rapport à la voie de gare).
   Les valeurs déduites sont exposées dans DEDUIT (éditeur, comparaison avec SITE). */
/* Arrêt dans la zone de freinage ZF (S_HOLD), même règle que les autres zones : fin de la zone lue dans OSM (repère fin), sinon 4 m avant la gare ; pont droit : bout du
   rail de transfert (tr1 - yard.post) ; ramené 0,6 m (ESTIMÉ) avant un aiguillage en amont de la gare (yard.back) qui commence dans la zone. SITE.holdBack : ignoré. */
function holdStop(){const Y=SITE.yard||{},P=(SITE_BASE.yard||Y).post;if(Y.device==='traverser'&&TAG.tr1!=null)return TAG.tr1-(P!=null?P:.6);
  let s=TAG.fin!=null?TAG.fin:L-4;if(Y.back&&Y.device!=='traverser'&&(Y.at==null||Y.at==='station'||Y.at==='St')&&Y.b>0){const a=S_ST-Y.b+L;if(a>TAG.brk&&a-.6<s)s=a-.6;}return s;}
const D_DROP=(()=>{if(TAG.lift1==null)return null;const a=TAG.lift1;let top=-1e9,sTop=a;for(let s=a;s<=a+60&&s<L-5;s+=.5){const h=hAt(s);if(h>top){top=h;sTop=s;}}
  for(let s=sTop;s<=a+150&&s<L-5;s+=.5)if(hAt(s)<top-1)return +(s-a).toFixed(1);return null;})();
const S_ST=stationStop(),S_LIFT0=TAG.lift0,S_LIFT1=TAG.lift1,S_REL=S_LIFT1+TLEN*.75,S_BRK=TAG.brk,S_HOLD=holdStop(),S_DROP=S_LIFT1+(SITE.dropAfter!=null?SITE.dropAfter:D_DROP!=null?D_DROP:14);

/* Faisabilité du profil (osmrides#53 lot 2, éditeur) : le train part du haut du lift (S_REL, 5,5 m/s) et suit la gravité jusqu'au début de la première zone de freinage,
   avec l'accélération de exploitation.js (pente, roulement, traînée ; usure 30, ESTIMÉE), sans le plancher de vitesse PH.vmin. Rend la vitesse la plus basse et son abscisse ;
   « bloque » = le train s'arrêterait (ou ne dépasserait pas PH.vmin) avant la fin : profil infaisable. Estimation, hors freins de bloc et trim. null sans lift. */
function faisabilite(){if(S_LIFT1==null)return null;const end=typeof BZ0!=='undefined'&&BZ0.length?BZ0[0]:S_BRK!=null?S_BRK:L-4,ds=.25;let e=5.5*5.5/2,vm=5.5,sm=S_REL;
  for(let s=S_REL;s<end;s+=ds){const v=Math.sqrt(Math.max(0,2*e)),a=-9.81*(hAt(s)-hAt(s-TLEN))/TLEN-(PH.roll+30*.0003)-PH.drag*v*v;e+=a*ds;if(e<0)e=0;const w=Math.sqrt(2*e);if(w<vm){vm=w;sm=s;}}
  return {vMin:+vm.toFixed(2),s:+sm.toFixed(1),sOrig:+(sm*PROF.L0/L).toFixed(1),bloque:vm<PH.vmin,vmin:PH.vmin,fin:+end.toFixed(1)};}
// Repères lus dans OSM par tools/make_site.py (roller_coaster:track), zones de freinage dans l'ordre de marche : blkN / bzN = arrêt / début des zones suivies d'un canton,
// brk / fin = début / fin de la dernière zone avant la gare (ou avant le rail du pont) ; tr0/tr1 = rail de transfert (pont transbordeur) ; pre0/pre1 = zone entre le pont et la gare.
const BLK=Object.keys(TAG).filter(k=>/^blk\d+$/.test(k)).map(k=>TAG[k]).sort((a,b)=>a-b); // freins de bloc en parcours
const BZ0=BLK.map(b=>{const k=Object.keys(TAG).find(q=>/^blk\d+$/.test(q)&&TAG[q]===b),a=TAG['bz'+k.slice(3)];return a!=null&&a<b?a:b-9;}); // début de chaque zone de frein de bloc (OSM, sinon 9 m avant l'arrêt)
// courbure signée (virage à droite > 0) : sert au balancement des bobs dans la gouttière
const KAP=TR.map((f,i)=>{const a=TR[(i-2+N)%N].T,b=TR[(i+2)%N].T;return ((b.x-a.x)*f.R.x+(b.z-a.z)*f.R.z)/(4*DS);});
/* Zones de freinage (propriétaire, 26/11, #57 point 4) : toutes ordinaires, « Frein 1…n » dans l'ordre de marche, chacune attend que la section suivante soit libre.
   Ids : B1…Bn (BLK, suivies d'un canton), ZF = B<n+1> (dernière avant la gare ou le rail du pont : S_BRK → S_HOLD), ZP = B<n+2> (entre le pont et la gare, si OSM la donne :
   repères pre0/pre1, PSB_A → S_PSB ; le train y attend la gare libre). BI(z) : indice dans BLK, sinon -1. Anciens ids 'Fin' / 'Pre' (sauvegardes, SITE.yard.at,
   SITE.zones) : Z_OLD. SITE.preBrake et SITE.holdBack (anciennes clés) : ignorés. */
const ZF='B'+(BLK.length+1),ZP='B'+(BLK.length+2),Z_OLD={Fin:ZF,Pre:ZP},BI=z=>{const m=/^B(\d+)$/.exec(z),i=m?m[1]-1:-1;return i<BLK.length?i:-1;};
const PSB=TAG.pre0!=null&&TAG.pre1!=null,S_PSB=PSB?Math.min(TAG.pre1,L-.5):L,PSB_A=PSB?(TAG.pre0<S_PSB-TLEN?TAG.pre0:S_PSB-(TLEN+.5)):L;
if(PSB&&PSB_A<S_HOLD+1)throw new Error('Repères pre0/pre1 : pas de place entre la zone de freinage précédente et la gare');
/* Zones toutes équivalentes (propriétaire, issue #36) : la gare est une zone d'attente comme les autres ; entre deux zones d'attente consécutives, un canton ordinaire ;
   le garage est branché sur une zone d'attente quelconque du circuit, YZ = SITE.yard.at : 'St' (gare) ou 'B<k>' (frein k) ; alias compatibles 'station' = 'St',
   'brake' / 'Fin' = ZF, 'Pre' = ZP. ANCH = point d'arrêt de l'avant du train dans cette zone (point de raccordement).
   Pont transbordeur droit : seulement sur ZF (sa géométrie suit le rail de transfert OSM, S_HOLD). Aiguillage en amont (yard.back) : gare ou zone à marche arrière (contrôle après ZONES). */
// Déclaration à la couche « voies » (engine/voies/reseau.js) : longueur des trains, hauteur du garage, zones d'attente dans l'ordre de marche, raccordement du garage.
(()=>{const YD=SITE.yard;const YZ=(a=>a==null||a==='station'?'St':a==='brake'?ZF:Z_OLD[a]||String(a))(YD.at),k=/^B(\d+)$/.exec(YZ);
if(YZ!=='St'&&!(k&&+k[1]>=1&&+k[1]<=BLK.length+(PSB?2:1)))throw new Error('SITE.yard.at : zone d\'attente inconnue « '+YD.at+' » (St, B1…B'+(BLK.length+(PSB?2:1))+', ou les alias station / brake)');
if(YD.device==='traverser'&&YZ!==ZF)throw new Error('SITE.yard : pont transbordeur droit seulement sur la zone de freinage qui précède le pont (at:\'brake\')');
  const fr=(id,s,o)=>Object.assign({id,s,dit:'le frein '+id.slice(1)},o);
  Object.assign(VOIES,{long:TLEN,hauteur:ST_Y,raccord:YZ,
    attentes:[{id:'St',s:S_ST,dit:'la gare',conseil:' (passez au besoin un frein en MANU, serré, pour retenir l\'autre train).'}]
      .concat(BLK.map((b,i)=>fr('B'+(i+1),b,{bloc:true})),[fr(ZF,S_HOLD)],PSB?[fr(ZP,S_PSB)]:[])});})();
