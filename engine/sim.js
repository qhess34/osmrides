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
  const u=t.g-YD.a-(k+.5)*CAR;return u<0?frameAt(SW_A+u,o):gFrame(t.lane,u,o);
}
function seatBase(t,i,o){
  carFrame(t,Math.floor(i/CSEATS),_f);o.copy(_f.p).addScaledVector(_f.U,.35);
  const q=seatOff(i%CSEATS);return o.addScaledVector(_f.T,q[0]).addScaledVector(_f.R,q[1]);
}
const _v=new V3;
function arrive(t){
  t.st='station';t.s=S_ST;t.v=0;t.entering=false;t.toPre=false;t.phase='unload';t.pt=0;t.idle=0;t.depReq=false;t.gTold=false;
  if(t.wear>=100&&!t.hs){t.hs=true;log(t.name+' est hors service : rangez-le au garage pour révision (commandes de zone).','bad');}
}
// train à l'arrêt au point de raccordement : en gare (vide possible, portillons en jeu), ou sur le frein final
const atAnchor=t=>YD.at==='brake'?(t.st==='run'&&t.v===0&&Math.abs(t.s-S_HOLD)<.4):(t.st==='station'&&t.phase==='board'&&!t.depReq);
/* ══════════ MANŒUVRES (docs/manoeuvres.md) : Positionner, Avancer, Reculer, Arrêter ══════════ */
const ANCH_NAME=YD.at==='brake'?'le frein final':'la gare';
function anchorFree(t){ // le point de raccordement peut recevoir un train qui sort du garage
  if(YD.at==='brake')return !trains.some(o=>o!==t&&((o.st==='run'&&o.s>=(BLK.length?BLK[BLK.length-1]:S_BRK)-1)||(o!==t&&nearDev(o))));
  return !trains.some(o=>o!==t&&(o.st==='station'||(o.st==='run'&&(o.entering||o.s<S_ST+TLEN+2))||nearDev(o)));
}
const sameLane=t=>trains.filter(o=>o!==t&&o.st==='garage'&&o.lane===t.lane);
function fwdLim(t){if(t.lane<0)return t.g;let m=LANES[t.lane].end;for(const o of sameLane(t))if(o.g>t.g)m=Math.min(m,o.g-GSTEP);return m;}
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
  const o=devLock();if(o)return refuse(DEVN+' verrouillé : '+o.name+(TRAV&&o.st==='run'&&atAnchor(o)?' a des passagers sur le rail de garage.':TRAV?' est sur le chariot sans y être arrêté, ou y roule.':' est sur l\'appareil ou à moins d\'une longueur de train.'));
  if(TRAV){ // pont droit : le chariot emporte le train arrêté sur le rail B
    if(RA&&p===PG&&!raOut())return refuse(DEVN+' : le rail de garage ne vient en ligne que si '+RAN+' est retiré'+(raMoving()?' (en mouvement).':' : '+RAN+' est sur le circuit.'));
    const c=trains.find(o=>onCar(o));
    if(c&&p===PG){const MR=SITE.maxRun||trains.length,run=trains.filter(o=>o.st!=='garage').length;
      if(run>=MR)return refuse('Déjà '+run+' trains sur le circuit (au plus '+MR+') : '+c.name+' reste sur le chariot.');
      if(!anchorFree(c))return refuse('Dernier canton occupé : '+c.name+' ne peut pas être remis sur le circuit (fermez au besoin un frein de bloc).');}
    if(c&&p&&p!==PG&&trains.some(o=>o.st==='garage'&&o!==c&&o.lane===p-1))return refuse('Voie '+p+' ('+LANES[p-1].name+') occupée : '+c.name+' ne peut pas y être porté.');
    const r=trains.find(o=>o.st==='run'&&atAnchor(o)&&G.dev.pos===PG);
    if(r&&p!==PG){r.st='garage';r.lane=-1;r.g=G_B;r.mv=0;r.v=0;r.fdrive=0;r.told=false;r.depReq=false;r.entering=false;r.toPre=false;r.inBrake=false;r.phase='board';
      log(r.name+' est emporté par le chariot.');}
  }
  G.dev.to=p;G.dev.k=0;G.dev.d=TRAV?Math.max(MV.t,Math.abs(OFF[p]-OFF[G.dev.pos])/MV.vc):MV.t;
  log(DEVN+' commandé vers '+posName(p)+(RA?(G.dev.pos===PG?' : plus aucun rail en ligne, trains retenus avant le pont.':'.'):TRAV?(p===PG||!p?'.':' : rail du circuit hors ligne, trains retenus avant le pont.'):p?(YD.at==='brake'?' : entrée en gare bloquée.':' : départs bloqués.'):'.'));
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
    t.lane=j;t.mv=1;log(t.name+' entre'+(LREV?' en marche arrière':'')+' sur '+posName(j+1)+'.');return true;
  }
  if(TRAV&&t.st!=='garage')return refuse(t.name+' : le chariot emporte le train. Pont sur G, train arrêté à vide sur le rail de garage, puis pont sur une voie libre.');
  if(t.st==='garage'){
    const L_=LANES[t.lane];
    if(t.mv>0)return false;
    if(t.g-TLEN<L_.dev-.01&&!devOn(t.lane))return refuse(t.name+' ne franchit pas '+DEVL+' : il n\'est pas en place sur '+posName(t.lane+1)+'.');
    if(fwdLim(t)-t.g<.05)return refuse(t.name+(t.g>=L_.end-.05?' est déjà en bout de voie.':' est bloqué par le train garé devant lui.'));
    t.mv=1;log(t.name+(LREV?' recule':' avance')+' vers le fond de '+posName(t.lane+1)+'.');return true;
  }
  if(!atAnchor(t))return refuse(t.name+' doit être arrêté '+(YD.at==='brake'?'sur le frein final':'en gare, à quai')+' pour quitter le circuit.');
  if(count(t)>0)return refuse(t.name+' a des passagers : il ne quitte jamais le circuit.');
  if(YD.at!=='brake'&&G.gatesOpen)return refuse('Portillons ouverts : fermez-les avant de manœuvrer '+t.name+'.');
  if(devMoving())return refuse(DEVN+' en mouvement : '+t.name+' ne peut pas le franchir.');
  if(!G.dev.pos)return refuse(DEVN+' sur P : positionnez-le d\'abord sur une voie de garage.');
  const j=G.dev.pos-1,n=trains.filter(o=>o.st==='garage'&&o.lane===j).length;
  if(n>=LANES[j].cap)return refuse('Voie '+(j+1)+' ('+LANES[j].name+') pleine ('+LANES[j].cap+' train'+(LANES[j].cap>1?'s':'')+').');
  if(trains.some(o=>o!==t&&nearDev(o)))return refuse('Manœuvre déjà en cours près de '+DEVL+'.');
  t.st='garage';t.lane=j;t.g=0;t.mv=1;t.v=0;t.fdrive=0;t.told=false;t.depReq=false;t.entering=false;t.toPre=false;t.phase='board';
  log(t.name+' quitte le circuit vers '+posName(j+1)+'.');return true;
}
function yardBack(t){
  if(G.estop)return refuse(t.name+' : manœuvre refusée, arrêt d\'urgence enclenché.');
  if(t.st!=='garage')return refuse(t.name+' est sur le circuit : la marche arrière ne sert qu\'à sortir du garage.');
  if(t.mv<0)return false;
  if(G.job&&G.job.t===t)return refuse(t.name+' est en révision.');
  const MR=SITE.maxRun||trains.length,run=trains.filter(o=>o.st!=='garage').length; // au plus SITE.maxRun trains sur le circuit
  if(run>=MR&&!sameLane(t).some(o=>o.g<t.g))return refuse('Déjà '+run+' trains sur le circuit (au plus '+MR+') : '+t.name+' reste au garage.');
  if(TRAV&&t.lane<0)return refuse(t.name+' est sur le chariot : positionnez '+DEVL+' sur G pour le remettre sur le circuit.');
  const L_=LANES[t.lane],out=t.g-TLEN>=L_.dev-.01,lim=backLim(t);
  if(TRAV&&t.g-lim<.05)return refuse(t.name+' reste sur sa voie : '+(devOn(t.lane)?'le rail de garage est occupé.':DEVL+' n\'est pas en place face à '+posName(t.lane+1)+'.'));
  if(t.g-lim<.05){
    if(out&&!devOn(t.lane))return refuse(t.name+' ne franchit pas '+DEVL+' : il n\'est pas en place sur '+posName(t.lane+1)+'.');
    if(out&&!anchorFree(t))return refuse(ANCH_NAME[0].toUpperCase()+ANCH_NAME.slice(1)+' n\'est pas libre : '+t.name+' reste au garage'+(YD.at==='brake'?'.':' (bloquez au besoin l\'autre train au frein final).'));
    return refuse(t.name+' est bloqué par un autre train garé derrière lui.');
  }
  t.mv=-1;log(t.name+(LREV?' avance':' recule')+(TRAV?' vers le rail de garage du pont.':lim<=0?' vers '+ANCH_NAME+'.':'.'));return true;
}
function updateYard(t,dt){
  if(!t.mv||G.estop)return;
  {const z=tZone(t);if(zK(z)){t.mv=0;log(t.name+' arrêté : freins de '+zName(z)+' serrés.','warn');return;}}
  if(t.mv>0){const m=fwdLim(t);t.g=Math.min(m,t.g+MV.v*dt);
    if(t.g>=m-1e-6){t.mv=0;log(t.g>=LANES[t.lane].end-.05?t.name+' est garé en bout de '+posName(t.lane+1)+'.':t.name+' arrêté derrière le train garé devant lui.');}}
  else if(TRAV){const m=backLim(t);t.g=Math.max(m,t.g-MV.v*dt);
    if(t.g<=m+1e-6){t.mv=0;if(m<=G_B+1e-6){t.lane=-1;log(t.name+' est sur le chariot. Positionnez '+DEVL+' sur G pour le remettre sur le circuit.','good');}
      else log(t.name+' arrêté en sortie de voie : '+DEVL+' n\'est pas en place ou le rail de garage est occupé.','warn');}}
  else{const m=backLim(t);t.g=Math.max(m,t.g-MV.v*dt);
    if(t.g<=1e-6){t.g=0;t.mv=0;t.seats.fill(null);
      if(YD.at==='brake'){t.st='run';t.s=S_HOLD;t.v=0;t.inBrake=true;t.hold=1;t.entering=false;log(t.name+' est revenu sur le frein final. Remettez '+DEVL+' sur P pour qu\'il entre en gare.','good');}
      else{t.st='station';t.s=S_ST;t.v=0;t.phase='board';t.pt=0;t.idle=0;t.depReq=false;log(t.name+' est en gare. Remettez '+DEVL+' sur P pour autoriser les départs.','good');}}
    else if(t.g<=m+1e-6){t.mv=0;log(t.name+' arrêté avant '+DEVL+(devOn(t.lane)?' : '+ANCH_NAME+' n\'est pas libre.':' : il n\'est pas en place.'),'warn');}}
}
/* ══════════ COMMANDES DE ZONE (pupitre) : freins Serrer / Relâcher, moteurs Avancer / Reculer / Arrêt, mode AUTO / MANU ══════════ */
function nextBusy(z,t){ // anti-collision : section suivante occupée (refus du relâchement d'un frein qui retient un train)
  if(/^B\d/.test(z)){const i=+z.slice(1)-1;return occupied(BLK[i],blkEnd(i),t)?(i+1<BLK.length?'canton du bloc '+(i+2):'canton du frein final'):'';}
  const ahead=()=>aheadBusy(t)?(PSB?zName('Pre'):'gare'):'';
  if(z==='Fin')return TRAV?(trains.some(o=>o!==t&&(onRail(o)||onCar(o)))?DEVL:''):ahead();
  if(z==='RA')return ahead();
  if(z==='Pre')return stationBusy(t)?'gare':'';
  return '';
}
function zoneCmd(z,c){
  const Z=ZONES.find(o=>o.id===z);if(!Z)return false;const N=Z.name;
  if(z==='Lift'){const off=c==='off';if(off===G.liftOff)return refuse('Lift déjà '+(off?'à l\'arrêt.':'en marche.'));
    G.liftOff=off;log(off?'Lift à l\'arrêt : la chaîne est stoppée, un train sur le lift y reste.':'Lift en marche.',off?'warn':'good');return true;}
  if(c==='m'){if(!Z.auto)return false;const m=!G.zm[z];G.zm[z]=m;G.zk[z]=m&&zT(z).some(t=>t.st==='run'&&t.v===0); // passage en MANU : freins serrés si un train y est arrêté
    log(N+(m?' en MANU : freins'+(Z.drive?' et moteurs':'')+' commandés au pupitre.':' en AUTO : cantonnement automatique.'),m?'warn':'good');return true;}
  if(Z.auto&&!G.zm[z])return refuse(N+' en AUTO : passez la zone en MANU pour la commander.');
  if(c==='k'){
    if(!zK(z)){G.zk[z]=true;for(const t of zT(z))if(t.mv)t.mv=0;log('Freins serrés : '+N+'.','warn');return true;}
    const t=zT(z).find(o=>o.st==='run'&&o.v===0),o=t&&nextBusy(z,t);
    if(o)return refuse(N+' : relâchement refusé, section suivante occupée ('+o+').');
    G.zk[z]=false;log('Freins relâchés : '+N+'.','good');return true;}
  if(!Z.drive||!'fbx'.includes(c))return false;
  if(G.estop)return refuse(N+' : commande refusée, arrêt d\'urgence enclenché.');
  if(c==='f'&&Z.fwd===false)return refuse(N+' : pas de bouton Avancer ; le train entre dans la voie poussé par '+zName(CARR)+' (Avancer).');
  const ts=zT(z);
  // Arrêt : la zone porteuse arrête aussi le train qu'elle pousse dans une voie
  if(c==='x'){let n=0;for(const t of z===CARR?ts.concat(trains.filter(o=>o.st==='garage'&&o.mv>0&&!ts.includes(o))):ts){if(t.mv){t.mv=0;n++;}if(t.fdrive){t.fdrive=0;n++;}if(t.st==='station'&&t.depReq&&t.phase!=='check'){t.depReq=false;t.phase='board';resetOps();n++;}}
    if(!n)return refuse(N+' : aucun mouvement à arrêter.');log('Moteurs arrêtés : '+N+'.');return true;}
  if(zK(z))return refuse(N+' : freins serrés, relâchez-les avant d\'avancer ou de reculer.');
  if(z===CARR&&c===(LREV?'b':'f')&&!ts.some(o=>o.st==='garage'?!o.mv:o.v===0)){ // appareil face à une voie : la zone porteuse reprend la poussée du train arrêté à l'entrée de la voie
    const j=G.dev.pos-1,lt=j>=0&&j<LANES.length&&!devMoving()?trains.filter(o=>o.st==='garage'&&o.lane===j&&!o.mv&&o.g<fwdLim(o)-.05):[];
    if(lt.length)return zK('L'+(j+1))?refuse('Freins de '+zName('L'+(j+1))+' serrés : '+lt[0].name+' ne peut pas y entrer.'):yardFwd(lt[0]);}
  if(!ts.length)return refuse(N+' : aucun train dans la zone.');
  if(LREV&&z==='RB'&&ts.some(o=>o.st==='garage')){ // voies en amont du chariot (yard.rev) : le rail de garage pousse le train dans la voie en marche arrière (AR)
    if(c==='f')return refuse(N+' : le train sur le chariot entre dans une voie en marche arrière (AR).');
    c='f';}
  // voie de garage : un seul moteur, _b = sortir de la voie vers l'appareil (marche avant si yard.rev, arrière sinon)
  if(z[0]==='L'){ // voie de garage : moteurs de la voie (le train de tête d'abord)
    if(c==='b'&&TRAV&&zK('RB'))return refuse('Freins du rail du chariot serrés : aucun train ne sort de '+N+'.');
    let ok=false;for(const t of ts.slice().sort((a,b)=>c==='f'?b.g-a.g:a.g-b.g)){if(c==='f'?t.mv>0:t.mv<0)continue;ok=(c==='f'?yardFwd(t):yardBack(t))||ok;if(ok)break;}
    return ok;}
  if(c==='b')return refuse(N+' : marche arrière impossible'+(z==='RB'?', le train sur le chariot entre dans une voie en marche avant.':' sur le circuit.'));
  const t=ts.find(o=>o.st==='garage'?!o.mv:o.v===0)||ts[0];
  const toLane=()=>{const j=G.dev.pos-1;return j>=0&&j<LANES.length&&!devMoving()&&zK('L'+(j+1))?refuse('Freins de '+zName('L'+(j+1))+' serrés : '+t.name+' ne peut pas y entrer.'):yardFwd(t);};
  const enter=nm=>{if(t.st!=='run'||t.v!==0||t.entering||t.toPre)return false;
    if(G.brakeFault)return refuse('Défaut des freins : '+t.name+' reste '+nm+'.');
    if(PSB&&t.s<=PSB_A){if(preBusy(t))return refuse(zName('Pre')+' occupé : '+t.name+' reste '+nm+'.'); // vers le frein avant gare d'abord
      t.toPre=true;t.hold=0;t.lkTold=false;log(t.name+' avance vers '+zName('Pre').toLowerCase()+'.');return true;}
    if(stationBusy(t))return refuse('Gare occupée : '+t.name+' reste '+nm+'.');
    t.entering=true;t.hold=0;t.lkTold=false;log(t.name+' avance vers la gare.');return true;};
  if(z==='St'){
    if(t.st!=='station')return refuse(t.name+' n\'est pas arrêté à quai.');
    if(YD.at==='station'&&(devMoving()||G.dev.pos))return toLane(); // aiguillage sur une voie : vers le garage
    if(t.phase==='unload')return refuse(t.name+' : débarquement en cours.');
    if(count(t))return refuse(t.name+' a des passagers : départ par le bouton Départ, après validation des lapbars.');
    if(G.gatesOpen)return refuse('Portillons ouverts : fermez-les avant de faire avancer '+t.name+'.');
    if(t.depReq)return false;
    const r=blockReason(t);if(r)return refuse(t.name+' ne peut pas partir : '+r+'.');
    t.depReq=true;log(t.name+' quitte la gare à vide (moteurs de gare).');return true;}
  if(z==='RB')return t.st==='garage'?toLane():enter('sur le rail de garage');
  if(z==='RA'||z==='Pre')return enter('sur '+N);
  if(z==='Fin'){
    if(t.st!=='run'||t.v!==0)return false;
    if(TRAV){
      if(bIn()){if(count(t))return refuse(t.name+' a des passagers : il ne roule jamais sur le rail de garage.');
        if(trains.some(o=>o!==t&&(onRail(o)||onCar(o))))return refuse('Rail de garage occupé : '+t.name+' reste avant '+DEVL+'.');
        t.fdrive=1;t.preTold=false;log(t.name+' avance à vide sur le rail de garage.');return true;}
      if(circIn())return true; // rail A en ligne, freins relâchés : le train repart seul
      return refuse('Aucun rail en ligne avec le circuit : '+t.name+' attend avant '+DEVL+'.');}
    if(YD.at==='brake'&&(devMoving()||G.dev.pos))return toLane();
    return enter('sur le frein final');}
  if(/^B\d/.test(z)){const i=+z.slice(1)-1;if(occupied(BLK[i],blkEnd(i),t))return refuse('Canton suivant occupé : '+t.name+' reste au frein de bloc '+(i+1)+'.');log(t.name+' repart du frein de bloc '+(i+1)+'.');return true;}
  return false;
}
function updateStation(t,dt){
  t.pt-=dt;
  if(t.phase==='unload'){
    if(t.pt<=0){
      const i=t.seats.findIndex(s=>s&&s.on);
      if(i>=0){
        const v=t.seats[i];t.seats[i]=null;t.pt=.12;G.stats.riders++;G.stats.income+=5;G.money+=5;
        let g=v.w<80?.07:v.w<180?.04:.015;if(G.wear.track>75)g*=.4;G.sat=clamp(G.sat+g,0,100);
        seatBase(t,i,_v);walker(exitPath(alightWalk(Math.floor(i/CSEATS),_v.x,_v.z)),v.ci,null,2.8,0,'alight'); // descente côté sortie, à l'opposé des portillons, par le quai et la porte
      }else if(count(t)===0){t.phase='board';t.idle=0;}
    }
  }else if(t.phase==='board'){
    const n=count(t),waiting=G.plat.some((r,i)=>r&&!t.seats[i]),shut=!G.gatesOpen&&G.gate<.05&&seated(t)===n;
    if(G.auto&&!t.depReq){t.idle+=dt;
      if((n>0&&seated(t)===n&&(n===SEATS||(!waiting&&t.idle>(G.open?(G.queue.length?45:12):4))))||(t.idle>5&&!G.queue.length&&!waiting&&trains.some(held))||(t.hs&&n===0&&t.idle>2))t.depReq=true;} // un train hors service repart à vide
    if(G.auto&&t.depReq&&G.gatesOpen&&!t.gTold){t.gTold=true;log(t.name+' est prêt au départ : fermez les portillons (bouton du pupitre) pour lancer la vérification des lapbars.','warn');}
    // portillons fermés (seulement par le joueur) : en auto après l'ordre de départ, en manuel dès qu'il y a des passagers, les opérateurs vérifient les lapbars
    if(shut&&(G.auto?t.depReq:n>0||t.depReq)){if(n===0||G.bypass)t.phase='ready';else startCheck(t);}
  }else if(t.phase==='check'){
    if(G.gatesOpen){t.phase='board';resetOps();return;}
    if(G.bypass){resetOps();t.phase='ready';return;}
    if(OPS.every(o=>o.ok)){
      if(Math.random()<Math.max(0,(t.wear-55)/45)*.3){t.fault='lapbars';t.phase='fault';resetOps();sfx.alarm();log('Défaut de lapbar détecté par un opérateur sur '+t.name+' : réarmement nécessaire.','warn');}
      else{t.phase='ready';if(!G.auto)log('Lapbars validés par les deux opérateurs : départ possible.','good');}
    }
  }else if(t.phase==='ready'){
    if(G.gatesOpen){t.phase='board';t.depReq=false;resetOps();return;}
    if((G.auto||t.depReq)&&!blockReason(t)){
      const n=count(t),checked=OPS.every(o=>o.ok);
      t.st='run';t.v=.5;t.depReq=false;t.inLift=false;t.inBrake=false;t.screamed=false;t.blk=false;t.told=false;G.stats.disp++;sfx.bell();resetOps();
      if(G.wx.type==='storm'&&n>0){pay(400,true);G.sat=clamp(G.sat-3,0,100);log('Infraction : train envoyé en plein orage ! Amende de 400 €.','bad');}
      else log(t.name+' part avec '+n+' passager'+(n>1?'s':'')+(n>0&&!checked?' — lapbars non vérifiés (by-pass).':'.'));
      if(n>0&&!checked&&Math.random()<.08+Math.max(0,(t.wear-55)/45)*.3){pay(600,true);G.sat=clamp(G.sat-6,0,100);sfx.alarm();log('Incident : un lapbar était mal verrouillé au départ. Amende de 600 €.','bad');}
    }
  }
}
function updateRun(t,dt){
  const z=zoneOf(t.s);
  if(z==='station'){t.v=Math.min(6,Math.sqrt(4*Math.max(0,S_ST-t.s))+.3);t.s+=t.v*dt;if(t.s>=S_ST-.05)arrive(t);return;}
  if(z==='prelift')t.v=Math.min(5,t.v+1.5*dt);
  else if(z==='lift'){
    if(!t.inLift){t.inLift=true;G.wear.chain=Math.min(100,G.wear.chain+2.2);
      const c=G.wear.chain;t.failAt=Math.random()<(c>40?Math.pow((c-40)/60,2)*.35:0)?rnd(S_LIFT0+8,S_LIFT1-6):-1;}
    if(t.failAt>0&&t.s>=t.failAt){t.failAt=-1;G.liftBroken=true;sfx.alarm();log('🚨 Panne du lift ! '+t.name+' est bloqué dans la montée.','bad');}
    t.wait=BLK.length>0&&t.s>S_LIFT1-4&&occupied(S_REL-TLEN,BLK[0],t); // le lift retient le train tant que le premier canton est occupé
    t.v=(G.liftBroken||G.estop||t.wait||G.liftOff)?0:Math.min(5.5,Math.max(t.v,2)+3*dt);
  }else if(z==='course'){
    const a=-9.81*(hAt(t.s)-hAt(t.s-TLEN))/TLEN-(PH.roll+t.wear*.0003)-PH.drag*t.v*t.v;
    let bi=-1;for(let i=0;i<BLK.length;i++)if(BLK[i]>t.s-.2){bi=i;break;}
    const man=bi>=0&&zK('B'+(bi+1)); // frein de bloc serré au pupitre (zone en MANU) : arrêt même si le canton suivant est libre
    if(bi>=0&&(man||occupied(BLK[bi],blkEnd(bi),t))){const d=BLK[bi]-t.s;t.v=Math.min(Math.max(PH.vmin,t.v+a*dt),Math.sqrt(12*Math.max(0,d)));
      if(d<.2){t.v=0;t.blk=true;if(man&&t.bkTold!==bi){t.bkTold=bi;log(t.name+' arrêté au frein de bloc '+(bi+1)+' (serré au pupitre).','warn');}}} // arrêt au frein de bloc
    else{t.v=Math.max(PH.vmin,t.v+a*dt);t.blk=false;t.bkTold=-1;}
    if(!t.screamed&&t.s>S_DROP){t.screamed=true;const n=count(t);if(n)sfx.scream(n);}
  }else{
    if(!t.inBrake){
      t.inBrake=true;t.hold=0;sfx.brake();t.wear=Math.min(100,t.wear+3.5);G.wear.track=Math.min(100,G.wear.track+1.1);G.wear.brake=Math.min(100,G.wear.brake+1.6);
      const b=G.wear.brake;
      if(!G.brakeFault&&b>50&&Math.random()<Math.pow((b-50)/50,2)*.3){G.brakeFault=true;sfx.alarm();log('🚨 Défaut des freins de fin de parcours : train retenu.','bad');}
      if(G.wear.track>=100)log('⛔ Voie hors service : la commission de sécurité interdit les départs.','bad');
    }
    // pont droit : arrêt avant le chariot si le frein final est serré ou si aucun rail du circuit n'est en ligne (sauf conduite à vide vers le rail B)
    const FL=zK('Fin'),onB=TRAV&&t.s>R0+.5&&bIn(),raFull=RA&&trains.some(o=>o!==t&&onRaSt(o)),pre=TRAV&&t.s<S_PRE+.3&&(FL||raFull||!(circIn()||(bIn()&&t.fdrive)));
    const slow=t.v>6?Math.max(6,t.v-7*dt):TRAV&&!pre&&t.v<1.5?Math.min(1.5,t.v+1.5*dt):t.v; // pneus du frein final (pont droit)
    if(t.entering)t.v=Math.min(6,t.v+2*dt);
    else if(PSB&&(t.toPre||t.s>S_HOLD+.5)){ // frein avant gare (zone de stockage Pre) : pneus jusqu'au point d'arrêt, attente de la gare libre
      const PL=zK('Pre'),vm=Math.sqrt(8*Math.max(0,S_PSB-t.s));t.v=Math.min(t.v>4?Math.max(4,t.v-7*dt):Math.min(4,t.v+2*dt),vm);
      if(vm<.25){t.v=0;t.toPre=false;t.hold+=dt;
        if(PL&&!t.psTold){t.psTold=true;log(t.name+' arrêté sur '+zName('Pre').toLowerCase()+' (serré au pupitre).','warn');}
        if(t.hold>=1&&!PL&&!stationBusy(t)&&!G.estop&&!G.brakeFault){t.entering=true;t.hold=0;t.psTold=false;}}}
    else if(pre){t.v=Math.min(slow,Math.sqrt(8*Math.max(0,S_PRE-t.s)));
      if(t.v<.25){t.v=0;if(!t.preTold){t.preTold=true;log(t.name+' attend avant '+DEVL+' : '+(FL?'frein final serré au pupitre.':raFull?zName('RA')+' occupé : '+t.name+' attend au frein final (stockage).':bIn()?'rail de garage en ligne ; à vide, Avancer (frein final en MANU) l\'y conduit.':'aucun rail du circuit en ligne.'),'warn');}}}
    else{const vm=Math.sqrt(8*Math.max(0,S_HOLD-t.s));t.v=Math.min(slow,vm);t.preTold=false;
      if(vm<.25){t.v=0;t.hold+=dt;t.fdrive=0;const lock=TRAV?onB||zK('RA'):FL;
        if(lock&&!t.lkTold){t.lkTold=true;log(onB?t.name+' est arrêté sur le rail de garage : '+DEVL+' sur une voie libre (il l\'emporte) puis '+(LREV?'Reculer':'Avancer')+' (rail B), ou Avancer (rail B) vers la gare.'
          :t.name+' arrêté '+(TRAV?'sur '+zName('RA'):'au frein final')+' (serré au pupitre).','warn');}
        if(t.hold>=1&&!lock&&!aheadBusy(t)&&!G.estop&&!G.brakeFault&&!(YD.at==='brake'&&(TRAV?!circIn():devOff()||trains.some(yardBusy)))){if(PSB)t.toPre=true;else t.entering=true;t.hold=0;t.lkTold=false;}}}
  }
  t.s+=t.v*dt;if(t.s>=L)t.s-=L;
}
// Quai et portillons : les visiteurs se rangent par travée, puis embarquent quand les portillons s'ouvrent
function updatePlatform(dt){
  G.platT-=dt;const fr=SEG_OUT.list[0];
  if(G.platT<=0&&fr&&fr.r<.4&&G.time<1140){
    let best=[],bo=CSEATS;for(let k=0;k<NCARS;k++){let o=0;for(let r=0;r<CSEATS;r++)if(G.plat[k*CSEATS+r])o++;if(o<bo){bo=o;best=[k];}else if(o===bo&&o<CSEATS)best.push(k);}
    const kb=best.length?best[Math.floor(Math.random()*best.length)]:-1;let i=-1;if(kb>=0)for(let r=0;r<CSEATS;r++)if(!G.plat[kb*CSEATS+r]){i=kb*CSEATS+r;break;}
    if(i>=0){removeVisitor(fr);const r={ci:fr.ci,w:fr.w,on:false,ph:fr.ph};G.plat[i]=r;G.platT=.22;const p=slotPos(i);
      const b=BAYS[Math.floor(i/CSEATS)],W=SITE.board.walk,j=rnd(-.2,.2);walker([[fr.x,0,fr.z]].concat(SITE.board.via.map(q=>[q[0],0,q[1]]),[[b.x+b.rx*W+b.tx*j,0,b.z+b.rz*W+b.tz*j],p]),fr.ci,()=>{r.on=true;},4.2,0,'wait');}
  }
  const t=trains.find(o=>o.st==='station'&&o.phase==='board'&&!o.hs&&!o.depReq); // portillons : ouverts et fermés seulement au pupitre
  G.gate=clamp(G.gate+(G.gatesOpen||G.walkers.some(k=>k.kind==='board')?dt:-dt)/.7,0,1); // un portillon ne se referme pas sur un visiteur qui le franchit
  if(t&&G.gate>.9)for(let i=0;i<SEATS;i++){const r=G.plat[i];
    if(r&&r.on&&!t.seats[i]){G.plat[i]=null;const seat={ci:r.ci,w:r.w,on:false};t.seats[i]=seat;t.idle=0;seatBase(t,i,_v);walker([slotPos(i),[_v.x,0,_v.z]],r.ci,()=>{seat.on=true;},2.2,0,'board');}}
}
function updateTrains(dt){
  for(const t of trains){
    if(t.st==='station')updateStation(t,dt);
    else if(t.st==='run')updateRun(t,dt);
    else if(t.st==='garage')updateYard(t,dt);
    if(t.st==='run'&&t.v===0&&((G.liftBroken&&zoneOf(t.s)==='lift')||(G.brakeFault&&zoneOf(t.s)==='brake')))G.sat=clamp(G.sat-.002*count(t)*dt,0,100);
  }
  // l'appareil ne bouge que sur commande de l'opérateur ; l'arrêt d'urgence le fige
  if(raMoving()&&!G.estop){G.ra.k+=dt/(G.ra.d||MV.t);if(G.ra.k>=1){G.ra.k=1;G.ra.pos=G.ra.to;log(RAN+(G.ra.pos?' retiré.':' en place sur le circuit.'));}}
  if(devMoving()&&!G.estop){G.dev.k+=dt/(G.dev.d||MV.t);if(G.dev.k>=1){G.dev.k=1;G.dev.pos=G.dev.to;log(DEVN+' en place sur '+posName(G.dev.pos)+'.');
    const c=G.dev.pos===PG&&trains.find(o=>onCar(o)); // pont droit sur G : le train porté retrouve le circuit, sur le frein final
    if(c){c.st='run';c.s=S_HOLD;c.v=0;c.inBrake=true;c.hold=1;c.entering=false;c.fdrive=0;c.told=false;c.lane=0;c.g=0;log(c.name+' est sur le rail de garage en ligne : Avancer (rail B) l\'envoie en gare dès qu\'elle est libre. '+(RA?'Écartez ensuite '+DEVL+' vers une voie, puis remettez '+RAN+' sur le circuit.':'Remettez ensuite '+DEVL+' sur P.'),'good');}}}
}

/* ══════════ MÉTÉO ET JOURNÉE ══════════ */
function updateWeather(dt){
  const w=G.wx;
  if(w.type==='clear'){w.next-=dt;
    if(w.next<=0&&G.time<1040){
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
function step(dt){
  G.time=Math.min(1140,G.time+dt*.5);
  updateWeather(dt);updateVisitors(dt);updatePlatform(dt);stepOps(dt);updateTrains(dt);
  if(G.job){G.job.rem-=dt;if(G.job.rem<=0)finishJob();}
  if(G.time>=1080&&!G.closedMsg){G.closedMsg=true;G.open=false;log('🔔 18:00 — le parc ferme, la file est fermée. Terminez les derniers tours.','warn');}
  if(G.time>=1080){
    const riders=trains.reduce((n,t)=>n+count(t),0)+G.plat.filter(r=>r).length;
    if((G.queue.length===0&&riders===0)||G.time>=1140)endDay();
  }
}
function endDay(){
  if(G.dayDone)return;G.dayDone=true;clearQueue();G.plat.fill(null);pay(350);
  const s=G.stats,net=s.income-s.costs;
  $('dTitle').textContent='Fin du jour '+G.day;
  $('dTable').innerHTML=[['Passagers transportés',s.riders],['Trains envoyés',s.disp],['Visiteurs repartis mécontents',s.quits],['Visiteurs refoulés (file pleine)',s.turned],
    ['Recettes',s.income+' €'],['Dépenses (dont salaires 350 €)',s.costs+' €'],['dont amendes',s.fines+' €'],
    ['Résultat du jour',(net>=0?'+':'')+net+' €'],['Budget',Math.round(G.money)+' €'],['Satisfaction',Math.round(G.sat)+' %']]
    .map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>').join('');
  G.over=G.money<-2000;
  $('dMsg').textContent=G.over?'Le budget est dans le rouge : la direction vous retire les clés de l\'attraction…'
    :s.riders>=(SITE.goal||400)?((SITE.text&&SITE.text.great)||'Excellente journée !'):s.riders>=(SITE.goal||400)/2?'Journée correcte. Un second train et moins de pannes feraient mieux.'
    :'Journée difficile. Pensez à ouvrir tôt et à sortir le second train.';
  $('dBtn').textContent=G.over?'Recommencer':'Jour suivant';
  $('mDay').classList.remove('hidden');
}
function nextDay(){
  if(G.over){location.reload();return;}
  G.day++;G.time=600;G.stats=newStats();G.dayDone=false;G.closedMsg=false;G.open=false;
  G.wx={type:'clear',t:0,next:rnd(240,480)};G.walkers.length=0;
  for(const t of trains)t.seats.fill(null);G.plat.fill(null);
  $('mDay').classList.add('hidden');
  log('☀️ Jour '+G.day+' — l\'attraction est fermée, à vous d\'ouvrir.','good');
}

/* ══════════ ACTIONS ET INTERFACE ══════════ */
function act(a,arg){
  const t=arg!==undefined&&trains[arg];
  if(a==='speed')G.speed=+arg;
  else if(a==='help')$('mHelp').classList.remove('hidden');
  else if(a==='closeHelp'){$('mHelp').classList.add('hidden');sfx.init();}
  else if(a==='mute')$('bMute').textContent=sfx.toggle()?'Son coupé':'Son';
  else if(a==='cam')setCam(arg);
  else if(a==='fs')setFs(!fsOn);
  else if(a==='fsdesk')document.body.classList.toggle('fsdesk');
  else if(a==='tab')setTab(arg);
  else if(a==='nextDay')nextDay();
  else if(a==='open'){if(!G.open&&G.time>=1080)return;G.open=!G.open;
    log(G.open?'Entrée ouverte : les visiteurs entrent dans la file.':'Entrée fermée : plus personne n\'entre. Les '+G.queue.filter(v=>v.mode==='q').length+' visiteurs déjà dans la file continuent d\'embarquer.',G.open?'good':'warn');}
  else if(a==='evac'){const n=G.queue.length;if(!n)return;
    for(const v of G.queue)walker(backPath(v,true),v.ci,null,rnd(3,3.8),0,'evac');
    clearQueue();G.sat=clamp(G.sat-Math.min(8,n*.03),0,100);log('File évacuée : '+n+' visiteurs ressortent par l\'entrée.','warn');}
  else if(a==='loop'){const l=LOOPS[arg];l.on=!l.on;buildQueue();
    log(l.name[0].toUpperCase()+l.name.slice(1)+(l.on?' fermé : les visiteurs sont dirigés vers la boucle':' ouvert : les visiteurs sont dirigés vers le raccourci')+' — capacité '+Math.floor(QLEN/SP)+' visiteurs. Ceux déjà engagés terminent leur chemin.');}
  else if(a==='syn')toggleSyn();
  else if(a==='roof'){G.roofOff=!G.roofOff;}
  else if(a==='auto'){G.auto=!G.auto;log('Départs en mode '+(G.auto?'automatique.':'manuel.'));}
  else if(a==='gates'){ // portillons : seulement sur ordre du pupitre, en auto comme en manuel
    if(G.gatesOpen){G.gatesOpen=false;log('Portillons fermés.');}
    else{const s=trains.find(o=>o.st==='station'&&['board','check','ready'].includes(o.phase)&&!o.hs);
      if(s){s.phase='board';s.depReq=false;resetOps();G.gatesOpen=true;log('Portillons ouverts : embarquement.');}
      else refuse('Portillons : aucun train à quai prêt à embarquer.');}}
  else if(a==='bypass'){G.bypass=!G.bypass;log(G.bypass?'BY-PASS de la validation des lapbars activé : départ possible sans vérification.':'Validation des lapbars par les opérateurs rétablie.',G.bypass?'bad':'good');}
  else if(a==='depart'){
    const s=G.auto?trains.find(o=>o.st==='station'&&o.phase==='board'&&!o.depReq):trains.find(o=>o.st==='station'&&!o.depReq&&(o.phase==='ready'||(o.phase==='board'&&!G.gatesOpen&&(G.bypass||count(o)===0))));
    if(s)s.depReq=true;else if(!G.auto)log('Départ refusé : il faut les portillons fermés et les lapbars validés par les deux opérateurs.','warn');}
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
      +(Z.drive?(Z.fwd===false?E:zb(z,'f','green','AV',z===CARR?'Moteurs de la zone : avancer le train qui s\'y trouve (appareil face à une voie : le pousse dans la voie)':'Moteurs de la zone : avancer le train qui s\'y trouve'))+(Z.sec==='gar'?zb(z,'b','green',LREV?'AV':'AR','Moteurs de la voie : sortir le train de la voie vers '+DEVL+(LREV?' (marche avant)':' (marche arrière)')):zb(z,'b','green','AR',z===CARR&&LREV?'Moteurs de la zone : reculer (appareil face à une voie : pousse le train dans la voie, en marche arrière)':'Moteurs de la zone : reculer le train qui s\'y trouve'))+zb(z,'x','amber','STOP','Moteurs de la zone : arrêt'):E+E+E)+'</div>';};
  const sec=(t,k,x,h=1)=>`<div class="dsec"><span>${t}</span>${x||''}</div>`+(h?head:'')+ZONES.filter(Z=>Z.sec===k).map(row).join('');
  $('deskZones').innerHTML=sec('Gare','st')+sec('Lift','lift','',0)
    +sec('Zones de freinage','brk','<button class="pb sq sm blue" id="zAuto" data-act="zauto" title="Toutes les zones de freinage en AUTO">TOUT AUTO</button>')
    +`<div class="dsec"><span>Garage</span></div><div class="deskrow"><div class="ctl" style="flex:2"><div class="pair" id="yPos"></div><div class="plate"><span id="yName"></span><br><span id="yState"></span></div></div></div>`
    +head+ZONES.filter(Z=>Z.sec==='gar').map(row).join('');}
$('yPos').innerHTML=POS_ORDER.map(p=>`<button class="pb sq sm blue" id="y${posId(p)}" data-act="pos" data-arg="${p}" title="${DEVN} : ${p===PG?'position G, rail de garage sur le circuit':p?'position voie '+p+' ('+LANES[p-1].name+')':'position P, circuit'}">${posId(p)}</button>`).join('');
$('yName').textContent=DEVN;
if(RA)$('yPos').parentElement.insertAdjacentHTML('beforebegin','<div class="ctl"><div class="pair">'+[0,1].map(p=>`<button class="pb sq sm blue" id="yA${p}" data-act="ra" data-arg="${p}" title="${RAN} (rail du circuit) : ${p?'retiré vers l\'extérieur':'sur le circuit'}">${p?'E':'C'}</button>`).join('')+'</div><div class="plate">'+RAS+'<br><span id="yAState"></span></div></div>');
