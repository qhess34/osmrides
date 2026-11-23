'use strict';
/* ══════════ COMMANDE PAR ZONES (docs/manoeuvres.md, « Principe de commande ») : jamais par véhicule ══════════
   Le type déclare ses zones (ZONES : {id, name, sec, auto, brake, drive}, engine/montagnes-russes/zones.js) ; voies/ fournit la commande commune :
   AUTO / MANU (G.zm[z], zones auto), freins Serrer / Relâcher (G.zk[z]), Dispatch et freins forcés des voies de garage (sec 'gar', L1…Ln),
   zones du pont transbordeur (RA rail du parcours, RB rail du chariot). Moteurs Avancer / Reculer / Arrêt et zones propres au type : extension (moteursZone, commandeZone). */
const CARR=TRAV?'RB':YZ; // zone porteuse : zone d'où un train entre dans la voie en face de l'appareil (au Dispatch de la voie) ; son Arrêt arrête aussi ce train // gare : pas de bouton de frein, freins liés au départ (stHeld)
const zName=z=>(ZONES.find(o=>o.id===z)||{}).name||z;
const isAutoZ=z=>!!(ZONES.find(o=>o.id===z)||{}).auto,ZR=SG?'RB':'RA'; // ZR : zone du rail du circuit sur le pont droit (rail unique : RB, zone de freinage ET zone porteuse)
const zK=z=>z[0]==='L'?!!G.zk[z]:isAutoZ(z)?!!(G.zm[z]&&G.zk[z]):!!G.zk[z]; // freins serrés au pupitre (zone de freinage : seulement en MANU)
const zT=z=>VEHICULES.filter(t=>zoneDe(t)===z);
function zoneCmd(z,c){
  const Z=ZONES.find(o=>o.id===z);if(!Z)return false;const N=Z.name;
  if(Z.sec==='gar'){if(c==='d')return laneDispatch(+z.slice(1)-1);if(c!=='k')return refuse(N+' : boutons Dispatch et freins seulement.');
    // freins forcés de la voie (propriétaire, issue #11) : serrer arrête aussitôt le train qui entre dans la voie ou en sort ; relâcher libère, la reprise se fait au Dispatch
    if(!G.zk[z]){G.zk[z]=true;let n=0;for(const t of VEHICULES)if(t.st==='garage'&&t.lane===+z.slice(1)-1&&t.mv){t.mv=0;n++;}
      log('Freins forcés serrés : '+N+(n?' (train arrêté).':'.')+' Dispatch refusé tant qu\'ils sont serrés.','warn');return true;}
    G.zk[z]=false;log('Freins forcés relâchés : '+N+'. Reprise au bouton Dispatch.','good');return true;}
  {const r=fournit('commandeZone',undefined,Z,c);if(r!==undefined)return r;} // zone propre au type (lift…)
  if(c==='m'){if(!Z.auto)return false;const m=!G.zm[z];G.zm[z]=m;G.zk[z]=m&&zT(z).some(t=>t.st==='run'&&t.v===0); // passage en MANU : freins serrés si un train y est arrêté
    log(N+(m?' en MANU : freins'+(Z.drive?' et moteurs':'')+' commandés au pupitre.':' en AUTO : cantonnement automatique.'),m?'warn':'good');return true;}
  if(Z.auto&&!G.zm[z])return refuse(N+' en AUTO : passez la zone en MANU pour la commander.');
  if(c==='k'){
    if(!zK(z)){G.zk[z]=true;for(const t of zT(z))if(t.mv)t.mv=0;log('Freins serrés : '+N+'.','warn');return true;}
    const t=zT(z).find(o=>o.st==='run'&&o.v===0),o=t&&fournit('sectionOccupee','',z,t);
    if(o)return refuse(N+' : relâchement refusé, section suivante occupée ('+o+').');
    G.zk[z]=false;log('Freins relâchés : '+N+(t&&Z.bloc&&Z.drive?' : AV pour faire repartir '+t.name+'.':'.'),'good');return true;}
  if(!Z.drive||!'fbx'.includes(c))return false;
  if(G.estop)return refuse(N+' : commande refusée, arrêt d\'urgence enclenché.');
  return fournit('moteursZone',false,Z,c);
}
extension({nom:'voies',actions:{
  pos(arg){yardPos(+arg);},
  ra(arg){raPos(+arg);},
  zone(arg){const q=String(arg).split(':');zoneCmd(q[0],q[1]);},
  zauto(arg){ZONES.forEach(Z=>{if(Z.auto){G.zm[Z.id]=false;G.zk[Z.id]=false;}});log('Toutes les zones de freinage en AUTO : cantonnement automatique.','good');}}});
