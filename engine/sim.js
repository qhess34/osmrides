'use strict';
/* ══════════ TRAINS ══════════ */
const _f=mkF();
function carFrame(t,k,o){
  if(t.st==='run'){
    const sc=t.s-(k+.5)*CAR;frameAt(sc,o);
    if(BOB&&t.v>2){const i=Math.floor((((sc%L)+L)%L)/DS)%N,off=clamp(-KAP[i]*t.v*t.v*.045,-.62,.62);o.p.x+=o.R.x*off;o.p.z+=o.R.z*off;} // le bob monte sur la paroi extérieure dans les courbes
    return o;
  }
  if(t.st!=='garage')return frameAt(S_ST-(k+.5)*CAR,o);
  if(TRAV)return trFrame(t,k,o);
  if(LBK){const q=(k+.5)*CAR+t.g;if(q<=YD.a)return frameAt(ANCH-q,o); // marche arrière : le train remonte le circuit, puis entre dans la voie (orientation : vers l'avant du circuit)
    gFrame(t.lane,q-YD.a,o);o.T.multiplyScalar(-1);o.R.multiplyScalar(-1);return o;}
  const u=t.g-YD.a-(k+.5)*CAR;return u<0?frameAt(SW_A+u,o):gFrame(t.lane,u,o);
}
function seatBase(t,i,o){
  carFrame(t,Math.floor(i/CSEATS),_f);o.copy(_f.p).addScaledVector(_f.U,.35);
  const q=seatOff(i%CSEATS);return o.addScaledVector(_f.T,q[0]).addScaledVector(_f.R,q[1]);
}
const _v=new V3;
function arrive(t){
  t.st='station';t.s=S_ST;t.v=0;t.entering=false;t.toPre=false;t.phase='unload';t.pt=0;t.idle=0;t.depReq=false;t.gTold=false;
  G.resOpen=false;t.rcT=0;t.rcTold=false; // à l'arrivée, les sécurités restent verrouillées jusqu'à l'ordre du pupitre
  if(count(t))log(t.name+' en gare : '+RES_NAME+' verrouillés. Ouvrez les sécurités (bouton Sécurités du pupitre) pour le débarquement.');
  if(t.wear>=100&&!t.hs){t.hs=true;log(t.name+' est hors service : rangez-le au garage pour révision (commandes de zone).','bad');}
}
// train à l'arrêt au point de raccordement (zone YZ, engine/garage.js, issue #36) : à quai en gare (vide possible, portillons en jeu), sinon arrêté au point d'arrêt ANCH de la zone
const resShut=t=>!G.resOpen&&!t.rcT&&t.rc.every(v=>v<.05); // sécurités verrouillées et toutes fermées
const atAnchor=t=>YZ!=='St'?(t.st==='run'&&t.v===0&&Math.abs(t.s-ANCH)<.4):(t.st==='station'&&t.phase==='board'&&!t.depReq);
/* ══════════ MANŒUVRES (docs/manoeuvres.md) : Positionner, Avancer, Reculer, Arrêter ══════════ */
const zArt=z=>z==='St'?'la gare':z==='Fin'?'le frein final':z[0]==='B'?'le frein de bloc '+z.slice(1):'« '+zName(z)+' »'; // nom d'une zone d'attente dans une phrase
const ANCH_NAME=zArt(YZ),ANCH_ON=YZ==='St'?'à quai':(YZ[0]==='B'?'au ':'sur ')+ANCH_NAME.replace(/^le /,''); // « arrêté à quai / sur le frein final / au frein de bloc 2 »
// point d'arrêt de la zone d'attente qui précède la zone z (ou haut du lift) : début du canton qui mène à z
const prevStop=z=>z==='Fin'?(BLK.length?BLK[BLK.length-1]+.5:S_BRK-1):z==='Pre'?(TRAV?R1:S_HOLD)+.5:+z.slice(1)>1?BLK[+z.slice(1)-2]+.5:S_REL;
function anchorFree(t){ // le point de raccordement peut recevoir un train qui sort du garage
  // pont droit : un train déjà passé au-delà du rail du pont (frein avant gare, entrée en gare) ne bloque pas le retour : le rail du pont est une zone de freinage
  // qui retient le train remis en ligne tant que la section suivante est occupée (propriétaire, 2026-11-17 : « le rail chariot est aussi une zone d'attente temporaire »)
  // train arrêté SUR le dernier frein de bloc (avant le canton) : il y est retenu par le cantonnement tant que le rail du pont est occupé, il ne bloque pas
  // (propriétaire, 2026-11-17 : « Dernier canton occupé » refusé alors que le frein suivant était libre) ; seul un train qui a franchi ce frein bloque
  if(YZ!=='St'){const lim=prevStop(YZ),end=TRAV?R1-.1:ANCH+TLEN+1;
    return !trains.some(o=>o!==t&&((o.st==='run'&&o.s>=lim&&o.s<=end&&(o.v>=.05||o.s>ANCH-TLEN-.2))||nearDev(o)));} // train qui roule dans le canton qui mène à la zone, ou arrêté SUR la place d'arrivée : bloque
  return !trains.some(o=>o!==t&&(o.st==='station'||(o.st==='run'&&(o.entering||o.s<S_ST+TLEN+2))||nearDev(o)));
}
const sameLane=t=>trains.filter(o=>o!==t&&o.st==='garage'&&o.lane===t.lane);
function fwdLim(t){if(t.lane<0)return t.g;let m=LANES[t.lane].stop;for(const o of sameLane(t))if(o.g>t.g)m=Math.min(m,o.g-GSTEP);return m;}
function backLim(t){
  if(TRAV){if(t.lane<0)return t.g;const m=U_LANE+TLEN; // pont droit : sortie de voie sur le rail B, s'il est en face et libre
    return t.g>=m-.01&&(!devOn(t.lane)||trains.some(o=>o!==t&&onCar(o)))?m:G_B;}
  const L_=LANES[t.lane];let m=0;for(const o of sameLane(t))if(o.g<t.g)m=Math.max(m,o.g+GSTEP);
  if(t.g-TLEN>=L_.dev-.01&&(!devOn(t.lane)||!anchorFree(t)))m=Math.max(m,L_.dev+TLEN+.6); // reste sur sa voie, avant l'appareil
  return m;
}
const refuse=msg=>{log(msg,'warn');return false;};
function yardPos(p){
  if(G.estop)return refuse(DEVN+' : commande refusée, arrêt d\'urgence enclenché.');
  if(devMoving())return refuse(DEVN+' en mouvement : attendez qu\'il soit en place.');
  if(p===G.dev.pos)return refuse(DEVN+' déjà sur '+posName(p)+'.');
  const o=devLock();if(o)return refuse(DEVN+' verrouillé : '+o.name+(TRAV&&o.st==='run'&&atAnchor(o)?' a des passagers sur '+(SG?zName('RB').toLowerCase():'le rail de garage')+'.':TRAV?' est sur le chariot sans y être arrêté, ou y roule.':' est sur l\'appareil ou à moins d\'une longueur de train.'));
  if(TRAV){ // pont droit : le chariot emporte le train arrêté sur le rail B
    if(RA&&p===PG&&!raOut())return refuse(DEVN+' : le rail de garage ne vient en ligne que si '+RAN+' est retiré'+(raMoving()?' (en mouvement).':' : '+RAN+' est sur le circuit.'));
    const c=trains.find(o=>onCar(o));
    if(c&&p===PC){const MR=SITE.maxRun||trains.length,run=trains.filter(o=>o.st!=='garage').length;
      if(run>=MR)return refuse('Déjà '+run+' trains sur le circuit (au plus '+MR+') : '+c.name+' reste sur le chariot.');
      if(!anchorFree(c))return refuse('Dernier canton occupé : '+c.name+' ne peut pas être remis sur le circuit (fermez au besoin un frein de bloc).');}
    if(c&&p&&p!==PG&&trains.some(o=>o.st==='garage'&&o!==c&&o.lane===p-1))return refuse('Voie '+p+' ('+LANES[p-1].name+') occupée : '+c.name+' ne peut pas y être porté.');
    const r=trains.find(o=>o.st==='run'&&atAnchor(o)&&G.dev.pos===PC);
    if(r&&p!==PC){r.st='garage';r.lane=-1;r.g=G_B;r.mv=0;r.v=0;r.fdrive=0;r.told=false;r.depReq=false;r.entering=false;r.toPre=false;r.inBrake=false;r.phase='board';
      log(r.name+' est emporté par le chariot.');}
  }
  G.dev.to=p;G.dev.k=0;G.dev.d=TRAV?Math.max(MV.t,Math.abs(OFF[p]-OFF[G.dev.pos])/MV.vc):MV.t;
  log(DEVN+' commandé vers '+posName(p)+(RA?(G.dev.pos===PG?' : plus aucun rail en ligne, trains retenus avant le pont.':'.'):TRAV?(p===PG||!p?'.':' : rail du circuit hors ligne, trains retenus avant le pont.'):p?(YZ==='St'||HOLD_Z==='St'?' : départs bloqués.':YZ==='Fin'&&!LBK?' : entrée en gare bloquée.':' : trains retenus '+(HOLD_Z[0]==='B'?'au ':'sur ')+zArt(HOLD_Z).replace(/^le /,'')+'.'):'.'));
  return true;
}
function raPos(p){ // rail A escamotable : 0 = sur le circuit, 1 = retiré
  if(!RA||(p!==0&&p!==1))return false;
  const nm=p?'retiré':'sur le circuit';
  if(G.estop)return refuse(RAN+' : commande refusée, arrêt d\'urgence enclenché.');
  if(raMoving())return refuse(RAN+' en mouvement : attendez qu\'il soit en place.');
  if(p===G.ra.pos)return refuse(RAN+' déjà '+nm+'.');
  if(!p&&(devMoving()||G.dev.pos===PG))return refuse(RAN+' ne revient sur le circuit que si le rail de garage n\'est pas en ligne : écartez d\'abord '+DEVL+' vers une voie.');
  const o=raLock();if(o)return refuse(RAN+' verrouillé : '+o.name+' y est, y roule ou s\'en approche.');
  G.ra.to=p;G.ra.k=0;G.ra.d=Math.max(MV.t,RET/MV.vc);
  log(RAN+' commandé '+(p?'vers l\'extérieur : circuit coupé, trains retenus avant le pont.':'vers le circuit.'));return true;
}
function yardFwd(t){
  if(G.estop)return refuse(t.name+' : manœuvre refusée, arrêt d\'urgence enclenché.');
  if(TRAV&&t.st==='garage'&&t.lane<0){ // pont droit : du rail B vers la voie en face
    if(t.mv)return false;
    if(devMoving()||!G.dev.pos||G.dev.pos===PG)return refuse(t.name+' : '+DEVL+' n\'est pas en place face à une voie de garage.');
    const j=G.dev.pos-1;if(trains.some(o=>o.st==='garage'&&o!==t&&o.lane===j))return refuse('Voie '+(j+1)+' ('+LANES[j].name+') occupée.');
    t.lane=j;t.mv=1;t.ld=1;log(t.name+' entre'+(LREV?' en marche arrière':'')+' sur '+posName(j+1)+'.');return true;
  }
  if(TRAV&&t.st!=='garage')return refuse(t.name+' : le chariot emporte le train. Pont sur G, train arrêté à vide sur le rail de garage, puis pont sur une voie libre.');
  if(t.st==='garage'){
    const L_=LANES[t.lane];
    if(t.mv>0)return false;
    if(t.g-TLEN<L_.dev-.01&&!devOn(t.lane))return refuse(t.name+' ne franchit pas '+DEVL+' : il n\'est pas en place sur '+posName(t.lane+1)+'.');
    if(fwdLim(t)-t.g<.05)return refuse(t.name+(t.g>=L_.stop-.05?' est déjà en bout de voie.':' est bloqué par le train garé devant lui.'));
    t.mv=1;t.ld=1;log(t.name+(LREV||LBK?' recule':' avance')+' vers le fond de '+posName(t.lane+1)+'.');return true;
  }
  if(!atAnchor(t))return refuse(t.name+' doit être arrêté '+(YZ==='St'?'en gare, à quai':ANCH_ON)+' pour quitter le circuit.');
  if(count(t)>0)return refuse(t.name+' a des passagers : il ne quitte jamais le circuit.');
  if(YZ==='St'&&G.gatesOpen)return refuse('Portillons ouverts : fermez-les avant de manœuvrer '+t.name+'.');
  if(YZ==='St'&&!resShut(t))return refuse('Sécurités ouvertes : verrouillez-les avant de manœuvrer '+t.name+'.');
  if(devMoving())return refuse(DEVN+' en mouvement : '+t.name+' ne peut pas le franchir.');
  if(!G.dev.pos)return refuse(DEVN+' sur P : positionnez-le d\'abord sur une voie de garage.');
  const j=G.dev.pos-1,n=trains.filter(o=>o.st==='garage'&&o.lane===j).length;
  if(n>=LANES[j].cap)return refuse('Voie '+(j+1)+' ('+LANES[j].name+') pleine ('+LANES[j].cap+' train'+(LANES[j].cap>1?'s':'')+').');
  if(trains.some(o=>o!==t&&nearDev(o)))return refuse('Manœuvre déjà en cours près de '+DEVL+'.');
  t.st='garage';t.lane=j;t.g=0;t.mv=1;t.ld=1;t.v=0;t.fdrive=0;t.told=false;t.depReq=false;t.entering=false;t.toPre=false;t.phase='board';
  log(t.name+(LBK?' recule '+('de '+ANCH_NAME).replace(/^de le /,'du ')+' vers ':' quitte le circuit vers ')+posName(j+1)+'.');return true;
}
function yardBack(t){
  if(G.estop)return refuse(t.name+' : manœuvre refusée, arrêt d\'urgence enclenché.');
  if(t.st!=='garage')return refuse(t.name+' est sur le circuit : la marche arrière ne sert qu\'à sortir du garage.');
  if(t.mv<0)return false;
  if(G.job&&G.job.t===t)return refuse(t.name+' est en révision.');
  const MR=SITE.maxRun||trains.length,run=trains.filter(o=>o.st!=='garage').length; // au plus SITE.maxRun trains sur le circuit
  if(run>=MR&&!sameLane(t).some(o=>o.g<t.g))return refuse('Déjà '+run+' trains sur le circuit (au plus '+MR+') : '+t.name+' reste au garage.');
  if(TRAV&&t.lane<0)return refuse(t.name+' est sur le chariot : positionnez '+DEVL+' sur '+posId(PC)+' pour le remettre sur le circuit.');
  const L_=LANES[t.lane],out=t.g-TLEN>=L_.dev-.01,lim=backLim(t);
  if(TRAV&&t.g-lim<.05)return refuse(t.name+' reste sur sa voie : '+(devOn(t.lane)?'le rail de garage est occupé.':DEVL+' n\'est pas en place face à '+posName(t.lane+1)+'.'));
  if(t.g-lim<.05){
    if(out&&!devOn(t.lane))return refuse(t.name+' ne franchit pas '+DEVL+' : il n\'est pas en place sur '+posName(t.lane+1)+'.');
    if(out&&!anchorFree(t))return refuse(ANCH_NAME[0].toUpperCase()+ANCH_NAME.slice(1)+' n\'est pas libre : '+t.name+' reste au garage'+(YZ!=='St'?'.':' (bloquez au besoin l\'autre train au frein final).'));
    return refuse(t.name+' est bloqué par un autre train garé derrière lui.');
  }
  t.mv=-1;t.ld=-1;log(t.name+(LREV||LBK?' avance':' recule')+(TRAV?' vers le rail de garage du pont.':lim<=0?' vers '+ANCH_NAME+'.':'.'));return true;
}
function updateYard(t,dt){
  if(!t.mv||G.estop)return;
  {const z=tZone(t),l=t.lane>=0?'L'+(t.lane+1):'';const k=zK(z)?z:l&&zK(l)?l:'';if(k){t.mv=0;log(t.name+' arrêté : freins de '+zName(k)+' serrés.','warn');return;}} // freins forcés de la voie : ils arrêtent aussi le train qui y entre depuis la zone porteuse ou en sort
  if(t.mv>0){const m=fwdLim(t);t.g=Math.min(m,t.g+MV.v*dt);
    if(t.g>=m-1e-6){t.mv=0;t.ld=0;log(t.g>=LANES[t.lane].stop-.05?t.name+' est garé en bout de '+posName(t.lane+1)+'.':t.name+' arrêté derrière le train garé devant lui.');}}
  else if(TRAV){const m=backLim(t);t.g=Math.max(m,t.g-MV.v*dt);
    if(t.g<=m+1e-6){t.mv=0;t.ld=0;if(m<=G_B+1e-6){t.lane=-1;log(t.name+' est sur le chariot. Positionnez '+DEVL+' sur '+posId(PC)+' pour le remettre sur le circuit.','good');}
      else log(t.name+' arrêté en sortie de voie : '+DEVL+' n\'est pas en place ou le rail de garage est occupé.','warn');}}
  else{const m=backLim(t);t.g=Math.max(m,t.g-MV.v*dt);
    if(t.g<=1e-6){t.g=0;t.mv=0;t.ld=0;t.seats.fill(null);
      if(YZ!=='St'){placeAt(t,YZ);log(t.name+' est revenu sur '+ANCH_NAME+(LBK?' : la zone le relâche selon ses règles (appareil en amont).':'. Remettez '+DEVL+' sur P pour qu\'il '+(YZ==='Fin'?'entre en gare':'reparte')+'.'),'good');}
      else{t.st='station';t.s=S_ST;t.v=0;t.phase='board';t.pt=0;t.idle=0;t.depReq=false;log(t.name+' est en gare. Remettez '+DEVL+' sur P pour autoriser les départs.','good');}}
    else if(t.g<=m+1e-6){t.mv=0;log(t.name+' arrêté avant '+DEVL+(devOn(t.lane)?' : '+ANCH_NAME+' n\'est pas libre.':' : il n\'est pas en place.'),'warn');}}
}
/* Dispatch d'une voie de garage (propriétaire, issue #11) : un seul bouton par voie, le moteur choisit le sens d'après la position de l'appareil.
   Appareil en place sur la voie j : train arrêté en cours d'entrée → il reprend l'entrée ; train prêt sur la zone porteuse (train vide à quai / sur le frein final,
   ou train sur le chariot d'un pont droit) et place dans la voie → il entre ; sinon le train de tête de la voie sort vers l'appareil (rail du pont, gare, frein final).
   Freins des voies automatiques (pas de bouton), arrêt automatique en fin de mouvement ; verrouillages de yardFwd / yardBack inchangés. */
function laneDispatch(j){
  const N=zName('L'+(j+1));
  if(G.estop)return refuse(N+' : Dispatch refusé, arrêt d\'urgence enclenché.');
  if(zK('L'+(j+1)))return refuse(N+' : freins forcés serrés, relâchez-les (bouton F de la voie) avant le Dispatch.');
  if(devMoving())return refuse(N+' : '+DEVN+' en mouvement, attendez qu\'il soit en place.');
  if(!devOn(j))return refuse(N+' : '+DEVN+' n\'est pas en place sur cette voie : positionnez-le d\'abord sur '+posId(j+1)+'.');
  const inL=trains.filter(o=>o.st==='garage'&&o.lane===j);
  if(inL.some(o=>o.mv))return refuse(N+' : manœuvre déjà en cours.');
  const r=inL.find(o=>o.ld>0&&fwdLim(o)-o.g>.05);if(r)return yardFwd(r); // entrée interrompue : elle reprend
  {const x=inL.find(o=>o.ld<0);if(x)return yardBack(x);} // sortie interrompue (freins forcés) : elle reprend
  const e=trains.find(o=>!o.mv&&(TRAV?o.st==='garage'&&o.lane<0:atAnchor(o))),room=TRAV?!inL.length:inL.length<LANES[j].cap;
  if(e&&room){const z=tZone(e);if(zK(z))return refuse('Freins de '+zName(z)+' serrés : relâchez-les pour que '+e.name+' entre dans '+N+'.');return yardFwd(e);}
  // zone porteuse à un seul train (propriétaire, issue #11 : « sur la voie chariot il n'y a la place que pour un train ») : si elle porte déjà un train,
  // le Dispatch ne fait jamais sortir le train garé ; il ne peut que faire entrer le train porté, et refuse si la voie est pleine
  const carried=e||(TRAV&&trains.find(o=>o.st==='garage'&&!inL.includes(o)&&(o.lane<0||onCar(o))));
  if(carried)return refuse(N+' : '+zName(CARR).toLowerCase()+' porte déjà un train ('+carried.name+')'+(e===carried?', voie pleine : il n\'y entre pas':'')+(inL.length?', aucun train ne sort de la voie.':'.'));
  if(inL.length){const t=inL.slice().sort((a,b)=>a.g-b.g)[0];
    if(TRAV&&zK('RB'))return refuse('Freins de '+zName('RB').toLowerCase()+' serrés : aucun train ne sort de '+N+'.');
    return yardBack(t);}
  return refuse(N+' : aucun train à faire entrer ('+(TRAV?'aucun train sur le chariot':'aucun train vide arrêté '+ANCH_ON)+') ni à sortir.');
}
/* ══════════ COMMANDES DE ZONE (pupitre) : freins Serrer / Relâcher, moteurs Avancer / Reculer / Arrêt, mode AUTO / MANU ══════════ */
function nextBusy(z,t){ // anti-collision : section suivante occupée (refus du relâchement d'un frein qui retient un train)
  if(/^B\d/.test(z)){const i=+z.slice(1)-1;return occupied(BLK[i],blkEnd(i),t)?(i+1<BLK.length?'canton du bloc '+(i+2):'canton du frein final'):devHoldAt(i)?DEVL+' hors de P':'';}
  const ahead=()=>aheadBusy(t)?(PSB?zName('Pre'):'gare'):'';
  if(z==='Fin')return TRAV?(trains.some(o=>o!==t&&(onRail(o)||onCar(o)))?DEVL:''):devHoldIn('Fin')?DEVL+' hors de P':ahead();
  if(z===ZR)return ahead();
  if(z==='Pre')return stationBusy(t)?'gare':devHoldIn('Pre')?DEVL+' hors de P':'';
  return '';
}
function zoneCmd(z,c){
  const Z=ZONES.find(o=>o.id===z);if(!Z)return false;const N=Z.name;
  if(Z.sec==='gar'){if(c==='d')return laneDispatch(+z.slice(1)-1);if(c!=='k')return refuse(N+' : boutons Dispatch et freins seulement.');
    // freins forcés de la voie (propriétaire, issue #11) : serrer arrête aussitôt le train qui entre dans la voie ou en sort ; relâcher libère, la reprise se fait au Dispatch
    if(!G.zk[z]){G.zk[z]=true;let n=0;for(const t of trains)if(t.st==='garage'&&t.lane===+z.slice(1)-1&&t.mv){t.mv=0;n++;}
      log('Freins forcés serrés : '+N+(n?' (train arrêté).':'.')+' Dispatch refusé tant qu\'ils sont serrés.','warn');return true;}
    G.zk[z]=false;log('Freins forcés relâchés : '+N+'. Reprise au bouton Dispatch.','good');return true;}
  if(z==='Lift'){const off=c==='off';if(off===G.liftOff)return refuse('Lift déjà '+(off?'à l\'arrêt.':'en marche.'));
    G.liftOff=off;log(off?'Lift à l\'arrêt : la chaîne est stoppée, un train sur le lift y reste.':'Lift en marche.',off?'warn':'good');return true;}
  if(c==='m'){if(!Z.auto)return false;const m=!G.zm[z];G.zm[z]=m;G.zk[z]=m&&zT(z).some(t=>t.st==='run'&&t.v===0); // passage en MANU : freins serrés si un train y est arrêté
    log(N+(m?' en MANU : freins'+(Z.drive?' et moteurs':'')+' commandés au pupitre.':' en AUTO : cantonnement automatique.'),m?'warn':'good');return true;}
  if(Z.auto&&!G.zm[z])return refuse(N+' en AUTO : passez la zone en MANU pour la commander.');
  if(c==='k'){
    if(!zK(z)){G.zk[z]=true;for(const t of zT(z))if(t.mv)t.mv=0;log('Freins serrés : '+N+'.','warn');return true;}
    const t=zT(z).find(o=>o.st==='run'&&o.v===0),o=t&&nextBusy(z,t);
    if(o)return refuse(N+' : relâchement refusé, section suivante occupée ('+o+').');
    G.zk[z]=false;log('Freins relâchés : '+N+(t&&/^B\d/.test(z)&&Z.drive?' : AV pour faire repartir '+t.name+'.':'.'),'good');return true;}
  if(!Z.drive||!'fbx'.includes(c))return false;
  if(G.estop)return refuse(N+' : commande refusée, arrêt d\'urgence enclenché.');
  const ts=zT(z);
  // Arrêt : la zone porteuse arrête aussi le train qu'elle pousse dans une voie
  if(c==='x'){let n=0;for(const t of z===CARR?ts.concat(trains.filter(o=>o.st==='garage'&&o.mv>0&&!ts.includes(o))):ts){if(t.mv){t.mv=0;n++;}if(t.fdrive){t.fdrive=0;n++;}if(t.bgo&&t.bst){t.bgo=0;n++;}if(t.st==='station'&&t.depReq&&t.phase!=='check'){t.depReq=false;t.phase='board';resetOps();n++;}}
    if(!n)return refuse(N+' : aucun mouvement à arrêter.');log('Moteurs arrêtés : '+N+'.');return true;}
  if(zK(z))return refuse(N+' : freins serrés, relâchez-les avant d\'avancer ou de reculer.');
  if(!ts.length)return refuse(N+' : aucun train dans la zone.');
  if(z==='RB'&&ts.some(o=>o.st==='garage'))return refuse(N+' : le train sur le chariot entre dans la voie en face au bouton Dispatch de cette voie.'); // l'entrée dans une voie se commande à la voie (issue #11)
  if(c==='b'&&Z.drive==='fwd')return refuse(N+' : roues de propulsion en marche avant seulement.');
  if(c==='b'&&LBK&&z===YZ){ // aiguillage en amont de la zone (issue #38) : AR = entrée au garage en marche arrière, comme le Dispatch de la voie en face
    if(devMoving()||!G.dev.pos)return refuse(N+' : marche arrière vers le garage seulement, '+DEVL+' sur une voie de garage ('+(devMoving()?'en mouvement':'sur P')+').');
    return laneDispatch(G.dev.pos-1);}
  if(c==='b')return refuse(N+' : marche arrière impossible sur le circuit (garage : bouton Dispatch de la voie).');
  const t=ts.find(o=>o.st==='garage'?!o.mv:o.v===0)||ts[0];
  const toLane=()=>refuse(DEVN+' hors de P : '+t.name+' entre au garage au bouton Dispatch de la voie'+(devMoving()?'.':' '+G.dev.pos+'.'));
  const enter=nm=>{if(t.st!=='run'||t.v!==0||t.entering||t.toPre)return false;
    if(G.brakeFault)return refuse('Défaut des freins : '+t.name+' reste '+nm+'.');
    if(devHoldIn(z))return refuse(DEVN+' hors de P : '+t.name+' reste '+nm+'.'); // dernière zone d'attente avant l'appareil (HOLD_Z, engine/garage.js)
    if(PSB&&t.s<=PSB_A){if(preBusy(t))return refuse(zName('Pre')+' occupé : '+t.name+' reste '+nm+'.'); // vers le frein avant gare d'abord
      t.toPre=true;t.hold=0;t.lkTold=false;log(t.name+' avance vers '+zName('Pre').toLowerCase()+'.');return true;}
    if(stationBusy(t))return refuse('Gare occupée : '+t.name+' reste '+nm+'.');
    t.entering=true;t.hold=0;t.lkTold=false;log(t.name+' avance vers la gare.');return true;};
  if(YZ!=='St'&&z===YZ&&!TRAV&&!LBK&&devOff())return toLane(); // aiguillage en amont : l'appareil est derrière le train, AV reste permis // zone de raccordement, appareil hors de P : le train y entre au garage (Dispatch de la voie)
  if(z==='St'){
    if(t.st!=='station')return refuse(t.name+' n\'est pas arrêté à quai.');
    if(t.phase==='unload')return refuse(t.name+' : débarquement en cours.');
    if(count(t))return refuse(t.name+' a des passagers : départ par le bouton Départ, après validation des lapbars.');
    if(G.gatesOpen)return refuse('Portillons ouverts : fermez-les avant de faire avancer '+t.name+'.');
    if(!resShut(t))return refuse('Sécurités ouvertes : verrouillez-les avant de faire avancer '+t.name+'.');
    if(t.depReq)return false;
    const r=blockReason(t);if(r)return refuse(t.name+' ne peut pas partir : '+r+'.');
    t.depReq=true;log(t.name+' quitte la gare à vide (moteurs de gare).');return true;}
  if(z==='RB')return enter(SG?'sur '+N.toLowerCase():'sur le rail de garage');
  if(z==='RA'||z==='Pre')return enter('sur '+N);
  if(z==='Fin'){
    if(t.st!=='run'||t.v!==0)return false;
    if(TRAV){
      if(bIn()){if(count(t))return refuse(t.name+' a des passagers : il ne roule jamais sur le rail de garage.');
        if(trains.some(o=>o!==t&&(onRail(o)||onCar(o))))return refuse('Rail de garage occupé : '+t.name+' reste avant '+DEVL+'.');
        t.fdrive=1;t.preTold=false;log(t.name+' avance à vide sur le rail de garage.');return true;}
      if(circIn())return true; // rail A en ligne, freins relâchés : le train repart seul
      return refuse('Aucun rail en ligne avec le circuit : '+t.name+' attend avant '+DEVL+'.');}
    return enter('sur le frein final');}
  if(/^B\d/.test(z)){const i=+z.slice(1)-1;if(t.st!=='run'||t.v!==0||t.bgo)return refuse(N+' : aucun train arrêté au frein.');if(occupied(BLK[i],blkEnd(i),t))return refuse('Canton suivant occupé : '+t.name+' reste au frein de bloc '+(i+1)+'.');if(devHoldAt(i))return refuse(DEVN+' hors de P : '+t.name+' reste au frein de bloc '+(i+1)+'.');t.bgo=i+1;log(t.name+' repart du frein de bloc '+(i+1)+' (roues de propulsion).');return true;}
  return false;
}
const evacTrains=()=>G.resOpen?trains.filter(o=>o.st==='station'&&o.phase==='board'&&!o.evq&&count(o)):[]; // évacuation : train à quai, sécurités ouvertes, ses passagers descendent aussi (issue #26)
const evacCan=()=>!!(G.queue.length||evacTrains().length||G.plat.some(r=>r)||(G.platR||[]).some(r=>r)||G.walkers.some(k=>k.kind==='wait')); // quelque chose à évacuer (bouton bEvac)
function updateStation(t,dt){
  t.pt-=dt;
  if(t.phase==='unload'){
    if(count(t)&&t.rc.some(v=>v<.95))return; // débarquement : seulement sécurités ouvertes
    if(t.pt<=0){
      const i=t.seats.findIndex(s=>s&&s.on);
      if(i>=0){
        const v=t.seats[i];t.seats[i]=null;t.pt=.12;G.stats.riders++;if(!G.sandbox){G.stats.income+=5;G.money+=5;}
        let g=v.w<80?.07:v.w<180?.04:.015;if(G.wear.track>75)g*=.4;G.sat=clamp(G.sat+g,0,100);
        seatBase(t,i,_v);walker(exitPath(alightWalk(Math.floor(i/CSEATS),_v.x,_v.z)),v.ci,null,2.8,0,'alight'); // descente côté sortie, à l'opposé des portillons, par le quai et la porte
      }else if(count(t)===0){t.phase='board';t.idle=0;}
    }
  }else if(t.phase==='board'){
    if(t.evq){if(!G.resOpen)t.evq=false; // évacuation (issue #26) : sécurités verrouillées, on n'y touche plus
      else if(t.pt<=0){const i=t.seats.findIndex(s=>s&&s.on);
        if(i>=0){const v=t.seats[i];t.seats[i]=null;t.pt=.12;t.idle=0;seatBase(t,i,_v);const w=alightWalk(Math.floor(i/CSEATS),_v.x,_v.z);
          walker(exitPath(w),v.ci,null,2.8,0,'alight');const k=G.walkers[G.walkers.length-1];k.ev=1;k.pe=w.length;} // descend par la sortie, comme au débarquement (ni recette, ni passager compté)
        else if(!count(t))t.evq=false;}if(t.evq)return;} // places réservées par un visiteur qui monte (on:false) : il descend dès qu'il est assis
    const n=count(t),waiting=G.plat.some((r,i)=>r&&!t.seats[i]),shut=!G.gatesOpen&&G.gate<.05&&seated(t)===n&&resShut(t);
    if(G.auto&&!t.depReq){t.idle+=dt;
      if((n>0&&seated(t)===n&&(n===SEATS||(!waiting&&t.idle>(G.open?(G.queue.length?45:12):4))))||(t.idle>5&&!G.queue.length&&!waiting&&trains.some(held))||(t.hs&&n===0&&t.idle>2))t.depReq=true;} // un train hors service repart à vide
    if(G.auto&&t.depReq&&G.gatesOpen&&!t.gTold){t.gTold=true;log(t.name+' est prêt au départ : fermez les portillons, puis verrouillez les sécurités (boutons du pupitre) : les opérateurs fermeront et vérifieront les '+RES_NAME+'.','warn');}
    if(G.auto&&t.depReq&&!G.gatesOpen&&G.resOpen&&!t.rcTold){t.rcTold=true;log(t.name+' est prêt au départ : verrouillez les sécurités (bouton Sécurités) pour lancer la vérification par les opérateurs.','warn');}
    // train jamais déverrouillé (vide, sorti du garage) : portillons fermés, il part en auto après l'ordre de départ ; un train chargé passe par le verrouillage au pupitre (act 'res'), qui lance la vérification
    if(shut&&(G.auto?t.depReq:n>0||t.depReq)){if(n===0||G.bypass)t.phase='ready';else startCheck(t);}
  }else if(t.phase==='check'){
    if(G.gatesOpen||G.resOpen){t.phase='board';resetOps();return;}
    if(G.bypass){resetOps();t.rcT=0;t.phase='ready';return;}
    if(OPS.every(o=>o.ok)){
      if(Math.random()<Math.max(0,(t.wear-55)/45)*.3){t.fault='lapbars';t.phase='fault';resetOps();sfx.alarm();log('Défaut de lapbar détecté par un opérateur sur '+t.name+' : réarmement nécessaire.','warn');}
      else{t.phase='ready';if(!G.auto)log('Lapbars validés par les deux opérateurs : départ possible.','good');}
    }
  }else if(t.phase==='ready'){
    if(G.gatesOpen||G.resOpen){t.phase='board';t.depReq=false;resetOps();return;}
    if((G.auto||t.depReq)&&!blockReason(t)&&resShut(t)){
      const n=count(t),checked=OPS.every(o=>o.ok);
      t.st='run';t.v=.5;t.depReq=false;t.inLift=false;t.inBrake=false;t.screamed=false;t.blk=false;t.told=false;G.stats.disp++;sfx.bell();resetOps();
      if(G.wx.type==='storm'&&n>0){pay(400,true);G.sat=clamp(G.sat-3,0,100);log('Infraction : train envoyé en plein orage ! Amende de 400 €.','bad');}
      else log(t.name+' part avec '+n+' passager'+(n>1?'s':'')+(n>0&&!checked?' — lapbars non vérifiés (by-pass).':'.'));
      if(HOLD_Z!=='St'&&devHoldOn())log('Départ avec '+DEVL+' hors de P : '+t.name+' sera retenu '+(HOLD_Z[0]==='B'?'au ':'sur ')+zArt(HOLD_Z).replace(/^le /,'')+' tant que '+DEVL+' n\'est pas revenu sur P.','warn');
      if(!G.sandbox&&n>0&&!checked&&Math.random()<.08+Math.max(0,(t.wear-55)/45)*.3){pay(600,true);G.sat=clamp(G.sat-6,0,100);sfx.alarm();log('Incident : un lapbar était mal verrouillé au départ. Amende de 600 €.','bad');}
    }
  }
}
function updateRun(t,dt){
  const z=zoneOf(t.s);
  if(z==='station'){t.v=Math.min(6,Math.sqrt(4*Math.max(0,S_ST-t.s))+.3);t.s+=t.v*dt;if(t.s>=S_ST-.05)arrive(t);return;}
  if(z==='prelift'){const lb=liftBusy(t),d=S_LIFT0-.5-t.s; // un seul train sur le lift : le suivant attend au pied du lift
    t.v=Math.min(lb?Math.sqrt(4*Math.max(0,d)):9,Math.min(5,t.v+1.5*dt));
    if(lb&&d<.3){t.v=0;if(!t.lfTold){t.lfTold=true;log(t.name+' attend au pied du lift : un train est sur le lift.');}}else if(!lb)t.lfTold=false;}
  else if(z==='lift'){
    if(!t.inLift){t.inLift=true;G.wear.chain=Math.min(100,G.wear.chain+2.2);
      const c=G.wear.chain;t.failAt=Math.random()<(c>40?Math.pow((c-40)/60,2)*.35:0)?rnd(S_LIFT0+8,S_LIFT1-6):-1;}
    if(t.failAt>0&&t.s>=t.failAt){t.failAt=-1;G.liftBroken=true;sfx.alarm();log('🚨 Panne du lift ! '+t.name+' est bloqué dans la montée.','bad');}
    t.wait=LIFT_NEXT>=0&&t.s>S_LIFT1-4&&occupied(S_REL-TLEN,LIFT_NEXT,t); // le lift retient le train (chaîne arrêtée) tant que la zone suivante est occupée : premier frein de bloc, ou, avec SITE.singleCourse, tout le parcours jusqu'au frein final
    t.v=(G.liftBroken||G.estop||t.wait||G.liftOff)?0:Math.min(5.5,Math.max(t.v,2)+3*dt);
  }else if(z==='course'){
    const a=-9.81*(hAt(t.s)-hAt(t.s-TLEN))/TLEN-(PH.roll+t.wear*.0003)-PH.drag*t.v*t.v;
    let bi=-1;for(let i=0;i<BLK.length;i++)if(BLK[i]>t.s-.2){bi=i;break;}
    if(bi>=0){if(t.s<BZ0[bi])t.bvi=-1;else if(t.bvi!==bi){t.bvi=bi;t.bvin=t.v;}} // vitesse d'entrée dans la zone du frein de bloc (issue #33 : un train arrêté en repart à cette vitesse)
    if(t.brs&&!(t.s<BLK[t.brs-1]+TLEN))t.brs=0;
    if(t.bst&&!(t.s<BLK[t.bst-1]+.3))t.bst=0;if(t.bgo&&!(t.s<BLK[t.bgo-1]+TLEN))t.bgo=0; // bst : arrêté au frein de bloc k (roues) ; bgo : poussé par ses roues (bouton AV) jusqu'à ce que la queue ait passé le frein
    const wd=bi>=0&&BDRV[bi]&&!!G.zm['B'+(bi+1)]&&t.bst===bi+1&&!t.bgo; // MANU, roues de propulsion : le train arrêté au frein n'en repart qu'au bouton AV
    const man=bi>=0&&zK('B'+(bi+1)),dh=bi>=0&&devHoldAt(bi); // frein de bloc serré au pupitre (zone en MANU) : arrêt même si le canton suivant est libre ; dh : retenu avant l'appareil hors de P (règle de départ)
    if(bi>=0&&(man||dh||wd||occupied(BLK[bi],blkEnd(bi),t))){const d=BLK[bi]-t.s;t.v=Math.min(Math.max(PH.vmin,t.v+a*dt),Math.sqrt(12*Math.max(0,d)));
      if(d<.2){t.v=0;t.blk=true;if(BDRV[bi])t.bst=bi+1;if(wd&&!man&&!dh&&t.wdTold!==bi&&!occupied(BLK[bi],blkEnd(bi),t)){t.wdTold=bi;log(t.name+' attend au frein de bloc '+(bi+1)+' (MANU) : AV pour le faire repartir.');}
        if(man&&t.bkTold!==bi){t.bkTold=bi;log(t.name+' arrêté au frein de bloc '+(bi+1)+' (serré au pupitre).','warn');}
        else if(dh&&!man&&t.dhTold!==bi){t.dhTold=bi;log(t.name+' retenu au frein de bloc '+(bi+1)+' : '+DEVL+' n\'est pas sur P (ou une manœuvre de garage est en cours).','warn');}}} // arrêt au frein de bloc
    else{if(t.blk&&bi>=0&&t.v===0){t.brs=bi+1;t.brv=t.bvi===bi?t.bvin:0;} // arrêté au frein de bloc puis libéré (AUTO, AV ou relâché en MANU) : relancé par la zone à sa vitesse d'entrée (brv)
      const vr=t.bgo||t.brs?blkRelaunch(t):0;
      t.v=vr?Math.max(t.v+a*dt,Math.min(vr.v,t.v+vr.a*dt)):Math.max(PH.vmin,t.v+a*dt);t.blk=false;t.bkTold=-1;t.dhTold=-1;t.wdTold=-1; // bgo : roues de propulsion (montée à VPROP)
      const tr=bi>=0&&!G.zm['B'+(bi+1)]?BTRIM[bi]:0;if(tr)t.v=Math.min(t.v,Math.sqrt(tr*tr+12*Math.max(0,BLK[bi]-t.s)));} // frein de ralentissement (zone en AUTO, canton libre) : vitesse ramenée à trim.v au point de frein, puis le train continue
    if(!t.screamed&&t.s>S_DROP){t.screamed=true;const n=count(t);if(n)sfx.scream(n);}
  }else{
    if(!t.inBrake){
      t.inBrake=true;t.hold=0;sfx.brake();t.wear=Math.min(100,t.wear+3.5);G.wear.track=Math.min(100,G.wear.track+1.1);G.wear.brake=Math.min(100,G.wear.brake+1.6);
      const b=G.wear.brake;
      if(!G.brakeFault&&b>50&&Math.random()<Math.pow((b-50)/50,2)*.3){G.brakeFault=true;sfx.alarm();log('🚨 Défaut des freins de fin de parcours : train retenu.','bad');}
      if(G.wear.track>=100)log('⛔ Voie hors service : la commission de sécurité interdit les départs.','bad');
    }
    // pont droit : arrêt avant le chariot si le frein final est serré, si le rail du pont en ligne porte déjà un train (même remis en ligne depuis le garage, propriétaire 2026-11-17)
    // ou si aucun rail du circuit n'est en ligne (sauf conduite à vide vers le rail B)
    const FL=zK('Fin'),onB=TRAV&&t.s>R0+.5&&bIn(),raFull=TRAV&&trains.some(o=>o!==t&&o.st==='run'&&o.s>S_PRE+.3&&o.s<R1+TLEN),pre=TRAV&&t.s<S_PRE+.3&&(FL||raFull||!(circIn()||(bIn()&&t.fdrive)));
    const slow=t.v>6?Math.max(6,t.v-7*dt):TRAV&&!pre&&t.v<1.5?Math.min(1.5,t.v+1.5*dt):t.v; // pneus du frein final (pont droit)
    if(t.entering)t.v=Math.min(6,t.v+2*dt);
    else if(PSB&&(t.toPre||t.s>S_HOLD+.5)){ // frein avant gare (zone de stockage Pre) : pneus jusqu'au point d'arrêt, attente de la gare libre
      const PL=zK('Pre'),vm=Math.sqrt(8*Math.max(0,S_PSB-t.s));t.v=Math.min(t.v>4?Math.max(4,t.v-7*dt):Math.min(4,t.v+2*dt),vm);
      if(vm<.25){t.v=0;t.toPre=false;t.hold+=dt;
        if(PL&&!t.psTold){t.psTold=true;log(t.name+' arrêté sur '+zName('Pre').toLowerCase()+' (serré au pupitre).','warn');}
        if(t.hold>=1&&!PL&&!stationBusy(t)&&!devHoldIn('Pre')&&!G.estop&&!G.brakeFault){t.entering=true;t.hold=0;t.psTold=false;}}}
    else if(pre){t.v=Math.min(slow,Math.sqrt(8*Math.max(0,S_PRE-t.s)));
      if(t.v<.25){t.v=0;if(!t.preTold){t.preTold=true;log(t.name+' attend avant '+DEVL+' : '+(FL?'frein final serré au pupitre.':raFull?zName(RA?'RA':ZR)+' occupé : '+t.name+' attend au frein final (stockage).':bIn()?'rail de garage en ligne ; à vide, Avancer (frein final en MANU) l\'y conduit.':'aucun rail du circuit en ligne.'),'warn');}}}
    else{const vm=Math.sqrt(8*Math.max(0,S_HOLD-t.s));t.v=Math.min(slow,vm);t.preTold=false;
      if(vm<.25){t.v=0;t.hold+=dt;t.fdrive=0;const lock=TRAV?onB||zK(ZR):FL;
        if(lock&&!t.lkTold){t.lkTold=true;log(onB?t.name+' est arrêté sur le rail de garage : '+DEVL+' sur une voie libre (il l\'emporte) puis '+(LREV?'Reculer':'Avancer')+' (rail B), ou Avancer (rail B) vers la gare.'
          :t.name+' arrêté '+(TRAV?'sur '+zName(ZR):'au frein final')+' (serré au pupitre).','warn');}
        if(t.hold>=1&&!lock&&!aheadBusy(t)&&!G.estop&&!G.brakeFault&&!(TRAV?!circIn():devHoldIn('Fin'))){if(PSB)t.toPre=true;else t.entering=true;t.hold=0;t.lkTold=false;}}}
  }
  t.s+=t.v*dt;if(t.s>=L)t.s-=L;
}
// Quai et portillons : les visiteurs se rangent par travée, puis embarquent quand les portillons s'ouvrent
const resGrp=k=>BAREA?0:BRES[k].u; // groupe de la réserve : toute la zone éditée, sinon les rangs d'un portillon
function resFree(){const R=G.platR;let f=-1;for(let j=0,n=0;j<R.length&&n<6;j++)if(!R[j]&&!R.some((r,q)=>r&&resGrp(q)===resGrp(j)&&sameCol(BRES[q],BRES[j])&&latP(BRES[q])>latP(BRES[j])+.05)){if(platCross(BRES[j],plen3(boardInA(BRES[j]))/4.2))continue;if(platReach(BRES[j]))return j;if(f<0)f=j;n++;}return f;} // première place libre sans personne derrière elle dans sa colonne, atteignable sans frôler personne (sinon la première, trajet direct)
function updatePlatform(dt){
  G.platT-=dt;G.platRT-=dt;const fr=SEG_OUT.list[0];
  // ordre d'arrivée (propriétaire, issue #44, 23/11) : on ne prend jamais une place devant quelqu'un qui attend déjà derrière elle dans la même colonne (behind) ; parmi les places
  // permises du wagon le moins occupé, la plus en avant : la travée se remplit rang par rang, de l'avant vers l'arrière
  const behind=i=>{const p=slotPos(i);return G.plat.some((r,q)=>r&&q!==i&&sameCol(slotPos(q),p)&&latP(slotPos(q))>latP(p)+.05);};
  const pick=()=>{let best=[],bo=CSEATS;const ok=new Array(SEATS);for(let i=0;i<SEATS;i++)ok[i]=!G.plat[i]&&!behind(i);
    for(let k=0;k<NCARS;k++){let o=0,f=0;for(let r=0;r<CSEATS;r++){if(G.plat[k*CSEATS+r])o++;else if(ok[k*CSEATS+r])f++;}if(!f)continue;if(o<bo){bo=o;best=[k];}else if(o===bo&&o<CSEATS)best.push(k);}
    const kb=best.length?best[Math.floor(Math.random()*best.length)]:-1;let bi=-1;if(kb>=0)for(let r=0;r<CSEATS;r++){const i=kb*CSEATS+r;if(ok[i]&&(bi<0||latP(slotPos(i))<latP(slotPos(bi))))bi=i;}return bi;};
  // réserve de la zone d'attente éditée (BRES, engine/garage.js, issue #24) : un visiteur arrivé avance à une place de portillon libérée (le plus proche d'elle)
  // travées réglées sans zone éditée (GAME.board.depth, issue #27) : rangs supplémentaires = réserve de leur portillon ; on n'avance que dans sa travée
  const NR=BRES.length,sameU=(k,i)=>BAREA||BRES[k].u===seatUnit(i).u;if(!Array.isArray(G.platR))G.platR=[];if(G.platR.length!==NR){G.platR.length=NR;for(let j=0;j<NR;j++)if(!G.platR[j])G.platR[j]=null;}
  if(NR&&G.platRT<=0){let i=pick(),j=-1;
    if(!BAREA){i=-1;for(let s=0;s<SEATS&&j<0;s++)if(!G.plat[s]&&!behind(s)){let bd=1e9;const p=slotPos(s);G.platR.forEach((r,k)=>{if(r&&r.on&&sameU(k,s)){const d=Math.hypot(BRES[k][0]-p[0],BRES[k][2]-p[2]);if(d<bd){bd=d;j=k;i=s;}}});}}
    else if(i>=0){const p=slotPos(i);let bd=1e9;G.platR.forEach((r,k)=>{if(r&&r.on){const d=Math.hypot(BRES[k][0]-p[0],BRES[k][2]-p[2]);if(d<bd){bd=d;j=k;}}});}
    if(i>=0&&j>=0&&BAREA&&platCross(slotPos(i),plen3(platTo(BRES[j],slotPos(i))||resTo(j,i))/3.2))i=-1; // place sur le trajet d'un visiteur en marche : plus tard (issue #44)
    if(i>=0&&j>=0){const o=G.platR[j],r={ci:o.ci,w:o.w,on:false,ph:o.ph};G.platR[j]=null;G.plat[i]=r;G.platRT=.3;walker(platTo(BRES[j],slotPos(i))||resTo(j,i),r.ci,()=>{r.on=true;},3.2,0,'wait');}}
  // ordre d'arrivée dans la réserve (propriétaire, issue #44) : une place libérée est reprise par celui qui attend juste derrière elle dans sa colonne (engine/garage.js
  // sameCol ; même portillon sans zone éditée), qui avance tout droit d'une place ; les places libres restent ainsi au fond des colonnes, et l'arrivant prend la première
  // d'entre elles qu'il peut atteindre sans frôler personne (resFree, platReach), par un trajet qui les contourne (boardInA, platPath) : ni devant, ni au travers d'eux
  if(NR&&(G.platCT=(G.platCT||0)-dt)<=0)for(let j=0;j<NR;j++){if(G.platR[j])continue;let k=-1,kl=1e9;G.platR.forEach((r,q)=>{const d=latP(BRES[q])-latP(BRES[j]);if(r&&r.on&&d>.05&&d<kl&&sameCol(BRES[q],BRES[j])&&resGrp(q)===resGrp(j)){kl=d;k=q;}});if(k<0||BAREA&&platCross(BRES[j],plen3(platTo(BRES[k],BRES[j])||resStep(k,j))/2.4))continue;
    const o=G.platR[k],r={ci:o.ci,w:o.w,on:false,ph:o.ph};G.platR[k]=null;G.platR[j]=r;G.platCT=.25;walker(platTo(BRES[k],BRES[j])||resStep(k,j),r.ci,()=>{r.on=true;},2.4,0,'wait');break;}
  // avance rang par rang : une place de portillon libérée est reprise par celui qui attend juste derrière elle dans sa colonne (le plus proche), tout droit
  if((G.platAT=(G.platAT||0)-dt)<=0)for(let i=0;i<SEATS;i++){if(G.plat[i])continue;const p=slotPos(i);let q=-1,ql=1e9;
    G.plat.forEach((r,m)=>{if(!r||!r.on)return;const d=latP(slotPos(m))-latP(p);if(d>.05&&d<ql&&sameCol(slotPos(m),p)){ql=d;q=m;}});
    if(q<0||BAREA&&platCross(p,plen3([slotPos(q),p])/2.4))continue;
    const o=G.plat[q],r={ci:o.ci,w:o.w,on:false,ph:o.ph};G.plat[q]=null;G.plat[i]=r;G.platAT=.25;walker([slotPos(q),p],r.ci,()=>{r.on=true;},2.4,0,'wait');break;}
  if(G.platT<=0&&fr&&fr.r<.4){
    let i=pick();const rb=NR&&(BAREA?G.platR.some(r=>r):i>=0&&G.platR.some((r,k)=>r&&sameU(k,i)));
    if(rb||(i<0&&NR)){i=-1;const j=resFree(); // places des portillons prises, ou d'autres attendent déjà : dans la réserve (la plus proche des portillons)
      if(j>=0){removeVisitor(fr);const r={ci:fr.ci,w:fr.w,on:false,ph:fr.ph};G.platR[j]=r;G.platT=.22;walker([[fr.x,0,fr.z]].concat(boardInA(BRES[j])),fr.ci,()=>{r.on=true;},4.2,0,'wait');}}
    if(i>=0&&BAREA&&platCross(slotPos(i),plen3(boardInA(slotPos(i)))/4.2))i=-1;
    if(i>=0){removeVisitor(fr);const r={ci:fr.ci,w:fr.w,on:false,ph:fr.ph};G.plat[i]=r;G.platT=.22;const p=slotPos(i);
      if(BAREA)walker([[fr.x,0,fr.z]].concat(boardInA(p)),fr.ci,()=>{r.on=true;},4.2,0,'wait'); // zone d'attente éditée (GAME.boardAreas, engine/garage.js) : dans le polygone jusqu'à la place
      else{const g=GUNITS[seatUnit(i).u],b=BAYS[g.k],W=BWALK,j=g.c+rnd(-.2,.2)*g.h/(CAR/2);walker([[fr.x,0,fr.z]].concat(SITE.board.via.map(q=>[q[0],0,q[1]]),[[b.x+b.rx*W+b.tx*j,0,b.z+b.rz*W+b.tz*j],p]),fr.ci,()=>{r.on=true;},4.2,0,'wait');}}
  }
  const t=trains.find(o=>o.st==='station'&&o.phase==='board'&&!o.hs&&!o.depReq); // portillons : ouverts et fermés seulement au pupitre
  G.gate=clamp(G.gate+(G.gatesOpen||G.walkers.some(k=>k.kind==='board')?dt:-dt)/.7,0,1); // un portillon ne se referme pas sur un visiteur qui le franchit
  if(t&&!t.evq&&G.gate>.9)for(let i=0;i<SEATS;i++){const r=G.plat[i]; // embarquement (pas pendant l'évacuation du train, issue #26) : sécurités du wagon ouvertes
    if(r&&r.on&&!t.seats[i]&&t.rc[Math.floor(i/CSEATS)]>.95){G.plat[i]=null;const seat={ci:r.ci,w:r.w,on:false};t.seats[i]=seat;t.idle=0;seatBase(t,i,_v);walker([slotPos(i),[_v.x,0,_v.z]],r.ci,()=>{seat.on=true;},2.2,0,'board');}}
}
function updateTrains(dt){
  for(const t of trains){
    // sécurités : ouverture / fermeture animées. Ouverture : relâchement d'air (son), les barres ne bougent que 0,5 s plus tard (RES_AIR) ;
    // fermeture : crémaillère (son), wagon par wagon. t.rcO : sens courant par wagon (bits), t.rcW : attente avant ouverture.
    if(!t.rcW)t.rcW=new Array(NCARS).fill(0),t.rcO=0;let air=false;
    for(let k=0;k<NCARS;k++){const o=t.st==='station'&&(G.resOpen||(t.rcT>>k&1)),was=t.rcO>>k&1;
      if(o&&!was){t.rcO|=1<<k;if(t.rc[k]<.98){t.rcW[k]=RES_AIR;air=true;}}
      else if(!o&&was){t.rcO&=~(1<<k);t.rcW[k]=0;if(t.rc[k]>.05&&t.st==='station')sfx.resClose(BAYS[k].x,BAYS[k].z);}
      if(o&&t.rcW[k]>0){t.rcW[k]=Math.max(0,t.rcW[k]-dt);continue;}
      t.rc[k]=clamp(t.rc[k]+(o?dt:-dt)/RES_T,0,1);}
    if(air){const m=BAYS[NCARS>>1];sfx.resAir(m.x,m.z);}
    if(t.st==='station')updateStation(t,dt);
    else if(t.st==='run')updateRun(t,dt);
    else if(t.st==='garage')updateYard(t,dt);
    if(t.st==='run'&&t.v===0&&((G.liftBroken&&zoneOf(t.s)==='lift')||(G.brakeFault&&zoneOf(t.s)==='brake')))G.sat=clamp(G.sat-.002*count(t)*dt,0,100);
  }
  // l'appareil ne bouge que sur commande de l'opérateur ; l'arrêt d'urgence le fige
  if(raMoving()&&!G.estop){G.ra.k+=dt/(G.ra.d||MV.t);if(G.ra.k>=1){G.ra.k=1;G.ra.pos=G.ra.to;log(RAN+(G.ra.pos?' retiré.':' en place sur le circuit.'));}}
  if(devMoving()&&!G.estop){G.dev.k+=dt/(G.dev.d||MV.t);if(G.dev.k>=1){G.dev.k=1;G.dev.pos=G.dev.to;log(DEVN+' en place sur '+posName(G.dev.pos)+'.');
    const c=G.dev.pos===PC&&trains.find(o=>onCar(o)); // pont droit sur G : le train porté retrouve le circuit, sur le frein final
    if(c){c.st='run';c.s=S_HOLD;c.v=0;c.inBrake=true;c.hold=1;c.entering=false;c.fdrive=0;c.told=false;c.lane=0;c.g=0;log(SG?c.name+' est de retour sur le circuit ('+zName('RB').toLowerCase()+' sur P) : '+(zK('RB')?'freins serrés, relâchez-les (ou Avancer) pour l\'envoyer en gare.':'il repart vers la gare dès qu\'elle est libre.'):c.name+' est sur le rail de garage en ligne : Avancer (rail B) l\'envoie en gare dès qu\'elle est libre. '+(RA?'Écartez ensuite '+DEVL+' vers une voie, puis remettez '+RAN+' sur le circuit.':'Remettez ensuite '+DEVL+' sur P.'),'good');}}}
}

/* ══════════ MÉTÉO ET JOURNÉE ══════════ */
function updateWeather(dt){
  const w=G.wx;if(G.sandbox){w.type='clear';w.next=1e6;G.flash=0;return;}
  if(w.type==='clear'){w.next-=dt;
    if(w.next<=0){
      if(Math.random()<.5){w.type='warn';w.t=30;log('🌩️ Orage en approche ! Suspendez les départs avant qu\'il n\'éclate.','warn');}
      else{w.type='rain';w.t=rnd(100,170);log('🌧️ Averse : moins de visiteurs, file moins patiente.');}
    }
  }else{w.t-=dt;
    if(w.t<=0){
      if(w.type==='warn'){w.type='storm';w.t=rnd(60,90);log((SITE.text&&SITE.text.storm)||'Orage sur l\'attraction ! Aucun train ne doit partir.','bad');}
      else{if(w.type==='storm')log('☀️ L\'orage est passé, l\'exploitation peut reprendre.','good');w.type='clear';w.next=rnd(280,520);}
    }
  }
  G.flash=Math.max(0,G.flash-dt*3);
  if(w.type==='storm'&&Math.random()<dt*.3){G.flash=1;sfx.thunder();if(typeof strike==='function')strike();}
}
/* Jeu continu (propriétaire, 17/11 : « supprime la notion de jours qui réinitialise tout ») : aucune fin de journée, rien n'est remis à zéro ;
   l'attraction ne ferme qu'au bouton du joueur. L'horloge tourne sur la plage d'ouverture T_OPEN…T_CLOSE et repart à T_OPEN (affluence continue au raccord,
   engine/queue.js hourF) ; G.played = minutes de jeu cumulées. Salaires : WAGE € par plage (9 h), prélevés en continu (G.wage = fraction due).
   Budget sous OVER € (carrière) : fin de partie à tout moment. */
/* Suivi de l'évacuation (issue #41, générique) : voyant « Évacuation en cours » du pupitre (#lEvac, engine/ui.js) tant que evacOn() ; à la fin, message au journal.
   Évacués arrêtés devant une barrière de file fermée (marcheur 'evac', k.bk = la barrière, engine/queue.js) : message qui nomme la barrière (numéro, tronçon,
   distance à l'entrée le long de la file), une fois, puis rappel toutes les EVAC_REM s de simulation (30 min de jeu) tant qu'elle les retient ; barrière mise en
   évidence sur la carte (b.evHi, engine/render.js) jusqu'à son ouverture. État transitoire, non sauvegardé. */
const EVW={on:false,bars:new Map()},EVAC_REM=60;
function barWhere(b){let c=0;const fk=(e,l)=>(e===l.loop?'boucle':'raccourci')+(l.name?' « '+l.name+' »':'')+', ';
  for(const st of STAGES){const B=st.seg?[st.seg]:[st.fork.r||st.fork.short,st.fork.short,st.fork.loop];
    for(const e of B){const x=e.bx.find(x=>x.b===b);if(x)return (st.fork?fk(e,st.fork):'')+'à '+Math.round(c+x.d)+' m de l\'entrée de la file';}
    c+=B[0].len;}
  return 'à '+Math.round(Math.hypot(b.x-ENTRY0[0],b.z-ENTRY0[1]))+' m de l\'entrée de la file';}
const barName=b=>'barrière n° '+String(b.key).replace(/^b/,'')+' ('+barWhere(b)+')';
function evacTick(dt){const on=evacOn();
  for(const b of BARS)if(b.evHi&&b.open)b.evHi=false; // mise en évidence jusqu'à l'ouverture
  if(!on){if(EVW.on){EVW.on=false;EVW.bars.clear();for(const b of BARS)b.evHi=false;log('Évacuation terminée, la file peut reprendre'+(G.open?'.':' : l\'entrée est fermée, rouvrez-la.'),'good');}return;}
  EVW.on=true;const n=new Map();
  for(const k of G.walkers)if(k.kind==='evac'&&k.bk&&!k.bk.open&&BARS.includes(k.bk))n.set(k.bk.key,(n.get(k.bk.key)||0)+1);
  for(const key of [...EVW.bars.keys()])if(!n.has(key))EVW.bars.delete(key);
  for(const [key,c] of n){const b=BARS.find(b=>b.key===key),r=EVW.bars.get(key);b.evHi=true;
    if(!r){EVW.bars.set(key,{t:EVAC_REM});log('Évacuation bloquée : '+c+' évacué'+(c>1?'s attendent':' attend')+' devant la '+barName(b)+', fermée. Ouvrez-la d\'un clic sur la carte (barrière mise en évidence).','bad');}
    else if((r.t-=dt)<=0){r.t=EVAC_REM;log('Rappel : la '+barName(b)+' est fermée, '+c+' évacué'+(c>1?'s':'')+' bloqué'+(c>1?'s':'')+'. Personne n\'entre dans la file tant que l\'évacuation n\'est pas finie.','warn');}}}
const T_OPEN=600,T_CLOSE=1140,WAGE=350,OVER=-2000;
function step(dt){
  const m=dt*.5;G.time+=m;if(G.time>=T_CLOSE)G.time-=T_CLOSE-T_OPEN;G.played=(G.played||0)+m;
  if(!G.sandbox){G.wage=(G.wage||0)+m*WAGE/(T_CLOSE-T_OPEN);if(G.wage>=1){const n=Math.floor(G.wage);G.wage-=n;pay(n);}}
  if(G.sandbox){G.wear.chain=G.wear.track=G.wear.brake=0;G.liftBroken=G.brakeFault=false;for(const t of trains){t.wear=0;t.hs=false;if(t.fault){t.fault=null;if(t.phase==='fault')t.phase='ready';}}}
  updateWeather(dt);updateVisitors(dt);evacTick(dt);updatePlatform(dt);stepOps(dt);updateTrains(dt);
  if(G.job){G.job.rem-=dt;if(G.job.rem<=0)finishJob();}
  if(!G.sandbox&&!G.over&&G.money<OVER){G.over=true;G.open=false;log('Le budget est dans le rouge : fin de partie.','bad');bilan();}
}
/* Bilan cumulé (bouton « Bilan » #bBil, fenêtre #mBil) ; fin de partie : même fenêtre, bouton Recommencer */
function bilan(){
  const s=G.stats,net=s.income-s.costs,h=Math.max(1/60,(G.played||0)/60),rph=s.riders/h,H=(T_CLOSE-T_OPEN)/60,goal=(SITE.goal||400)/H;
  $('bTitle').textContent=G.over?'Fin de partie':'Bilan de l\'exploitation';
  $('bTable').innerHTML=[['Durée d\'exploitation',Math.floor(h)+' h '+String(Math.floor((G.played||0)%60)).padStart(2,'0')],['Passagers transportés',s.riders],['Passagers par heure',Math.round(rph)],['Trains envoyés',s.disp],['Visiteurs repartis mécontents',s.quits],['Visiteurs refoulés (file pleine)',s.turned],
    ...(G.sandbox?[]:[['Recettes',s.income+' €'],['Dépenses (dont salaires '+Math.round(WAGE/H)+' € par heure)',Math.round(s.costs)+' €'],['dont amendes',s.fines+' €'],
    ['Résultat',(net>=0?'+':'')+Math.round(net)+' €'],['Budget',Math.round(G.money)+' €']]),['Satisfaction',Math.round(G.sat)+' %']]
    .map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>').join('');
  $('bMsg').textContent=G.over?'Le budget est dans le rouge : la direction vous retire les clés de l\'attraction…'
    :(G.played||0)<60?'Moins d\'une heure d\'exploitation : bilan encore partiel.'
    :rph>=goal?((SITE.text&&SITE.text.great)||'Excellente exploitation !'):rph>=goal/2?'Exploitation correcte. Un second train et moins de pannes feraient mieux.'
    :'Exploitation difficile. Ouvrez l\'entrée et sortez le second train.';
  $('bBtn').textContent=G.over?'Recommencer':'Reprendre';
  $('mBil').classList.remove('hidden');
}

/* ══════════ ACTIONS ET INTERFACE ══════════ */
function act(a,arg){
  const t=arg!==undefined&&trains[arg];
  if(a==='speed')G.speed=+arg;
  else if(a==='help')$('mHelp').classList.remove('hidden');
  else if(a==='closeHelp'){$('mHelp').classList.add('hidden');sfx.init();}
  else if(a==='mute'){const m=sfx.toggle();$('bMute').classList.toggle('on',!m);$('bMute').title=m?'Son coupé : cliquer pour l\'activer':'Son activé : cliquer pour le couper';}
  else if(a==='cam')setCam(arg);
  else if(a==='fs')setFs(!fsOn);
  else if(a==='fsdesk')document.body.classList.toggle('fsdesk');
  else if(a==='tab')setTab(arg);
  else if(a==='bilan')bilan();
  else if(a==='closeBil'){if(G.over){location.reload();return;}$('mBil').classList.add('hidden');}
  else if(a==='open'){if(!G.open&&G.over)return;G.open=!G.open;
    log(G.open?'Entrée ouverte : les visiteurs entrent dans la file.':'Entrée fermée : plus personne n\'entre. Les '+G.queue.filter(v=>v.mode==='q').length+' visiteurs déjà dans la file continuent d\'embarquer.',G.open?'good':'warn');}
  else if(a==='evac'){const nq=G.queue.length,tv=evacTrains();if(!evacCan())return;
    for(const v of G.queue)walker(backPath(v,true),v.ci,null,rnd(3,3.8),0,'evac');
    let nt=0;for(const o of tv){o.evq=true;o.depReq=false;nt+=count(o);}
    clearQueue();const n=nq+platEvac();G.sat=clamp(G.sat-Math.min(8,(n+nt)*.03),0,100);log('File évacuée : '+n+' visiteurs (file et portillons) ressortent par l\'entrée'+(nt?', '+nt+' passager'+(nt>1?'s':'')+' du train à quai descendent par la sortie.':'.'),'warn');}
  else if(a==='syn')toggleSyn();
  else if(a==='roof'){G.roofOff=!G.roofOff;}
  else if(a==='hidest'){G.hideSt=!G.hideSt;} // « Masquer la gare » : bâtiment de gare, toits effaçables et couvertures (tunnels, rochers) masqués, couloirs couverts visibles
  else if(a==='auto'){G.auto=!G.auto;log('Départs en mode '+(G.auto?'automatique.':'manuel.'));}
  else if(a==='gates'){ // portillons : seulement sur ordre du pupitre, en auto comme en manuel
    if(G.gatesOpen){G.gatesOpen=false;log('Portillons fermés.');}
    else{const s=trains.find(o=>o.st==='station'&&['board','check','ready'].includes(o.phase)&&!o.hs);
      if(s){s.phase='board';s.depReq=false;resetOps();G.gatesOpen=true;log('Portillons ouverts : embarquement.');}
      else refuse('Portillons : aucun train à quai prêt à embarquer.');}}
  else if(a==='res'){ // sécurités : ouverture instantanée au pupitre ; le verrouillage (portillons fermés) lance la vérification : les opérateurs ferment wagon par wagon
    const s=trains.find(o=>o.st==='station');
    if(!s){G.resOpen=false;refuse('Sécurités : aucun train à quai.');}
    else if(G.resOpen||(s.phase==='board'&&s.rcT)){
      if(s.phase==='unload'&&count(s))refuse('Sécurités : débarquement en cours.');
      else if(G.gatesOpen||G.gate>.05)refuse('Sécurités : fermez d\'abord les portillons ; le verrouillage lance la vérification par les opérateurs.');
      else{G.resOpen=false;s.rcTold=false;resetOps();
        if(s.phase!=='board'){s.rcT=0;log('Sécurités verrouillées.');}
        else if(G.bypass){s.rcT=0;s.phase='ready';log('Sécurités verrouillées et fermées sans contrôle des opérateurs (BY-PASS).','bad');}
        else{startCheck(s);log('Sécurités verrouillées : les deux opérateurs ferment et vérifient les '+RES_NAME+' wagon par wagon.');}}}
    else if(s.phase==='fault')refuse('Sécurités : défaut sur '+s.name+', réarmez d\'abord.');
    else{G.resOpen=true;s.rcT=(1<<NCARS)-1;if(s.phase==='check'||s.phase==='ready'){s.phase='board';s.depReq=false;resetOps();}
      log('Sécurités ouvertes'+(s.phase==='unload'&&count(s)?' : débarquement.':' : embarquement possible (portillons).'));}}
  else if(a==='bypass'){G.bypass=!G.bypass;log(G.bypass?'BY-PASS de la validation des lapbars activé : départ possible sans vérification.':'Validation des lapbars par les opérateurs rétablie.',G.bypass?'bad':'good');}
  else if(a==='depart'){
    const s=G.auto?trains.find(o=>o.st==='station'&&o.phase==='board'&&!o.depReq):trains.find(o=>o.st==='station'&&!o.depReq&&(o.phase==='ready'||(o.phase==='board'&&!G.gatesOpen&&(G.bypass||count(o)===0))));
    if(G.resOpen&&trains.some(o=>o.st==='station'))log('Départ refusé : sécurités ouvertes. Fermez les portillons puis verrouillez les sécurités (vérification par les opérateurs).','warn');
    else if(s){s.depReq=true;const r=blockReason(s);if(r)log('Départ refusé pour l\'instant : '+s.name+' ne peut pas partir : '+r+'.','warn');}else if(!G.auto)log('Départ refusé : il faut les portillons fermés et les lapbars validés par les deux opérateurs.','warn');}
  else if(a==='estop'){G.estop=!G.estop;if(G.estop)sfx.alarm();if(G.estop)trains.forEach(o=>{o.mv=0;o.fdrive=0;});log(G.estop?'⛔ Arrêt d\'urgence enclenché : lift stoppé, départs et manœuvres bloqués.':'Arrêt d\'urgence réarmé.',G.estop?'bad':'good');}
  else if(a==='job')startJob(arg);
  else if(a==='pos')yardPos(+arg);
  else if(a==='ra')raPos(+arg);
  else if(a==='zone'){const q=String(arg).split(':');zoneCmd(q[0],q[1]);}
  else if(a==='zauto'){ZONES.forEach(Z=>{if(Z.auto){G.zm[Z.id]=false;G.zk[Z.id]=false;}});log('Toutes les zones de freinage en AUTO : cantonnement automatique.','good');}
  else if(a==='revise')startJob('trainRev',t);
  else if(a==='rearm')startJob('rearm',t);
  ui();
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&!b.disabled)act(b.dataset.act,b.dataset.arg);});
// patience des visiteurs (G.patL, niveau 0…5) : multiplie la patience tirée à l'arrivée (v.pat) ; le dernier niveau est infini (personne ne quitte la file)
const PAT_M=[.5,1,2,4,8,Infinity],PAT_N=['faible','normale','grande','très grande','extrême','infinie'];
// Aide : plus ouverte au lancement (propriétaire, 2026-11-17), seulement au bouton « ? » ; le son démarre au premier geste du joueur
{const once=()=>{sfx.init();removeEventListener('pointerdown',once);removeEventListener('keydown',once);};addEventListener('pointerdown',once);addEventListener('keydown',once);}
$('patL').addEventListener('input',e=>{G.patL=+e.target.value;$('patV').textContent=PAT_N[G.patL];});
$('crowd').addEventListener('input',e=>{G.crowd=e.target.value/100;const c=+e.target.value;
  $('crowdV').textContent=c+' % — '+(c===0?'parc vide':c<=50?'faible':c<=120?'normale':c<=200?'forte':'saturée');});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();act('speed',G.speed?0:1);}});
$('trains').innerHTML=trains.map(t=>`<div class="card">
  <div class="name"><span class="dot" style="background:${t.col}"></span>${t.name}</div>
  <div class="st" id="tSt${t.i}"></div>
  <div class="bar"><i id="tW${t.i}"></i><span id="tW${t.i}T"></span></div>
  <div class="row">
    <button id="tR${t.i}" data-act="revise" data-arg="${t.i}">Réviser (600 €)</button>
    <button id="tA${t.i}" data-act="rearm" data-arg="${t.i}">Réarmer lapbars</button>
  </div></div>`).join('');
/* Pupitre par zones : sections Gare, Lift, Zones de freinage, Garage (ids : AGENTS.md) */
{const zb=(z,c,cls,txt,ti)=>`<button class="pb sq sm ${cls}" id="z${z}_${c}" data-act="zone" data-arg="${z}:${c}" title="${ti}">${txt}</button>`,E='<span></span>';
  const head=`<div class="zrow"><span></span><span class="plate">Mode</span><span class="plate">Freins</span><span class="plate">Avant</span><span class="plate">Arrière</span><span class="plate">Arrêt</span></div>`;
  const row=Z=>{const z=Z.id,nm=`<div class="plate zn"><span class="zl" id="lz${z}"></span>${Z.name}</div>`;
    if(z==='Lift')return `<div class="zrow">${nm}${E}${zb(z,'on','green','MAR','Lift : marche')}${zb(z,'off','amber','ARR','Lift : arrêt (la chaîne s\'arrête, le train sur le lift y reste)')}${E}${E}</div>`;
    return `<div class="zrow">${nm}`+(Z.auto?zb(z,'m','blue','AUTO','Mode de la zone : AUTO (cantonnement automatique) ou MANU (freins et moteurs au pupitre)'):E)
      +(Z.brake?zb(z,'k','amber','F','Freins de la zone : serrer / relâcher (relâchement refusé si la section suivante est occupée)'):z==='St'?'<span class="plate" id="zSt_fr" title="Freins de gare : serrés automatiquement tant qu\'un train est à quai, relâchés par la seule séquence Départ (portillons fermés, lapbars validés)">AUTO</span>':E)
      +(Z.drive?zb(z,'f','green','AV','Moteurs de la zone : avancer le train qui s\'y trouve')+(Z.drive==='fwd'?E:zb(z,'b','green','AR','Moteurs de la zone : reculer le train qui s\'y trouve'))+zb(z,'x','amber','STOP','Moteurs de la zone : arrêt'):E+E+E)+'</div>';};
  const lrow=Z=>`<div class="zrow"><div class="plate zn"><span class="zl" id="lz${Z.id}"></span>${Z.name}</div>${E}`+zb(Z.id,'k','amber','F','Freins forcés de la voie : serrer (arrêt immédiat du train qui entre ou sort, Dispatch refusé) / relâcher (reprise au Dispatch)')+zb(Z.id,'d','green disp','DISPATCH','Dispatch : '+DEVN.toLowerCase()+' en place sur cette voie, fait entrer le train prêt (zone porteuse) ou sortir le train de tête vers '+DEVL+' ; le sens est choisi selon la position de l\'appareil')+'</div>';
  const sec=(t,k,x,h=1)=>`<div class="dsec"><span>${t}</span>${x||''}</div>`+(h?head:'')+ZONES.filter(Z=>Z.sec===k).map(row).join('');
  $('deskZones').innerHTML=sec('Gare','st')+sec('Lift','lift','',0)
    +sec('Zones de freinage','brk','<button class="pb sq sm blue" id="zAuto" data-act="zauto" title="Toutes les zones de freinage en AUTO">TOUT AUTO</button>')
    +`<div class="dsec"><span>Garage</span></div><div class="deskrow"><div class="ctl" style="flex:2"><div class="pair" id="yPos"></div><div class="plate"><span id="yName"></span><br><span id="yState"></span></div></div></div>`
    +(LANES.length?'<div class="zrow"><span></span><span></span><span class="plate">Freins</span><span class="plate" style="grid-column:4/-1">Voie</span></div>':'')+ZONES.filter(Z=>Z.sec==='gar').map(lrow).join('');}
$('yPos').innerHTML=POS_ORDER.map(p=>`<button class="pb sq sm blue" id="y${posId(p)}" data-act="pos" data-arg="${p}" title="${DEVN} : ${p===PG?'position G, rail de garage sur le circuit':p?'position voie '+p+' ('+LANES[p-1].name+')':'position P, circuit'}">${posId(p)}</button>`).join('');
$('yName').textContent=DEVN;
if(RA)$('yPos').parentElement.insertAdjacentHTML('beforebegin','<div class="ctl"><div class="pair">'+[0,1].map(p=>`<button class="pb sq sm blue" id="yA${p}" data-act="ra" data-arg="${p}" title="${RAN} (rail du circuit) : ${p?'retiré vers l\'extérieur':'sur le circuit'}">${p?'E':'C'}</button>`).join('')+'</div><div class="plate">'+RAS+'<br><span id="yAState"></span></div></div>');
/* Relance d'un train arrêté dans une zone de freinage du parcours (frein de bloc ; OSM waiting, brake_run ou moving : propriétaire, issue #33, 20/11 :
   « un train arrêté repart à la même vitesse qu'à l'entrée »). Cible = vitesse relevée à l'entrée de la zone (t.bvin au début BZ0, gardée dans t.brv à la relance), ramenée à trim.v si la zone
   ralentit les trains (SITE.zones.B<k>.trim), au moins VPROP ; accélération des roues = celle qui atteint la cible quand la queue a passé le point de frein
   (v² / 2 TLEN), entre 2 et 5 m/s² (ESTIMÉ). Le train n'atteint donc la cible que si la zone le permet ; ensuite, gravité. */
function blkRelaunch(t){const k=(t.bgo||t.brs)-1;let v=t.brs===k+1&&t.brv>0?t.brv:VPROP;if(BTRIM[k])v=Math.min(v,BTRIM[k]);v=Math.max(VPROP,v);
  return {v,a:clamp(v*v/(2*TLEN),2,5)};}
