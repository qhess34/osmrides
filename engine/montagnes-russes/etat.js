'use strict';
/* ══════════ ÉTAT DU JEU PROPRE AUX MONTAGNES RUSSES ══════════ */
// état propre au type, ajouté à G (engine/noyau/base.js) : sauvegardé avec lui
Object.assign(G,{auto:true,estop:false,plat:new Array(SEATS).fill(null),platT:0,platR:[],platRT:0,gatesOpen:false,gate:0,resOpen:false,bypass:false,dev:{pos:DEV0,to:DEV0,k:1},ra:{pos:0,to:0,k:1},zm:{},zk:{},liftOff:false,
  wear:{chain:45,track:35,brake:40},liftBroken:false,brakeFault:false});
function mkTrain(i,name,col,col2,wear,st){
  return {i,name,col,col2,wear,st,s:S_ST,v:0,g:0,lane:0,mv:0,blk:false,told:false,seats:new Array(SEATS).fill(null),phase:'board',pt:0,idle:0,
    depReq:false,toPre:false,fdrive:0,outReq:false,hold:0,fault:null,hs:false,entering:false,inBrake:false,inLift:false,failAt:-1,screamed:false,arms:0,rc:new Array(NCARS).fill(0),rcT:0}; // sécurités : rc[k] = ouverture du wagon k (0 verrouillées … 1 ouvertes, animée) ; rcT = wagons à garder ouverts (bits) après le verrouillage, jusqu'au passage d'un opérateur
}
/* Places d'attente des trains au départ (issue #32) : la gare (train 1), les voies de garage (cap), puis, sur le circuit, le frein avant gare (Pre), le frein final
   (Fin, S_HOLD) et les freins de bloc du dernier au premier. TRAIN_MAX = nombre de ces places : SITE.trains (ou GAME.site.trains) est ramené à TRAIN_MAX
   (l'éditeur refuse au-delà, editor/schema.js validate(g, {trainMax})). Les tronçons OSM waiting / brake_run / moving / block_brake donnent ces zones. */
/* Retour d'un train sur le circuit, arrêté au point d'arrêt d'une zone d'attente (sortie de garage, places de départ TRAIN_SPOTS) : état de la zone (frein final :
   déjà passé ses freins ; frein de bloc : arrêté au frein, roues de propulsion) ; la zone le relâche ensuite selon ses règles (cantonnement, appareil). */
function placeAt(t,z){t.st='run';t.s=zStop(z);t.v=0;t.entering=false;t.toPre=false;t.fdrive=0;t.bgo=0;t.brs=0;t.bst=0;t.blk=false;
  if(z==='Fin'){t.inBrake=true;t.hold=1;}else if(z==='Pre'){t.hold=0;}else{const i=+z.slice(1)-1;t.blk=true;if(BDRV[i])t.bst=i+1;}}
const TRAIN_SPOTS=[].concat(PSB?[{s:S_PSB,z:'Pre'}]:[],[{s:S_HOLD,z:'Fin'}],BLK.map((b,i)=>({s:b,z:'B'+(i+1),i})).reverse());
const TRAIN_MAX=1+LANES.reduce((n,l)=>n+(l.cap||1),0)+TRAIN_SPOTS.length;
if(SITE.trains.length>TRAIN_MAX){console.warn('SITE.trains : '+SITE.trains.length+' trains pour '+TRAIN_MAX+' places d\'attente, les suivants sont ignorés');SITE.trains=SITE.trains.slice(0,TRAIN_MAX);}
const trains=SITE.trains.map((c,i)=>mkTrain(i,c.name,c.col,c.col2,c.wear,i?'garage':'station'));
// Trains au garage au départ : voie SITE.trains[i].lane (1…n) si elle a de la place, sinon première voie qui en a ; garage plein : places du circuit (TRAIN_SPOTS)
{const n=LANES.map(()=>0);let k=0;trains.forEach((t,i)=>{if(t.st!=='garage')return;const c=SITE.trains[i].lane,free=j=>j>=0&&j<LANES.length&&n[j]<(LANES[j].cap||1);
  const j=free(c-1)?c-1:LANES.findIndex((l,q)=>free(q));
  if(j>=0){t.lane=j;t.g=LANES[j].stop-n[j]*GSTEP;n[j]++;return;}
  const P=TRAIN_SPOTS[k++];placeAt(t,P.z);t.lane=0;t.g=0;});} // arrêté à son point de freinage, freins serrés
const count=t=>t.seats.reduce((n,s)=>n+(s?1:0),0), seated=t=>t.seats.reduce((n,s)=>n+(s&&s.on?1:0),0);

/* ══════════ BLOCS, DÉPARTS, MAINTENANCE ══════════ */
function stationBusy(self){
  return trains.some(o=>o!==self&&(o.st==='station'||(YZ==='St'&&yardBusy(o))||(o.st==='run'&&(o.entering||o.s<S_ST+TLEN+2))));
}
// Cantonnement : un train ne franchit un frein de bloc que si le canton suivant est libre
const LIFT_NEXT=BLK.length?BLK[0]:L; // fin de la zone qui suit le lift : 1er frein de bloc, sinon le frein final (fin du circuit) ; le train arrivé en haut du lift y est retenu tant que cette zone est occupée (SITE.singleCourse : ancien réglage, ignoré, devenu le comportement par défaut)
const blkEnd=i=>i+1<BLK.length?BLK[i+1]:L;
const onRaSt=o=>RA&&o.st==='run'&&o.s>S_PRE+.3&&o.s<R1+TLEN; // pont droit à rail mobile : o est (en partie) sur le rail mobile du parcours (zone de stockage RA)
const onPsb=o=>PSB&&o.st==='run'&&(o.toPre||o.s>S_HOLD+.5); // o est sur le frein avant gare ou s'y rend (zone de stockage Pre)
// frein avant gare occupé : train arrêté dessus, qui s'y rend, ou qui en sort vers la gare (arrière pas encore entré)
const preBusy=self=>trains.some(o=>o!==self&&o.st==='run'&&(o.toPre||o.s>PSB_A-.5||o.s<TLEN+.3));
const aheadBusy=t=>PSB?preBusy(t):stationBusy(t); // section après le frein final / le rail mobile : frein avant gare s'il existe, sinon la gare
function occupied(a,b,self){
  if(b>=L&&(RA||PSB)){ // dernier canton : frein final, rail mobile et frein avant gare stockent un train chacun (le suivant attend au frein final)
    const z=dansCanton(a,b,self,trains,TLEN);
    return z.some(o=>!onRaSt(o)&&!onPsb(o))||yardBlocks(self,b);}
  return dansCanton(a,b,self,trains,TLEN).length>0||yardBlocks(self,b); // canton qui mène à la zone de raccordement du garage (issue #36) ; train porté par le chariot : seulement chariot en ligne (yardBlocks, engine/garage.js)
}
function blockReason(t){
  if(G.estop)return "arrêt d'urgence";
  if(G.liftOff)return 'lift à l\'arrêt';
  if(HOLD_Z==='St'&&devOff())return DEVN.toLowerCase()+' hors de P, aucune zone de freinage entre la gare et '+DEVL+' pour retenir le train'; // règle de retenue : la gare est la dernière zone d'attente avant l'appareil (HOLD_Z, engine/garage.js)
  if(HOLD_Z==='St'&&trains.some(yardBusy))return 'manœuvre au garage';
  if(G.liftBroken)return 'lift en panne';
  if(G.job&&G.job.lock)return 'maintenance en cours';
  if(G.wear.track>=100)return 'voie hors service';
  if(trains.some(o=>o!==t&&o.st==='run'&&o.s>=S_ST&&o.s<S_LIFT0))return 'zone avant-lift occupée'; // un train attend au pied du lift ; un train sur le lift n'empêche pas de partir (le suivant attend au pied)
  return '';
}
const liftBusy=t=>trains.some(o=>o!==t&&o.st==='run'&&o.s>=S_LIFT0&&o.s<S_REL); // un autre train est sur le lift (ou retenu en haut) : un seul train à la fois sur le lift
const parked=t=>t.st==='garage'||t.st==='station';
const held=t=>t.st==='run'&&t.v===0&&(zoneOf(t.s)==='brake'||t.blk);
// travaux de maintenance (engine/noyau/base.js JOBS) : lift, chaîne, voie, freins, train, sécurités
Object.assign(JOBS,{
  liftFix:{label:'Dépannage du lift',dur:18,cost:250,ok:()=>G.liftBroken,fin(t){G.liftBroken=false;G.wear.chain=Math.max(0,G.wear.chain-15);log('Lift dépanné, la chaîne repart.','good');}},
  chainRev:{label:'Révision de la chaîne',dur:30,cost:450,lock:true,ok:()=>!trains.some(o=>o.st==='run'&&o.s>=S_ST&&o.s<S_REL),fin(t){G.liftBroken=false;G.wear.chain=0;log('Chaîne du lift révisée.','good');}},
  trackRev:{label:'Entretien de la voie',dur:55,cost:900,lock:true,ok:()=>trains.every(o=>parked(o)||held(o)),fin(t){G.wear.track=0;log('Voie remise en état.','good');}},
  brakeFix:{label:'Déblocage des freins',dur:14,cost:200,ok:()=>G.brakeFault,fin(t){G.brakeFault=false;G.wear.brake=Math.max(0,G.wear.brake-15);log('Freins débloqués.','good');}},
  brakeRev:{label:'Révision des freins',dur:25,cost:350,lock:true,ok:()=>trains.every(parked),fin(t){G.brakeFault=false;G.wear.brake=0;log('Freins révisés.','good');}},
  trainRev:{label:'Révision',dur:40,cost:600,ok:t=>t.st==='garage'&&!t.mv,fin(t){t.wear=0;t.hs=false;t.fault=null;log(t.name+' révisé, prêt à rouler.','good');}},
  rearm:{label:'Réarmement des lapbars',dur:8,cost:0,ok:t=>t.fault==='lapbars',fin(t){t.fault=null;t.phase='ready';for(const o of OPS)o.ok=true;log('Lapbars réarmés sur '+t.name+'.','good');}}
});
