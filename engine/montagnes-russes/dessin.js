'use strict';
// Tunnels du circuit : OSM.tunnels=[[s0,s1(,'roof')],…] (tronçons tagués tunnel=yes, ou covered=yes et layer<0 ; 'roof' = galerie au-dessus du sol, layer>0), puis tunnels ESTIMÉS
// de SITE.tunnels:[{s:[s0,s1],…}] (s du moteur). Couverture : eau si le tunnel passe sous un plan d'eau OSM (détection automatique), toit de béton ('roof'), sinon remblai enherbé.
// SITE.tunnels[k]={under:'water'|'ground'|'roof',w:demi-largeur} (k = rang du tunnel OSM) force le choix. Polygone man_made=tunnel : prime sur la voie (TLIST), couverture = polygone.
// Deux portails (tête en béton, ouverture sombre, rampe à murs) aux extrémités. Profondeur ESTIMÉE (profil de la spec). « Toits retirés » : la couverture devient translucide.
const TUN=(function(){
  const pip=(poly,x,z)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>z)!==(poly[j][1]>z)&&x<(poly[j][0]-poly[i][0])*(z-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])c=!c;return c;};
  const fr=i=>{const f=TR[((i%N)+N)%N],g=TR[(((i+1)%N)+N)%N],l=Math.hypot(f.R.x,f.R.z)||1,tl=Math.hypot(g.p.x-f.p.x,g.p.z-f.p.z)||1;return {x:f.p.x,z:f.p.z,nx:f.R.x/l,nz:f.R.z/l,tx:(g.p.x-f.p.x)/tl,tz:(g.p.z-f.p.z)/tl};};
  // SITE.tunnels : réglages des tunnels OSM dans l'ordre, puis tunnels ESTIMÉS absents d'OSM ({s:[s0,s1], under, w}), puis polygones man_made=tunnel ({poly}) : TLIST
  return TLIST.map(({r,cf,poly,nm})=>{ // rockExt : tunnel prolongé jusqu'aux bords du rocher
    const i0=Math.round(r[0]/DS),i1=Math.round(r[1]/DS),w=cf.w||2.1,m=fr(Math.round((i0+i1)/2));
    const e0=fr(i0),e1=fr(i1),under=cf.under||(ROCKP.some(P=>pipXZ(P,m.x,m.z))?'rock':0)||r[2]||([m,e0,e1].some(c=>WATERPTS.some(q=>pip(q,c.x,c.z)))?'water':cf.dflt||'ground'); // polygone man_made=tunnel : galerie 'roof' par défaut, hors eau et rocher // r[2]='roof' : galerie couverte au-dessus du sol (OSM layer>0) // sous l'eau si le milieu ou une extrémité est dans un plan d'eau OSM
    const band=(a,b,hw)=>{const P=new Path2D,L1=[],R1=[];for(let i=a;i<=b;i++){const f=fr(i);L1.push([f.x+f.nx*hw,f.z+f.nz*hw]);R1.push([f.x-f.nx*hw,f.z-f.nz*hw]);}
      L1.forEach((q,i)=>i?P.lineTo(q[0],q[1]):P.moveTo(q[0],q[1]));R1.reverse().forEach(q=>P.lineTo(q[0],q[1]));P.closePath();return P;};
    const walls=new Path2D,heads=new Path2D,mouth=[],RAMP=Math.round(6/DS);
    for(const sg of [-1,1]){ // sg=-1 : portail d'entrée (début), +1 : portail de sortie
      if(nm&&nm[sg<0?0:1])continue; // bout accolé à un polygone man_made=tunnel : le portail est celui du polygone
      const ie=sg<0?i0:i1,f=fr(ie),ox=f.tx*sg,oz=f.tz*sg; // ox,oz : vers l'extérieur du tunnel
      for(const e of [-1,1]){walls.moveTo(f.x+f.nx*w*e,f.z+f.nz*w*e);for(let k=0;k<=RAMP;k++){const g=fr(ie+sg*k);walls.lineTo(g.x+g.nx*(w+k*DS*.05)*e,g.z+g.nz*(w+k*DS*.05)*e);}}
      const hw=w+.45,c=[f.x-ox*.4,f.z-oz*.4]; // tête : dalle de béton de 0,8 m, moitié dedans
      heads.moveTo(c[0]+f.nx*hw+f.tx*.4,c[1]+f.nz*hw+f.tz*.4);heads.lineTo(c[0]-f.nx*hw+f.tx*.4,c[1]-f.nz*hw+f.tz*.4);heads.lineTo(c[0]-f.nx*hw-f.tx*.4,c[1]-f.nz*hw-f.tz*.4);heads.lineTo(c[0]+f.nx*hw-f.tx*.4,c[1]+f.nz*hw-f.tz*.4);heads.closePath();
      mouth.push({x:f.x,z:f.z,ox,oz,nx:f.nx,nz:f.nz});}
    const hs=[];for(let i=i0-2;i<=i1+2;i++)hs.push(chunkH[((i%N)+N)%N]);
    const ridge=new Path2D;for(let i=i0;i<=i1;i++){const f=fr(i);i>i0?ridge.lineTo(f.x,f.z):ridge.moveTo(f.x,f.z);}
    const P=poly&&mkPath(poly,true); // polygone man_made=tunnel : emprise et couverture du tunnel
    return {a:r[0],b:r[1],under,w,poly:!!P,cover:P||band(i0,i1,w+.3),core:P||band(i0,i1,w-.2),walls,heads,mouth,ridge,h:Math.max(...hs)+.01};
  });
})();
const inTun=s=>{for(const t of TUN)if(s>=t.a-CAR/2&&s<=t.b+CAR/2)return true;return false;};
function drawTunnel(t){
  const ra=G.roofOff||G.hideSt?roofA:1,wa=t.under==='water';
  ctx.save();
  if(wa){ctx.globalAlpha=.42+.5*ra;ctx.fillStyle=TEX.water;ctx.fill(t.cover);ctx.globalAlpha=ra*.5;ctx.strokeStyle='rgba(190,215,225,.55)';lw(.12,.5);ctx.stroke(t.cover);} // dalle de couverture sous l'eau
  else if(t.under==='roof'){ctx.globalAlpha=.25+.75*ra;ctx.fillStyle='#77746c';ctx.fill(t.cover);ctx.fillStyle=TEX.rows;ctx.globalAlpha*=.3;ctx.fill(t.cover);ctx.globalAlpha=.25+.75*ra; // galerie couverte : toit de béton sombre, faîtage
    ctx.strokeStyle='rgba(20,20,18,.5)';lw(.12,.6);ctx.stroke(t.cover);ctx.strokeStyle='rgba(255,255,255,.18)';lw(.15,.5);ctx.stroke(t.ridge);}
  else if(t.under==='rock'){} // sous un rocher OSM : couverture = le rocher lui-même (drawRock), seuls les portails sont dessinés ici
  else{ctx.globalAlpha=.3+.7*ra;ctx.fillStyle=TEX.dirt;ctx.fill(t.cover);ctx.fillStyle=TEX.lawn;ctx.fill(t.core);ctx.fillStyle='rgba(20,40,16,.18)';ctx.fill(t.core);if(t.poly){ctx.strokeStyle=TEX.dirt;lw(.6,1);ctx.stroke(t.cover);}} // polygone : remblai enherbé bordé de terre
  ctx.globalAlpha=1;
  if(t.under!=='rock'){ctx.strokeStyle='rgba(30,30,28,.35)';lw(.5,1);ctx.translate(.18,.14);ctx.stroke(t.walls);ctx.translate(-.18,-.14); // murs de la rampe (pas sous un rocher : voie en hauteur) et têtes de portail
  ctx.strokeStyle=TEX.stone;lw(.34,.8);ctx.stroke(t.walls);ctx.fillStyle=TEX.stone;ctx.fill(t.heads);ctx.strokeStyle='#8a867a';lw(.1,.6);ctx.stroke(t.heads);}
  else{ctx.fillStyle='rgba(52,46,38,.92)';ctx.fill(t.heads);} // sous un rocher (propriétaire, 2026-11-16, lot 4) : portail sobre et sombre, taillé dans la roche (pas de dalle claire)
  for(const m of t.mouth){const x0=m.x,z0=m.z,x1=m.x+m.ox*2.4,z1=m.z+m.oz*2.4,g=ctx.createLinearGradient(x0,z0,x1,z1); // ombre de l'ouverture sur la rampe
    g.addColorStop(0,'rgba(8,9,12,.9)');g.addColorStop(1,'rgba(8,9,12,0)');ctx.fillStyle=g;const hw=t.w-.15;
    ctx.beginPath();ctx.moveTo(x0+m.nx*hw,z0+m.nz*hw);ctx.lineTo(x1+m.nx*hw,z1+m.nz*hw);ctx.lineTo(x1-m.nx*hw,z1-m.nz*hw);ctx.lineTo(x0-m.nx*hw,z0-m.nz*hw);ctx.closePath();ctx.fill();}
  ctx.restore();
}
const _cf=mkF();
const CW=SITE.car.w||1.24,INL=!!SITE.car.inline;
/* ══ Passerelles de service et escaliers d'évacuation (propriétaire, issue #7, générique) ══
   Le long du lift (S_LIFT0 → S_LIFT1) et de chaque zone de freinage SURÉLEVÉE (toutes, B1…Bm) : caillebotis + garde-corps extérieur,
   à la hauteur de la voie, dessinés juste sous leur tronçon (même ordre de profondeur). Rien là où la voie est au sol (moins de EL m au-dessus de la gare) ni en tunnel.
   Lift : la passerelle est elle-même l'escalier (marches tous les 20 cm de montée), prolongée en descendant depuis lift0 jusqu'au sol (pied, 20 m au plus ; sinon tour
   d'escalier au pied), paliers de repos tous les 6 m de montée (intermédiaires), palier au sommet. Frein surélevé : tour d'escalier (volées alternées de 2 m de montée,
   vue du dessus : les deux dernières) à une extrémité ; frein collé au sommet du lift : même passerelle que le lift, pas de tour.
   Côté : SITE.catwalks.side[<zone>] (1 = droite du sens de marche, −1 = gauche), sinon le plus dégagé (ni quai / gare, ni autre voie, ni file).
   Zone de freinage AU SOL (hors gare) : passerelle au niveau de la voie, sans tour, sur le plus long tronçon libre (ni quai, ni gare,
   ni file, ni autre voie), 3 m au moins (issue #7, complément) ; SITE.catwalks.ground:false pour s'en passer.
   SITE.catwalks=false : aucune passerelle (Zeus). Largeur W = 0,8 m, écart à la voie, paliers, tours : ESTIMÉS (aucun relevé). Ouvrages OSM (passerelle, escalier)
   déjà le long d'une zone : utilisés à la place (la zone n'est pas doublée). Itinéraire : décor seulement (pas encore suivi par les techniciens ni par une évacuation de train). */
const CATW=(function(){
  const C=SITE.catwalks;if(C===false)return {walks:[],towers:[]};
  const cf=C||{},W=cf.w||.8,EL=cf.minH!=null?cf.minH:.8,FS=cf.side||{},walks=[],towers=[];
  /* Coaster inversé (issue #20, propriétaire : « la passerelle en galvanisé est à remplacer par un sol en galvanisé sur toute la largeur ») : au lieu d'une passerelle
     latérale, plancher en caillebotis galvanisé SOUS la voie et le train suspendu, centré sur l'axe, garde-corps des deux côtés ; lift : marches sur toute la largeur.
     Largeur FW = largeur du wagon + 2 × 0,3 m (SITE.catwalks.floorW pour la forcer), hauteur = voie − HANG (3 m sous le rail) : ESTIMÉES. Escaliers d'évacuation
     (tours) inchangés, posés au-delà du bord du plancher. SITE.catwalks.floor:false : passerelle latérale comme les autres kinds. */
  const FL=INV&&cf.floor!==false,FW=cf.floorW||CW+.6,HANG=3,WW=FL?FW:W;
  const fr=i=>{i=((i%N)+N)%N;const f=TR[i],g=TR[(i+1)%N],l=Math.hypot(f.R.x,f.R.z)||1,tl=Math.hypot(g.p.x-f.p.x,g.p.z-f.p.z)||1;return {i,s:i*DS,x:f.p.x,y:f.p.y,z:f.p.z,nx:f.R.x/l,nz:f.R.z/l,tx:(g.p.x-f.p.x)/tl,tz:(g.p.z-f.p.z)/tl};};
  const half=s=>(BOB?DECKW/2*TRF(s):INV?Math.max(DECKW/2,CW/2):STL?.75:DECKW/2)+.15; // bord de la voie (ou du train suspendu) + 15 cm
  const el=f=>f.y-ST_Y,ii=s=>Math.round(s/DS);
  const OSMW=OSM.feats.filter(f=>(f.br||f.k==='highway=steps')&&!f.c).map(f=>f.p).concat(STAIRS.filter(o=>!(o.qs&&o.qs.length)).map(o=>o.p));
  // pénalité d'un point posé à (x,z), hauteur y, s = abscisse de la zone (autres voies, file, gare)
  const pen=(x,z,y,s,r,pit)=>{let p=0;for(let j=0;j<N;j+=2){const q=TR[j].p,ds=Math.abs(((j*DS-s)%L+L*1.5)%L-L/2);if(ds<14)continue;const d=Math.hypot(q.x-x,q.z-z);if(d<half(j*DS)+r)p+=Math.abs(q.y-y)<7?3:.4;}
    for(const q of QWS)if(Math.abs(q.x-x)+Math.abs(q.z-z)<q.w/2+r+1&&Math.hypot(q.x-x,q.z-z)<q.w/2+r)p+=3;
    if(STSP.length>2&&pipXZ(STSP,x,z))p+=5;if(inSweep(x,z,r,pit))p+=5;return p;};
  /* Appareil de voie (issue lot 14, 2026-11-17) : aucune passerelle sur le tronçon porté par l'appareil mobile (rail A / rail B d'un pont droit, tronçon mobile
     d'un aiguillage ou d'une table, SW_A → SW_B) — une passerelle fixe ne suivrait pas le rail qui glisse, et le personnel n'est pas posé sur un chariot ;
     aucune passerelle au sol dans l'espace balayé (fosse et dalle du pont droit, couloir de coulissement de l'aiguillage). La zone garde le plus long tronçon fixe. */
  const DA=SW_A-.6,DB=SW_B+.6,onDev=s=>(((s-DA)%L)+L)%L<=DB-DA; // espace balayé : SWP / inSweep (plus haut, partagés avec les poteaux)
  const at=(f,sd,d)=>[f.x+f.nx*sd*d,f.z+f.nz*sd*d],md=s=>FL?0:half(s)+W/2,ed=s=>FL?FW/2:half(s)+W; // axe et bord extérieur du plancher / de la passerelle
  const zones=[{id:'Lift',a:S_LIFT0,b:S_LIFT1,lift:1}].concat(BLK.map((b,i)=>({id:'B'+(i+1),a:Math.min(BZ0[i],b-TLEN),b:b+.5})),
    TAG.brk!=null?[{id:ZF,a:S_BRK,b:S_HOLD+.5}]:[],PSB?[{id:ZP,a:Math.min(PSB_A,S_PSB-TLEN),b:S_PSB+.5}]:[]);
  const lift=zones[0];
  for(const zn of zones){if(cf.skip&&(cf.skip.includes(zn.id)||cf.skip.includes(Z_ANC[zn.id])))continue;
    let i0=ii(zn.a),i1=ii(zn.b);
    if(zn.lift){let k=0;while(k<40&&el(fr(i0))>.2&&!inTunS((i0-1)*DS)){i0--;k++;}zn.foot=el(fr(i0))>.2;} // pied du lift : la passerelle-escalier descend jusqu'au sol
    else if(zn.a<=lift.b+4&&zn.a>=lift.b-2&&lift.w){lift.w.i1=Math.max(lift.w.i1,i1);continue;} // frein collé au sommet du lift : même passerelle
    if(!zn.lift){let run=null,cur=null;for(let i=i0;i<=i1;i++){if(onDev(fr(i).s)){cur=null;continue;}if(cur)cur.i1=i;else cur={i0:i,i1:i};if(!run||cur.i1-cur.i0>run.i1-run.i0)run=cur;} // tronçon porté par l'appareil exclu
      if(!run)continue;i0=run.i0;i1=run.i1;}
    const F=[];for(let i=i0;i<=i1;i++){const f=fr(i);f.ri=i;if(!inTunS(f.s))F.push(f);}
    if(!F.length)continue;const low=!zn.lift&&Math.max(...F.map(el))<EL; // zone de freinage au niveau du sol (hors gare) : passerelle au sol, sans tour (issue #7, complément)
    if(low&&cf.ground===false||zn.lift&&Math.max(...F.map(el))<EL)continue;
    if(OSMW.some(P=>F.filter((f,k)=>k%4===0).filter(f=>dPl(f.x,f.z,P)<ed(f.s)+1).length>=F.length/8))continue; // ouvrage OSM le long de la zone : utilisé tel quel
    let sd=FS[zn.id]!=null?FS[zn.id]:FS[Z_ANC[zn.id]];
    if(sd!==1&&sd!==-1){let best=1e9;for(const e of [1,-1]){let p=0;for(let k=0;k<F.length;k+=2){const f=F[k],c=at(f,e,FL?FW/2+W/2:half(f.s)+W/2);p+=pen(c[0],c[1],f.y,f.s,W/2+.2);}if(p<best-1e-6){best=p;sd=e;}}}
    if(low){ // au sol : seulement le plus long tronçon libre (ni quai ni gare, ni file, ni autre voie), 3 m au moins
      let run=null,cur=null;for(const f of F){const c=at(f,sd,half(f.s)+W/2),ok=FL?!pen(f.x,f.z,f.y,f.s,FW/2,1):!pen(c[0],c[1],f.y,f.s,W/2+.2)&&!pen(...at(f,sd,half(f.s)+W+.1),f.y,f.s,.1);
        if(ok){if(cur&&f.ri===cur.i1+1)cur.i1=f.ri;else cur={i0:f.ri,i1:f.ri};if(!run||cur.i1-cur.i0>run.i1-run.i0)run=cur;}else cur=null;}
      if(!run||(run.i1-run.i0)*DS<3)continue;i0=run.i0;i1=run.i1;}
    const w={id:zn.id,sd,i0,i1,lift:!!zn.lift,low};walks.push(w);if(zn.lift)lift.w=w;
    if(!zn.lift||zn.foot){ // tour d'escalier : extrémité la plus dégagée (frein), ou pied du lift resté en hauteur
      const ends=zn.lift?[[i0,1]]:[[i0,1],[i1,-1]];let tb=null;
      for(const [ie,dir] of ends){const f=fr(ie),h=el(f);if(h<EL)continue;const nf=Math.max(1,Math.ceil(h/2)),run=nf>1?3.2:Math.max(1.2,h*1.6),TL=run+(nf>1?1.8:.9),TWd=nf>1?2*W+.1:W;
        const d0=ed(f.s)+.1,o={x:f.x,z:f.z,y:f.y,h,ux:f.tx*dir,uz:f.tz*dir,nx:f.nx*sd,nz:f.nz*sd,d0,TL,TW:TWd,nf,run};
        let p=0;for(let u=0;u<=TL;u+=1)for(const v of [d0,d0+TWd])p+=pen(o.x+o.ux*u+o.nx*v,o.z+o.uz*u+o.nz*v,f.y,f.s,.3);if(!tb||p<tb.p)tb=Object.assign(o,{p});}
      if(tb)towers.push(tb);}}
  // géométrie dessinée : morceaux de 8 points (alignés sur les tronçons de voie, même hauteur de tri)
  for(const w of walks){w.segs=[];let rise=null;
    for(let a=w.i0;a<w.i1;a=(Math.floor(a/8)+1)*8){const b=Math.min(w.i1,(Math.floor(a/8)+1)*8),P=[],Q=[],R=[],tr=[],ld=[];
      for(let i=a;i<=b;i++){const f=fr(i);if(inTunS(f.s))continue;const d=md(f.s);P.push(at(f,w.sd,d));Q.push(at(f,w.sd,d+WW/2));R.push(at(f,w.sd,d-WW/2));
        if(i<b){const g=fr(i+1),dy=g.y-f.y,dh=Math.hypot(g.x-f.x,g.z-f.z)||DS;
          if(w.lift&&dy/dh>.08){const r0=el(f),r1=el(g);for(let m=Math.ceil(r0/.2)*.2;m<r1;m+=.2){const k=(m-r0)/(dy||1),x=f.x+(g.x-f.x)*k,z=f.z+(g.z-f.z)*k,c=[x+f.nx*w.sd*d,z+f.nz*w.sd*d];
            if(!FL&&Math.floor(m/6)>Math.floor((m-.2)/6)&&m>1)ld.push(c);tr.push([c[0]-f.nx*WW/2,c[1]-f.nz*WW/2,c[0]+f.nx*WW/2,c[1]+f.nz*WW/2,m]);}}}}
      if(P.length<2)continue;let ys=0;for(let i=a;i<=b;i++)ys+=fr(i).y;
      w.segs.push({h:chunkH[((Math.floor((a+b)/2)%N)+N)%N]-.01,y:Math.max(0,ys/(b-a+1)-(FL?HANG:0)),w:WW,fl:FL,c:mkPath(P),o:mkPath(Q),n:mkPath(R),Q,Rn:R,tr,ld,nx:fr(a).nx*w.sd,nz:fr(a).nz*w.sd});}
    const s=w.segs[w.segs.length-1];if(w.lift&&s){const f=fr(w.i1),c=at(f,w.sd,md(f.s));s.top=[c[0],c[1],f.tx,f.tz,f.nx*w.sd,f.nz*w.sd];}} // palier au sommet
  for(const t of towers){const c=(u,v)=>[t.x+t.ux*u+t.nx*v,t.z+t.uz*u+t.nz*v],v0=t.d0-W/2-.1,v1=t.d0+t.TW;
    t.poly=[c(-.2,v0),c(t.TL,v0),c(t.TL,v1),c(-.2,v1)];t.fl=[];const L0=t.nf>1?.9:0; // palier haut (jonction avec la passerelle), volées, palier bas
    const nfl=Math.min(t.nf,2);for(let k=0;k<nfl;k++){const va=t.d0+k*(W+.1),vb=va+W,tr=[];for(let u=L0;u<=L0+t.run+1e-6;u+=.28)tr.push([...c(u,va),...c(u,vb),(k===0?1-(u-L0)/t.run:(u-L0)/t.run)]);
      t.fl.push({p:[c(L0,va),c(L0+t.run,va),c(L0+t.run,vb),c(L0,vb)],tr});}
    t.lands=t.nf>1?[[c(-.2,v0),c(L0,v0),c(L0,v1),c(-.2,v1)],[c(L0+t.run,t.d0),c(t.TL,t.d0),c(t.TL,v1),c(L0+t.run,v1)]]:[[c(-.2,v0),c(0,v0),c(0,t.d0+W),c(-.2,t.d0+W)]];}
  return {walks,towers,W};})();
const CW_GR='#5d605d',CW_RL='#a9aba5',CW_EDGE='#34373b'; // acier galvanisé terni (couleurs sourdes)
const polyP=P=>{ctx.beginPath();P.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();};
function drawCatwalk(g){const W=g.w||CATW.W;ctx.save();ctx.lineCap='butt';ctx.lineJoin='round';
  ctx.strokeStyle='rgba(20,22,24,.55)';ctx.lineWidth=W+.12;ctx.stroke(g.c);ctx.strokeStyle=CW_GR;ctx.lineWidth=W;ctx.stroke(g.c); // caillebotis
  if(cam.s>5&&!g.tr.length){ctx.setLineDash([.05,.12]);ctx.strokeStyle='rgba(25,26,28,.35)';ctx.lineWidth=W*.86;ctx.stroke(g.c);ctx.setLineDash([]);} // barreaux du caillebotis
  if(cam.s>3)for(const t of g.tr){const k=Math.min(1,(t[4]%6)/6),c=Math.round(78+40*k);ctx.strokeStyle=`rgb(${c},${c+2},${c})`;lw(.05,.4);ctx.beginPath();ctx.moveTo(t[0],t[1]);ctx.lineTo(t[2],t[3]);ctx.stroke();} // marches (plus claires en montant)
  for(const q of g.ld){ctx.fillStyle='#4f524f';ctx.beginPath();ctx.arc(q[0],q[1],W*.55,0,7);ctx.fill();} // paliers de repos
  if(g.top){const [x,z,tx,tz,nx,nz]=g.top,h=W/2;ctx.fillStyle=CW_GR;polyP([[x-nx*h,z-nz*h],[x+tx*1.4-nx*h,z+tz*1.4-nz*h],[x+tx*1.4+nx*h,z+tz*1.4+nz*h],[x+nx*h,z+nz*h]]);ctx.fill();ctx.strokeStyle=CW_EDGE;lw(.05,.4);ctx.stroke();}
  if(g.fl){ctx.strokeStyle='rgba(0,0,0,.35)';lw(.09,.6);ctx.stroke(g.n);ctx.strokeStyle=CW_RL;lw(.05,.5);ctx.stroke(g.n);} // plancher pleine largeur (inversé) : garde-corps des deux côtés
  else{ctx.strokeStyle=CW_EDGE;lw(.05,.4);ctx.stroke(g.n);} // plinthe côté voie
  ctx.strokeStyle='rgba(0,0,0,.35)';lw(.09,.6);ctx.stroke(g.o);ctx.strokeStyle=CW_RL;lw(.05,.5);ctx.stroke(g.o); // garde-corps extérieur
  if(cam.s>7){ctx.fillStyle=CW_EDGE;for(const P of g.fl?[g.Q,g.Rn]:[g.Q])for(let i=0;i<P.length;i+=3)ctx.fillRect(P[i][0]-.05,P[i][1]-.05,.1,.1);} // potelets
  ctx.restore();}
function drawTower(t){ctx.save();ctx.lineJoin='round';
  polyP(t.poly);ctx.fillStyle='rgba(30,32,34,.5)';ctx.fill(); // vide de la cage (on voit les volées du dessous)
  for(const L of t.lands){polyP(L);ctx.fillStyle=CW_GR;ctx.fill();}
  for(const f of t.fl){polyP(f.p);ctx.fillStyle='#676a66';ctx.fill();if(cam.s>3){lw(.05,.4);for(const r of f.tr){const c=Math.round(80+60*r[4]);ctx.strokeStyle=`rgb(${c},${c+2},${c})`;ctx.beginPath();ctx.moveTo(r[0],r[1]);ctx.lineTo(r[2],r[3]);ctx.stroke();}}}
  polyP(t.poly);ctx.strokeStyle='rgba(0,0,0,.35)';lw(.09,.6);ctx.stroke();ctx.strokeStyle=CW_RL;lw(.05,.5);ctx.stroke(); // garde-corps de la cage
  ctx.restore();}
function catwalkShadows(){ctx.save();ctx.lineCap='butt';
  for(const w of CATW.walks)for(const g of w.segs){ctx.lineWidth=g.w;ctx.save();ctx.translate(g.y*SHX,g.y*SHZ);ctx.stroke(g.c);ctx.restore();}
  for(const t of CATW.towers){ctx.save();ctx.translate(t.y*SHX*.5,t.y*SHZ*.5);polyP(t.poly);ctx.fill();ctx.restore();}ctx.restore();}
function drawCar(t,k,shadow){
  carFrame(t,k,_cf);const p=_cf.p,a=Math.atan2(_cf.T.z,_cf.T.x),hl=CAR/2-.07,hw=CW/2;
  // vue du dessus : wagon raccourci sur une pente forte (|T| horizontal), aminci quand la voie pivote (|R| horizontal + hauteur de caisse vue de côté) ; tête en bas : on voit le dessous
  const run=t.st==='run',sx=run?Math.max(.3,Math.hypot(_cf.T.x,_cf.T.z)):1,sy=run?clamp((CW*Math.hypot(_cf.R.x,_cf.R.z)+.9*Math.hypot(_cf.U.x,_cf.U.z))/CW,.3,1):1,up=run&&_cf.U.y<0;
  ctx.save();
  if(shadow){const hy=INV?Math.max(0,p.y-2.6):p.y+.6;ctx.translate(p.x+hy*SHX,p.z+hy*SHZ);ctx.rotate(a);ctx.scale(sx,sy);ctx.fillStyle='rgba(10,20,10,.3)';ctx.fillRect(-hl-.04,-hw-.04,2*hl+.08,CW+.08);ctx.restore();return;}
  ctx.translate(p.x,p.z);ctx.rotate(a);ctx.scale(sx,sy);
  if(up){ // wagon tête en bas (looping, vrille) : dessous de caisse, longeron, essieux et roues sur les rails ; passagers invisibles
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,.16);ctx.fill(); // caisse vue de dessous : bords de la coque
    ctx.fillStyle='#34363c';ctx.beginPath();ctx.roundRect(-hl+.18,-hw+.3,2*hl-.36,CW-.6,.1);ctx.fill(); // plancher
    ctx.fillStyle='#45484f';ctx.fillRect(-hl+.1,-.08,2*hl-.2,.16); // longeron central
    for(const ex of [-hl+.3,hl-.3]){ctx.fillStyle='#55585e';ctx.fillRect(ex-.04,-hw+.1,.08,CW-.2);ctx.fillStyle='#121316';for(const e of [-1,1])ctx.fillRect(ex-.15,e*.62-.07,.3,.14);} // essieux, roues
    // la voie passe AU-DESSUS du wagon tête en bas : rails (et poutre centrale) redessinés par-dessus, le wagon reste lisible de part et d'autre
    ctx.strokeStyle=TKC.rail;ctx.lineWidth=.2;ctx.beginPath();for(const e of [-1,1]){ctx.moveTo(-CAR/2,e*.62);ctx.lineTo(CAR/2,e*.62);}ctx.stroke();
    if(STL){ctx.strokeStyle=TKC.spine;ctx.lineWidth=.22;ctx.beginPath();ctx.moveTo(-CAR/2,0);ctx.lineTo(CAR/2,0);ctx.stroke();}
    ctx.restore();return;}
  if(BOB){ // coque de bob : pas de roues apparentes, nez et queue arrondis
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.2,.46,.46,.2]:k===NCARS-1?[.42,.2,.2,.42]:.22);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl+.12,-hw,2*hl-.24,.07);ctx.fillRect(-hl+.12,hw-.07,2*hl-.24,.07);
    ctx.fillStyle='#17181c';ctx.beginPath();INL?ctx.roundRect(-hl+.1,-hw+.15,2*hl-.2,CW-.3,.14):ctx.roundRect(-hl+.2,-hw+.15,2*hl-.42,CW-.3,.14);ctx.fill(); // habitacle (places en ligne : sur presque toute la longueur)
  }else if(INV){ // wagon suspendu, sans plancher : châssis sous la poutre, rangée de sièges côte à côte, dossiers et harnais sombres
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.12,.5,.5,.12]:.14);ctx.fill();
    ctx.fillStyle='#17181c';ctx.beginPath();ctx.roundRect(-hl+.18,-hw+.12,2*hl-.44,CW-.24,.1);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl+.08,-hw,.16,CW);ctx.fillRect(-.35,-.32,.7,.64);
    if(k===0){ctx.fillStyle=t.col2;ctx.beginPath();ctx.moveTo(hl-.25,-.3);ctx.lineTo(hl+.05,0);ctx.lineTo(hl-.25,.3);ctx.fill();}
  }else if(STL){ // wagon posé sur les rails : caisse arrondie, siège et barre de maintien (lapbar) sombres, roues en bout
    ctx.fillStyle='#1c1d22';ctx.fillRect(-hl+.12,-hw-.12,.3,CW+.24);ctx.fillRect(hl-.42,-hw-.12,.3,CW+.24);
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.14,.55,.55,.14]:.16);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl+.04,-hw,.1,CW);ctx.fillRect(-hl+.1,-.04,2*hl-.2,.08);
    ctx.fillStyle='#17181c';ctx.beginPath();ctx.roundRect(-hl+.22,-hw+.14,2*hl-.5,CW-.28,.1);ctx.fill();
    if(k===0){ctx.fillStyle=t.col2;ctx.beginPath();ctx.moveTo(hl-.3,-.25);ctx.lineTo(hl-.04,0);ctx.lineTo(hl-.3,.25);ctx.fill();}
  }else{
    ctx.fillStyle='#1c1d22';ctx.fillRect(-hl+.08,-hw-.2,.36,CW+.4);ctx.fillRect(hl-.44,-hw-.2,.36,CW+.4);
    ctx.fillStyle=t.col;ctx.beginPath();ctx.roundRect(-hl,-hw,2*hl,CW,k===0?[.18,.45,.45,.18]:.18);ctx.fill();
    ctx.fillStyle=t.col2;ctx.fillRect(-hl,-hw,2*hl,.11);ctx.fillRect(-hl,hw-.11,2*hl,.11);
    ctx.fillStyle='#17181c';ctx.fillRect(-hl+.26,-hw+.14,2*hl-.48,CW-.28);
    ctx.fillStyle='#3a3d46';ctx.fillRect(-hl+.14,-hw+.12,.18,CW-.24);
    if(k===0){ctx.fillStyle=t.col2;ctx.beginPath();ctx.moveTo(hl-.3,-.22);ctx.lineTo(hl-.06,0);ctx.lineTo(hl-.3,.22);ctx.fill();}
  }
  if(cam.s>2.2){const ra=clamp((cam.s-2.2)/4,0,1); // sécurités : discrètes de loin, lisibles au zoom proche
    for(let sd=0;sd<CSEATS;sd++){const s=t.seats[k*CSEATS+sd],q=seatOff(sd),x=q[0]+(INL?0:-.06),y=q[1]*.91;
      if(s&&s.on){const up=((k*CSEATS+sd)%3!==1)?t.arms:0; // côte à côte, ou l'un derrière l'autre
        ctx.fillStyle=PAL[s.ci];ctx.beginPath();ctx.ellipse(x,y,INL?.18:.2,INL?.24:.26,0,0,7);ctx.fill(); // épaules : .18 m le long du wagon pour des places en ligne (corps qui ne se touchent pas)
        if(up>.3&&cam.s>7){ctx.strokeStyle='#e9c9a6';ctx.lineWidth=.09;ctx.beginPath();const d=(INL?.3:.42)*up;ctx.moveTo(x,y-.2);ctx.lineTo(x+d,y-.26);ctx.moveTo(x,y+.2);ctx.lineTo(x+d,y+.26);ctx.stroke();}}
      const rr=t.rc[k],top=RES_KIND==='otsr'&&rr>.5;if(RES_PER==='seat'&&!top)drawRes(x,y,rr,ra); // la tête passe entre les épaulières du harnais fermé ; harnais relevé : au-dessus de la tête
      if(s&&s.on){ctx.fillStyle=HAIR[(k*5+sd*3+t.i)%HAIR.length];ctx.beginPath();ctx.arc(x,y,.14,0,7);ctx.fill();}
      if(RES_PER==='seat'&&top)drawRes(x,y,rr,ra);}
    if(RES_PER==='car')drawResCar(hl,t.rc[k],ra);}
  ctx.restore();
}
/* Sécurités vues du dessus (RES_KIND, RES_PER : engine/core.js). r = ouverture (0 verrouillée … 1 ouverte).
   La barre pivote autour d'un axe transversal : vue du dessus, sa projection se rapproche de l'axe (x' = axe + (x − axe)·cos θ) et s'éclaircit en montant.
   Couleurs mates : armature noire, mousse grise. */
const resTh=r=>r*Math.PI/2*1.08,resCol=(r,b)=>{const c=Math.round(b+28*Math.sin(resTh(r)));return 'rgb('+c+','+c+','+(c+3)+')';};
function drawRes(x,y,r,a){
  const th=resTh(r),c=Math.cos(th),P=(px,x0)=>px+(x0-px)*c;ctx.save();ctx.globalAlpha=a;ctx.lineCap='round';ctx.lineJoin='round';
  if(RES_KIND==='otsr'){ // harnais : deux épaulières reliées par un plastron, axe derrière l'appui-tête
    const px=x-.24,w=.2+.04*Math.sin(th);
    ctx.strokeStyle=resCol(r,40);ctx.lineWidth=.09;ctx.beginPath();ctx.moveTo(P(px,x-.14),y-w);ctx.lineTo(P(px,x+.17),y-w);ctx.quadraticCurveTo(P(px,x+.3),y-w,P(px,x+.3),y);ctx.quadraticCurveTo(P(px,x+.3),y+w,P(px,x+.17),y+w);ctx.lineTo(P(px,x-.14),y+w);ctx.stroke();
    ctx.strokeStyle=resCol(r,80);ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(P(px,x-.1),y-w);ctx.lineTo(P(px,x+.14),y-w);ctx.moveTo(P(px,x-.1),y+w);ctx.lineTo(P(px,x+.14),y+w);ctx.stroke(); // mousse des épaulières
    ctx.fillStyle=resCol(r,26);ctx.fillRect(P(px,x-.2),y-.09,Math.max(.04,(x-.12-(x-.2))*c+.04),.18);} // charnière
  else if(RES_KIND==='belt'){ // ceinture : sangle posée sur le côté (ouverte) ou en travers des cuisses (bouclée)
    ctx.strokeStyle=resCol(r*0,40);ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(x+.16,y-.22);ctx.lineTo(x+.16+(.02-.16)*0+.06*(1-r),y+.22*(1-r)-.22*r);ctx.stroke();
    if(r<.5){ctx.fillStyle='#55585e';ctx.fillRect(x+.18,y-.04,.07,.08);}}
  else{ // lapbar individuelle : barre transversale devant les cuisses, axe à l'avant de la place
    const px=x+.46,bx=P(px,x+.22),w=.21;
    ctx.strokeStyle=resCol(r,30);ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(px,y);ctx.lineTo(bx,y);ctx.stroke(); // bras
    ctx.fillStyle=resCol(r,74);ctx.beginPath();ctx.roundRect(bx-.05,y-w,.1,2*w,.05);ctx.fill(); // mousse
    ctx.strokeStyle=resCol(r,24);ctx.lineWidth=.025;ctx.stroke();}
  ctx.restore();
}
function drawResCar(hl,r,a){ // lapbar commune au wagon : UNE barre en travers DEVANT le passager avant (fermée : posée sur ses genoux ; ouverte : relevée vers l'avant), bras articulés à l'avant du wagon
  const th=resTh(r),c=Math.cos(th),px=hl-.06,P=x0=>px+(x0-px)*c,w=.25;let xf=-1e9;for(let sd=0;sd<CSEATS;sd++)xf=Math.max(xf,seatOff(sd)[0]+(INL?0:-.06));
  const b=P(Math.min(px-.07,xf+.22));ctx.save();ctx.globalAlpha=a;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle=resCol(r,40);ctx.lineWidth=.06;ctx.beginPath();ctx.moveTo(px,-w);ctx.lineTo(b,-w);ctx.moveTo(px,w);ctx.lineTo(b,w);ctx.stroke(); // bras
  ctx.fillStyle=resCol(r,74);ctx.beginPath();ctx.roundRect(b-.05,-w,.1,2*w,.05);ctx.fill();ctx.strokeStyle=resCol(r,24);ctx.lineWidth=.025;ctx.stroke(); // barre en mousse
  ctx.fillStyle=resCol(r,24);ctx.fillRect(px-.04,-w-.04,.08,2*w+.08); // axe
  ctx.restore();
}
/* Équipements des zones de freinage, dessinés avec leur tronçon (sous les trains) :
   - mâchoires mécaniques : deux patins de part et d'autre de l'ailette du train (axe de la voie), dans leur carter ; serrées (patins contre l'axe) ou écartées selon l'état des freins ;
   - roues de propulsion (pneus) là où la zone a des moteurs (SITE.zones … drive ; défaut : toutes les zones, freins de bloc compris en marche avant seule, drive:'fwd'), une unité sur deux : paire de pneus à axe vertical
     qui pincent l'ailette (bois, acier, inversé), pneu à axe horizontal au fond de la gouttière (bob) ; ils tournent quand un train roule dessus.
   Coaster inversé : étriers et pneus de part et d'autre de la poutre caisson, dessinés AVANT elle (sous le tube, au niveau du chariot suspendu, issue #32) : seuls leurs bords dépassent. Matières mates ; de loin, un simple trait sombre. Dimensions ESTIMÉES. */
const BZS={},PV=new WeakMap(),tSp=t=>t.st==='garage'?(t.mv?MV.v:0):t.st==='station'?0:t.v;
const zTrains=z=>trains.filter(t=>z.car?tZone(t)==='RB':(t.st==='run'&&t.s>z.r0-.3&&t.s-TLEN<z.r1+.3)||(z.id==='St'&&t.st==='station')||(t.st==='garage'&&tZone(t)===z.id));
const _bf=mkF();
function brakeState(dt){ // freins serrés : au pupitre, défaut, train retenu ou ralenti dans la zone ; zone vide : serrée si la section suivante est occupée (la gare, toujours)
  for(const z of BZ){const b=BZS[z.id]||(BZS[z.id]={c:1,a:0}),ts=zTrains(z);
    let cl=zK(z.id)||(z.id===ZF&&G.brakeFault)||ts.some(t=>tSp(t)<.05||(t.st==='run'&&PV.has(t)&&t.v<PV.get(t)-.01));
    if(!ts.length&&!cl)cl=z.id==='St'||z.lane!=null||!!nextBusy(z.id,null); // voie vide : freins serrés
    if(dt>0&&b.cl!==undefined&&b.cl!==!!cl&&z.id!=='St'&&z.lane==null){const q=z.r0!=null?frameAt((z.r0+z.r1)/2,_bf).p:null;cl?sfx.brakeOn(q&&q.x,q&&q.z):sfx.brakeOff(q&&q.x,q&&q.z);} // son : serrage (claquement) / desserrage (air)
    b.cl=!!cl;
    if(dt>0){b.c=lerp(b.c,cl?1:0,Math.min(1,dt*6));if(z.drive){const sp=Math.max(0,...ts.map(tSp)),dr=ts.some(t=>t.bgo||t.fdrive||t.entering||t.toPre);b.dr=sp>.05||dr;if(b.dr)b.a+=Math.min(6,Math.max(sp/.2,dr?3:0))*dt;}}} // roues : rotation visible (6 rad/s au plus, 3 au moins si poussé), animation seulement
  if(dt>0){CHAINE.pv+=CHAINE.v*Math.max(1,34/Math.max(.5,cam.s*LIFT_V))*dt;for(const t of trains)PV.set(t,t.v);} // phase visuelle de la chaîne : au moins ~34 px/s à l'écran (téléphone), la physique ne change pas
}
function drawBU(o){
  const s=cam.s;if(!o.bu.length||s<.5)return;
  const far=s<3.2,flt=G.brakeFault&&Math.sin(clock*9)>0,mx=(a,b,k)=>{const h=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)),A=h(a),B=h(b);return 'rgb('+A.map((v,i)=>Math.round(v+(B[i]-v)*k))+')';};
  for(const u of o.bu){const b=BZS[u.id]||{c:1,a:0},c=clamp(b.c,0,1),X=(a,v)=>u.x+u.tx*a+u.nx*v,Z=(a,v)=>u.z+u.tz*a+u.nz*v;
    const quad=(a0,a1,v0,v1)=>{ctx.beginPath();ctx.moveTo(X(a0,v0),Z(a0,v0));ctx.lineTo(X(a1,v0),Z(a1,v0));ctx.lineTo(X(a1,v1),Z(a1,v1));ctx.lineTo(X(a0,v1),Z(a0,v1));ctx.closePath();ctx.fill();};
    const disc=(a,v,r)=>{ctx.beginPath();ctx.arc(X(a,v),Z(a,v),r,0,7);ctx.fill();};
    const c0=INV?.62:0,sides=INV?[-1,1]:[0],px=1/s;
    if(far){ // de loin : un trait dont la couleur dit l'état (patins : sourd gris = relâchés, brique = serrés ; pneus : gris = arrêtés, vert sourd = entraînés)
      ctx.fillStyle=u.ty?(b.dr?'#5d8467':'#3d4046'):mx('#4a4d53','#a2574b',c);const w=Math.max(.2,2.2*px),l=Math.max(.3,3*px);for(const e of sides)quad(-l,l,e*c0-w,e*c0+w);continue;}
    if(u.ty){ // roues de propulsion
      if(BOB){ctx.fillStyle='#151618';quad(-.26,.26,-.11,.11);ctx.fillStyle=b.dr?'#8c8f86':'#4a4c50';const g=Math.max(.13,1.6*px),ph=(b.a*.2)%g;for(let a=-.26+ph;a<.26;a+=g)quad(a,a+g*.4,-.11,.11);continue;} // pneu à axe horizontal, rainures qui défilent
      const r=clamp(2.8*px,.2,.27),sp=Math.max(.24,r+.03);
      for(const e of sides){const cx=e*c0;ctx.fillStyle='#3b3f45';quad(-.12,.12,cx-.66,cx-.46);quad(-.12,.12,cx+.46,cx+.66); // moto-réducteurs
        for(const w of [-1,1]){const v=cx+w*sp,an=b.a*w;ctx.fillStyle='#151618';disc(0,v,r);ctx.fillStyle='#5f6368';disc(0,v,r*.42);
          ctx.strokeStyle=b.dr?'#b3b09f':'#7a7c80';ctx.lineWidth=Math.max(.045,1.3*px);ctx.beginPath();for(let j=0;j<2;j++){const q=an+j*Math.PI;ctx.moveTo(X(Math.cos(q)*r*.2,v+Math.sin(q)*r*.2),Z(Math.cos(q)*r*.2,v+Math.sin(q)*r*.2));ctx.lineTo(X(Math.cos(q)*r*.92,v+Math.sin(q)*r*.92),Z(Math.cos(q)*r*.92,v+Math.sin(q)*r*.92));}ctx.stroke();}} // deux rayons clairs qui tournent
      continue;}
    const g=lerp(Math.min(.6,Math.max(.22,6*px)),.035,c),th=Math.max(.05,1.4*px),ca=Math.max(.11,2.4*px); // demi-écartement des patins : écartés (freins relâchés) ou serrés contre l'ailette (valeurs relevées en pixels : lisible à l'échelle d'un téléphone)
    for(const e of sides){const cx=e*c0;
      ctx.fillStyle='rgba(52,54,58,.85)';quad(-.3,.3,cx-g-ca-.2,cx+g+ca+.2); // traverse de fixation
      ctx.fillStyle=mx('#6b6258','#b0624f',c);quad(-.26,.26,cx+g,cx+g+th);quad(-.26,.26,cx-g-th,cx-g); // garnitures : brique quand serrées
      ctx.fillStyle=u.id===ZF&&flt?'#7a2e28':mx('#2c2e33','#5a2f2a',c);quad(-.2,.2,cx+g+th,cx+g+th+ca);quad(-.2,.2,cx-g-th-ca,cx-g-th);} // carters des mâchoires
  }
}
function drawTraverser(){ // pont droit : dalle des voies du garage et heurtoirs. Fosse, chemins de roulement et chariot ne sont plus calculés (propriétaire 27/11, issue #68) :
  // les structures sous le rail mobile sont des objets OSM man_made=structure (decor.js, drawStruct) ; sans objet OSM, rien sous le rail mobile.
  const dm=Math.min(...LANES.map(l=>l.d)),vB=PIT_VB;
  ctx.save();ctx.transform(SW0.tx,SW0.tz,SW0.vx,SW0.vz,SW0.x,SW0.z);
  const gu0=LREV?laneU(LANES[0].end)-1:U_LANE-.4,gw=LANES[0].end-U_LANE+1.4;
  ctx.fillStyle='#a9aaa6';ctx.fillRect(gu0,vB,gw,-dm+1.6-vB);ctx.fillStyle=TEX.asph;ctx.globalAlpha=.35;ctx.fillRect(gu0,vB,gw,-dm+1.6-vB);ctx.globalAlpha=1; // dalle du garage
  ctx.strokeStyle='#2c2e33';lw(.3,.8);ctx.beginPath();for(const l of LANES){const e=LREV?laneU(l.end)-.15:l.end+.15;ctx.moveTo(e,-l.d-.7);ctx.lineTo(e,-l.d+.7);}ctx.stroke(); // heurtoirs
  ctx.restore();
}
function drawTable(){ // pont transbordeur, dessiné dans son repère : u le long de la voie, v dans le sens du coulissement
  if(ROT){if(!YD.slab)return; // appareil rotatif : dessiné seul (tronçon tournant, faces, supports) ; dalle au sol seulement si SITE.yard.slab (propriétaire, Goudurix : pas de plateforme)
    const L_=LBK?YD.b-YD.a:YD.len||8.6; // carter du tambour autour du tronçon (le rail tourne sur son axe), contour orange pendant la rotation ; élargi du côté du garage pour contenir la face en S
    let v0=-1.05;if(LBK&&LANES.length){const nl=Math.round(LANES[0].link/.5);for(const q of LANES[0].path.slice(0,nl+1))v0=Math.min(v0,((q.x-SW0.x)*SW0.vx+(q.z-SW0.z)*SW0.vz)-1.05);}
    ctx.save();ctx.transform(SW0.tx,SW0.tz,SW0.vx,SW0.vz,SW0.x,SW0.z);ctx.fillStyle='rgba(58,62,70,.9)';ctx.strokeStyle=devMoving()&&Math.sin(clock*10)>0?'#ff9f43':'#8c8f94';lw(.12,.7);
    ctx.beginPath();ctx.roundRect(-.5,v0,L_+1,1.05-v0,.35);ctx.fill();ctx.stroke();
    ctx.fillStyle='#2a2c31';ctx.fillRect(-.5,v0,.5,1.05-v0);ctx.fillRect(L_,v0,.5,1.05-v0);ctx.restore();return;}
  // tronçon coulissant : dalle, chemins de roulement et chariot ne sont plus calculés (issue #68) : objets OSM man_made=structure (drawStruct) ; sinon rien
}
function drawStationFloor(s){
  const a=BAYS[NCARS-1],b=BAYS[0],P=Object.assign({load:7.9,exit:0,back:1.5,front:1.6},SITE.plat),bk=P.back+CAR/2; // plat.back : au-delà de l'ARRIÈRE du dernier wagon (pas de son milieu), comme tools/offpath.js
  const quad=(l0,l1)=>{ctx.beginPath();ctx.moveTo(a.x-a.tx*bk+a.rx*l0,a.z-a.tz*bk+a.rz*l0);ctx.lineTo(b.x+b.tx*P.front+b.rx*l0,b.z+b.tz*P.front+b.rz*l0);
    ctx.lineTo(b.x+b.tx*P.front+b.rx*l1,b.z+b.tz*P.front+b.rz*l1);ctx.lineTo(a.x-a.tx*bk+a.rx*l1,a.z-a.tz*bk+a.rz*l1);ctx.closePath();ctx.fill();};
  const floor=()=>{if(!G.hideSt)ctx.fill(stationP);quad(PEDGE,P.load);if(P.exit)quad(-PEDGE,-P.exit);
    if(BAREA){ctx.beginPath();BAREA.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.closePath();ctx.fill();}}; // zone d'attente éditée (GAME.boardAreas) : sol du quai // plancher : bâtiment de la gare + quais (« Masquer la gare » : quais seuls, on voit dessous)
  ctx.fillStyle=LK.pf;floor();
  if(s>4&&LK.prow){ctx.fillStyle=TEX.rows;ctx.globalAlpha=.16;floor();ctx.globalAlpha=1;}
  const ln=(lat,e)=>{ctx.moveTo(a.x-a.tx*e+a.rx*lat,a.z-a.tz*e+a.rz*lat);ctx.lineTo(b.x+b.tx*e+b.rx*lat,b.z+b.tz*e+b.rz*lat);};
  ctx.strokeStyle='#34322f';ctx.lineWidth=2*PEDGE;ctx.beginPath();ln(0,1.6);ctx.stroke();
  ctx.strokeStyle='#e8b93c';lw(.2,.8);ctx.beginPath();ln(PEDGE+.06,1);ln(-PEDGE-.06,1);ctx.stroke();
  if(SITE.draw&&SITE.draw.floor)SITE.draw.floor(ctx,s,API);
}
// Bord de quai par-dessus le tablier d'une voie plus large que le gabarit des wagons (voie en bois) : bande de quai de PEDGE au bord du tablier, redessinée après la voie
// et avant les wagons (élément de tri à la hauteur de la gare), avec la ligne de sécurité : le quai touche le gabarit des wagons (propriétaire, lot 6).
const LIP=!INV&&!BOB&&DECKW/2>PEDGE+.02?DECKW/2+.06:0; // bob : la gouttière de gare est déjà rétrécie au gabarit (TRF)
function drawLip(){const a=BAYS[NCARS-1],b=BAYS[0],P=Object.assign({load:7.9,exit:0,back:1.5,front:1.6},SITE.plat),bk=P.back+CAR/2;
  const quad=(l0,l1)=>{ctx.beginPath();ctx.moveTo(a.x-a.tx*bk+a.rx*l0,a.z-a.tz*bk+a.rz*l0);ctx.lineTo(b.x+b.tx*P.front+b.rx*l0,b.z+b.tz*P.front+b.rz*l0);
    ctx.lineTo(b.x+b.tx*P.front+b.rx*l1,b.z+b.tz*P.front+b.rz*l1);ctx.lineTo(a.x-a.tx*bk+a.rx*l1,a.z-a.tz*bk+a.rz*l1);ctx.closePath();ctx.fill();};
  const sides=P.exit?[1,-1]:[1];ctx.fillStyle=LK.pf;for(const e of sides)quad(e*PEDGE,e*LIP);
  if(cam.s>4&&LK.prow){ctx.fillStyle=TEX.rows;ctx.globalAlpha=.16;for(const e of sides)quad(e*PEDGE,e*LIP);ctx.globalAlpha=1;}
  ctx.strokeStyle='#e8b93c';lw(.2,.8);ctx.beginPath();for(const e of sides){const l=e*(PEDGE+.06);ctx.moveTo(a.x-a.tx*1+a.rx*l,a.z-a.tz*1+a.rz*l);ctx.lineTo(b.x+b.tx*1+b.rx*l,b.z+b.tz*1+b.rz*l);}ctx.stroke();}
function drawGates(){ // un portillon par wagon, ou par rangée (SITE.plat.gatesPer:'row', GUNITS) ; ligne des portillons à PGATE du rail, près du bord du quai
  ctx.strokeStyle=LK.gate||'#4d525a'; // séparateurs de travées, à 90° des portillons : couleur des portillons (GAME.look.gate, propriétaire 23/11)
  lw(.09,.6);ctx.beginPath();
  for(let u=0;u<=NGATES;u++){const g=GUNITS[Math.min(u,NGATES-1)],b=BAYS[g.k],e=u<NGATES?g.c+g.h:g.c-g.h,cx=b.x+b.tx*e,cz=b.z+b.tz*e;ctx.moveTo(cx+b.rx*(PGATE-.05),cz+b.rz*(PGATE-.05));ctx.lineTo(cx+b.rx*(PGATE+GDEPTH),cz+b.rz*(PGATE+GDEPTH));}
  ctx.stroke();
  // un vantail par portillon, articulé sur le séparateur avant ; il pivote vers le train
  // Propriétaire (Zeus, 2026-11-17) : les portillons s'ouvrent vers le train sans jamais dépasser le bord du quai. Vantail = largeur du portillon,
  // au plus le couloir (PGATE-PEDGE-5 cm) ; le reste de la travée est une clôture fixe (largeur de passage ESTIMÉE, non relevée).
  const a=G.gate*1.45,ca=Math.cos(a),sa=Math.sin(a),GL=g=>Math.min(2*g.h-.3,PGATE-PEDGE-.05);
  ctx.strokeStyle=LK.gate||'#4d525a';lw(.09,.6);ctx.beginPath(); // clôture fixe de la ligne des portillons : couleur des portillons (GAME.look.gate, issue #45)
  for(const g of GUNITS){const b=BAYS[g.k],e0=g.c+g.h-.12-GL(g),e1=g.c-g.h+.15;if(e0-e1<.05)continue;ctx.moveTo(b.x+b.tx*e0+b.rx*PGATE,b.z+b.tz*e0+b.rz*PGATE);ctx.lineTo(b.x+b.tx*e1+b.rx*PGATE,b.z+b.tz*e1+b.rz*PGATE);}
  ctx.stroke();
  ctx.fillStyle='#2b2e33';for(const g of GUNITS){const b=BAYS[g.k],hx=g.c+g.h-.12,px=b.x+b.tx*hx+b.rx*PGATE,pz=b.z+b.tz*hx+b.rz*PGATE;ctx.fillRect(px-.1,pz-.1,.2,.2);}
  // postes de validation des lapbars (les opérateurs et les visiteurs du quai : drawStationPeople)
  for(const o of OPS){const [qx,qz]=opPost(o.i);
    ctx.fillStyle='#30353c';ctx.fillRect(qx-.28,qz-.28,.56,.56);
    ctx.fillStyle=o.ok?'#4fc27a':o.st==='idle'?'#59606a':'#d0a03a';ctx.beginPath();ctx.arc(qx,qz,.15,0,7);ctx.fill();}
}
// Personnes du quai (propriétaire, Tonnerre 2 Zeus, 2026-11-16, lot 5 : opérateurs passés sous la voie, visiteurs invisibles entre portillons et train) : opérateurs,
// visiteurs aux places d'attente, et marcheurs du quai (vers une place, vers un siège, du siège à la porte, tant qu'ils sont dans l'emprise de la gare) sont dessinés
// APRÈS la voie, les trains, les portillons, les garde-corps et le sol du quai ; sous le toit de la gare quand il est affiché, au-dessus quand il est effacé
// (drawWorld). Les visiteurs assis sont dessinés avec leur wagon (drawCar), donc sous le train.
const PLATK={wait:1,board:1,alight:1},onPlat=k=>PLATK[k.kind]&&(k.kind!=='alight'||STSP.length<3||pipXZ(STSP,k.x,k.z));
// Vantaux des portillons : dessinés avec les personnes du quai, APRÈS la voie et les trains (sinon le tablier de la voie, plus large que le wagon, les cachait
// quand ils s'ouvrent vers le train : propriétaire, Zeus, 2026-11-17)
function drawGateLeaves(){const a=G.gate*1.45,ca=Math.cos(a),sa=Math.sin(a),GL=g=>Math.min(2*g.h-.3,PGATE-PEDGE-.05);
  const st=G.gate>.5?'#4f9a72':'#a8443a';ctx.strokeStyle=LK.gate||st;lw(.13,.9);ctx.lineCap='round';ctx.beginPath();
  for(const g of GUNITS){const b=BAYS[g.k],hx=g.c+g.h-.12,len=GL(g),px=b.x+b.tx*hx+b.rx*PGATE,pz=b.z+b.tz*hx+b.rz*PGATE;ctx.moveTo(px,pz);ctx.lineTo(px+(-b.tx*ca-b.rx*sa)*len,pz+(-b.tz*ca-b.rz*sa)*len);}
  ctx.stroke();ctx.lineCap='butt';
  if(LK.gate){ctx.fillStyle=st;for(const g of GUNITS){const b=BAYS[g.k],hx=g.c+g.h-.12;ctx.beginPath();ctx.arc(b.x+b.tx*hx+b.rx*PGATE,b.z+b.tz*hx+b.rz*PGATE,Math.max(.08,1.5/cam.s),0,7);ctx.fill();}} // couleur réglée : état lu au voyant du poteau-pivot
}
function drawStationPeople(){drawGateLeaves();
  G.plat.forEach((r,i)=>{if(r&&r.on){const p=slotPos(i);person(p[0],p[2],r.ci,r.ph,false);}});(G.platR||[]).forEach((r,j)=>{if(r&&r.on&&BRES[j])person(BRES[j][0],BRES[j][2],r.ci,r.ph,false);}); // réserve de la zone d'attente (issue #24)
  for(const k of G.walkers)if(onPlat(k))person(k.x,k.z,k.ci,k.ph,true);
  for(const o of OPS)person(o.x,o.z,3,o.i+.6,o.mv,'#1d2b4f');
}
/* Synoptique technique : plan du circuit (nord en haut) avec zones, freins de bloc, garage et trains en direct */
let synOn=(()=>{try{const v=localStorage.getItem('t2z.syn');if(v!==null)return v==='1';}catch(e){}return VW>=600;})();
function toggleSyn(){synOn=!synOn;try{localStorage.setItem('t2z.syn',synOn?'1':'0');}catch(e){}$('bSyn').classList.toggle('on',synOn);}
$('bSyn').classList.toggle('on',synOn);
const SYN={pts:null,lay:null,key:'',hits:[],box:null};
function synBuild(){
  const pts=[];for(let s=0;s<L;s+=1){const f=frameAt(s,_cf);pts.push([f.p.x,f.p.z]);}
  const lanes=LANES.map(l=>l.path.filter((_,i)=>i%4===0||i===l.path.length-1).map(q=>[q.x,q.z]));
  const box=()=>({x0:1e9,x1:-1e9,z0:1e9,z1:-1e9}),ext=(b,a)=>{for(const q of a){b.x0=Math.min(b.x0,q[0]);b.x1=Math.max(b.x1,q[0]);b.z0=Math.min(b.z0,q[1]);b.z1=Math.max(b.z1,q[1]);}};
  const bb=box(),gb=box();ext(bb,pts);lanes.forEach(l=>{ext(bb,l);ext(gb,l);});
  ext(gb,pts.slice(Math.max(0,Math.floor(SW_A-5)),Math.min(pts.length,Math.ceil(SW_B+5))));
  if(TRAV){const e=[];for(const v of [-GAP-1.2,RET+1.2])for(const u of [-1,R1-R0+1])e.push([SW0.x+SW0.tx*u+SW0.vx*v,SW0.z+SW0.tz*u+SW0.vz*v]);ext(gb,e);ext(bb,e);}
  for(const k of ['x0','z0'])gb[k]-=3;for(const k of ['x1','z1'])gb[k]+=3;
  let cx=0,cz=0;for(const q of pts){cx+=q[0];cz+=q[1];}
  Object.assign(SYN,{pts,lanes,bb,gb,c:[cx/pts.length,cz/pts.length]});
}
function drawSyn(){
  SYN.hits=[];SYN.box=null;if(!synOn)return;
  if(!SYN.pts)synBuild();
  const sm=VW<600||VH<420,pad=sm?10:14,TT=sm?12:15,mw=sm?Math.min(200,VW-16):Math.min(430,VW*.45),mh=sm?Math.min(100,VH*.12):Math.min(270,VH*.36),GH=sm?58:150;
  const bb=SYN.bb,gb=SYN.gb,bw=Math.max(1,bb.x1-bb.x0),bh=Math.max(1,bb.z1-bb.z0),sc=Math.min((mw-2*pad)/bw,(mh-2*pad-TT)/bh);
  const pw=Math.max(bw*sc+2*pad,sm?mw:Math.min(300,mw)),ph=bh*sc+2*pad+TT+GH+TT,px=8,py=8,ox=px+(pw-bw*sc)/2,oy=py+pad+TT;
  const X=x=>ox+(x-bb.x0)*sc,Z=z=>oy+(z-bb.z0)*sc;SYN.box=[px,py,pw,ph];
  const gw=Math.max(1,gb.x1-gb.x0),gh=Math.max(1,gb.z1-gb.z0),gsc=Math.min((pw-2*pad)/gw,GH/gh),gx0=px+(pw-gw*gsc)/2,gy0=py+ph-pad*.4-GH+(GH-gh*gsc)/2;
  const GX=x=>gx0+(x-gb.x0)*gsc,GZ=z=>gy0+(z-gb.z0)*gsc,iy=py+ph-pad*.4-GH-TT;
  const fs=sm?9:10.5,R=sm?6.5:8;
  ctx.save();ctx.fillStyle='#0f1626';ctx.beginPath();ctx.roundRect(px,py,pw,ph,6);ctx.fill();
  ctx.strokeStyle='rgba(120,140,175,.35)';ctx.lineWidth=1;ctx.stroke();
  ctx.font='600 '+fs+'px system-ui,sans-serif';ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.fillStyle='#cbd5ee';ctx.fillText('Synoptique — circuit '+Math.round(L)+' m',px+8,py+TT-1);
  ctx.fillText('Garage'+(TRAV?' — '+DEVN.toLowerCase():''),px+8,iy+TT-3);
  ctx.strokeStyle='rgba(120,140,175,.25)';ctx.beginPath();ctx.moveTo(px+6,iy);ctx.lineTo(px+pw-6,iy);ctx.stroke();
  const P=SYN.pts;ctx.lineCap='round';ctx.lineJoin='round';
  const seg=(a,b,X,Z)=>{a=clamp(Math.floor(a),0,P.length-1);b=clamp(Math.ceil(b),0,P.length-1);ctx.beginPath();for(let i=a;i<=b;i++)i===a?ctx.moveTo(X(P[i][0]),Z(P[i][1])):ctx.lineTo(X(P[i][0]),Z(P[i][1]));ctx.stroke();};
  const at=s=>{const q=P[clamp(Math.round(s),0,P.length-1)];return [X(q[0]),Z(q[1])];},mid=t=>t.s-TLEN/2;
  const cantons=[[S_REL,BLK.length?BLK[0]:L]].concat(BLK.map((b,i)=>[b,blkEnd(i)])); // canton i+1 : après le frein de bloc i
  const lab=(t,x,y,c)=>{const dx=x-X(SYN.c[0]),dz=y-Z(SYN.c[1]),d=Math.hypot(dx,dz)||1,q=sm?9:12,w=ctx.measureText(t).width;let lx=x+(Math.abs(dx)>6?dx/d*q:0);const al=dx>6?'left':dx<-6?'right':'center';
    lx=al==='left'?Math.min(lx,px+pw-5-w):al==='right'?Math.max(lx,px+5+w):clamp(lx,px+5+w/2,px+pw-5-w/2);ctx.textAlign=al;ctx.fillStyle=c;ctx.fillText(t,lx,y+dz/d*q+3);};
  // garage : tracé commun au plan (fin) et à l'encart (agrandi)
  const garage=(X,Z,lw)=>{
    ctx.lineWidth=lw;ctx.strokeStyle='#6f7f9c';
    SYN.lanes.forEach(l=>{ctx.beginPath();l.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Z(q[1])):ctx.moveTo(X(q[0]),Z(q[1])));ctx.stroke();});
    if(TRAV){
      const pt=(u,v)=>[X(SW0.x+SW0.tx*u+SW0.vx*v),Z(SW0.z+SW0.tz*u+SW0.vz*v)],ln=(v,u0,u1)=>{const a=pt(u0,v),b=pt(u1,v);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();};
      const vA=raC(),vB=devC()-GAP,ul=R1-R0;
      ctx.lineWidth=lw*1.8;if(!SG){ctx.strokeStyle=RA?'#a7b6d0':'#d8dfec';ln(vA,0,ul);}ctx.strokeStyle='#d9bd82';ln(vB,0,ul); // rail unique : un seul rail, celui du chariot
      ctx.lineWidth=1;ctx.strokeStyle='rgba(217,189,130,.65)';const a0=vB-.8,a1=(RA?vB:vA)+.8;
      ctx.beginPath();[[a0,-.8],[a1,-.8],[a1,ul+.8],[a0,ul+.8]].forEach(([v,u],i)=>{const q=pt(u,v);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);});ctx.closePath();ctx.stroke();
    }else{ctx.fillStyle='#d9bd82';ctx.beginPath();ctx.arc(X(SW0.x),Z(SW0.z),lw+1,0,7);ctx.fill();}
  };
  // cantons occupés (teinte)
  ctx.lineWidth=sm?7:9;ctx.strokeStyle='rgba(205,165,85,.32)';
  for(const [a,b] of cantons)if(trains.some(t=>t.st==='run'&&mid(t)>=a&&mid(t)<b))seg(a,b,X,Z);
  garage(X,Z,1.2);
  ctx.lineWidth=1.5;ctx.strokeStyle='#9aa9c4';seg(0,P.length-1,X,Z);ctx.lineTo(X(P[0][0]),Z(P[0][1]));ctx.stroke();
  const gap=(X,Z,w)=>{if(SG&&!circIn()){ctx.lineWidth=w;ctx.strokeStyle='#0f1626';seg(R0+1,R1-1,X,Z);}}; // rail unique hors de P : circuit interrompu
  gap(X,Z,3);
  for(const u of TUN){ctx.lineWidth=3;ctx.strokeStyle='#0f1626';seg(u.a,u.b,X,Z);ctx.lineWidth=2;ctx.strokeStyle='#9aa9c4';ctx.setLineDash([3,3]);seg(u.a,u.b,X,Z);ctx.setLineDash([]);} // tunnel : tracé en pointillé
  ctx.lineWidth=3;ctx.strokeStyle='#6f9fcf';seg(TAG.st0,TAG.st1,X,Z);
  ctx.strokeStyle='#c9a45f';seg(S_LIFT0,S_LIFT1,X,Z);
  ctx.font='600 '+fs+'px system-ui,sans-serif';
  let p=at((TAG.st0+TAG.st1)/2);lab('Gare',p[0],p[1],'#8db4dc');
  p=at((S_LIFT0+S_LIFT1)/2);lab('Lift',p[0],p[1],'#d9bd82');
  BLK.forEach((b,i)=>{const held=trains.some(t=>t.st==='run'&&t.blk&&t.v===0&&Math.abs(t.s-b)<.5),closed=zK('B'+(i+1))||held;
    ctx.lineWidth=4.5;ctx.strokeStyle=closed?'#c0584a':'#6fa585';seg(b,b+Math.max(8,TLEN*.5),X,Z);p=at(b);lab(zName('B'+(i+1))+(BTRIM[i]?' ralentit':''),p[0],p[1],closed?'#e08a7c':'#8fc4a4');});
  if(RA||PSB||SG){ // zones de freinage après le dernier canton : ZF, rail mobile du parcours, ZP (rouge = serrée, ambre = train retenu, vert = libre)
    const hold=id=>trains.some(t=>t.st==='run'&&t.v===0&&tZone(t)===id);
    const zs=[[ZF,S_BRK,RA||SG?R0:PSB_A,zName(ZF)]].concat(RA?[['RA',R0,PSB?R1:L-1,'Rail parcours']]:SG&&circIn()?[['RB',R0,PSB?R1:L-1,'Rail du pont']]:[],PSB?[[ZP,PSB_A,L-.5,zName(ZP)]]:[]);
    for(const [id,a,b,nm] of zs){const k=zK(id),h=hold(id);
      ctx.lineWidth=4.5;ctx.strokeStyle=k?'#c0584a':h?'#d9a441':'#6fa585';seg(a,b,X,Z);p=at((a+b)/2);lab(nm,p[0],p[1],k?'#e08a7c':h?'#ecc275':'#8fc4a4');}
  }else{
    ctx.lineWidth=4.5;ctx.strokeStyle=zK(ZF)?'#c0584a':'#6fa585';seg(S_BRK,L-1,X,Z);p=at((S_BRK+L)/2);lab(zName(ZF),p[0],p[1],zK(ZF)?'#e08a7c':'#8fc4a4');
  }
  // repère du garage sur le plan
  ctx.strokeStyle='rgba(217,189,130,.7)';ctx.lineWidth=1;ctx.setLineDash([2,2]);ctx.strokeRect(X(gb.x0),Z(gb.z0),(gb.x1-gb.x0)*sc,(gb.z1-gb.z0)*sc);ctx.setLineDash([]);
  // encart garage (agrandi, cadré sur la zone)
  ctx.save();ctx.beginPath();ctx.rect(px+4,iy+3,pw-8,GH+TT-2);ctx.clip();
  ctx.lineWidth=2;ctx.strokeStyle='#9aa9c4';seg(Math.max(0,SW_A-5),Math.min(P.length-1,SW_B+5),GX,GZ);gap(GX,GZ,4);
  garage(GX,GZ,2);
  ctx.font='600 '+fs+'px system-ui,sans-serif';
  SYN.lanes.forEach((l,j)=>{const q=l[l.length-1],q0=l[Math.max(0,l.length-4)],dx=q[0]-q0[0],dz=q[1]-q0[1],d=Math.hypot(dx,dz)||1;ctx.fillStyle='#8a98b4';ctx.textAlign=Math.abs(dx/d)>.6?(dx>0?'left':'right'):'center';ctx.fillText(j+1,GX(q[0])+dx/d*5,GZ(q[1])+dz/d*8+3);});
  if(TRAV){const u=(R1-R0)/2,pt=v=>[GX(SW0.x+SW0.tx*u+SW0.vx*v),GZ(SW0.z+SW0.tz*u+SW0.vz*v)],vA=raC(),vB=devC()-GAP,qa=pt(vA),qb=pt(vB),L2=[[qb,SG?zName('RB')+(devMoving()?' en mouvement':G.dev.pos?' face à la voie '+G.dev.pos:' en ligne'):'Chariot','#d9bd82'],RA?[qa,'Rail parcours'+(raOut()?' retiré':raMoving()?' en mouvement':' en ligne'),'#a7b6d0']:null].filter(Boolean);
    const ax=Math.min(qa[0],qb[0]);for(const [q,t,c] of L2){const left=q[0]<=(RA?(qa[0]+qb[0])/2:1e9);ctx.fillStyle=c;ctx.textAlign=left?'right':'left';ctx.fillText(t,q[0]+(left?-9:9),q[1]+3);}}
  else{ctx.fillStyle='#d9bd82';ctx.textAlign='center';ctx.fillText(DEVN,GX(SW0.x),GZ(SW0.z)-7);}
  ctx.restore();
  // trains : numéro à leur position réelle (plan, et encart s'ils sont dans la zone du garage)
  ctx.font='700 '+(sm?9:10.5)+'px system-ui,sans-serif';ctx.textAlign='center';
  const mark=(t,x,y,r)=>{ctx.fillStyle=t.col;ctx.strokeStyle=cam.follow===t.i?'#fff':'rgba(10,16,28,.9)';ctx.lineWidth=cam.follow===t.i?2:1.5;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.stroke();
    const c=t.col.replace('#',''),lum=c.length>=6?(parseInt(c.slice(0,2),16)*.3+parseInt(c.slice(2,4),16)*.59+parseInt(c.slice(4,6),16)*.11):0;
    ctx.fillStyle=lum>140?'#101624':'#fff';ctx.fillText(t.i+1,x,y+3.4);SYN.hits.push({x,y,r:r+3,i:t.i});};
  for(const t of trains){const f=carFrame(t,NCARS>>1,_cf),inG=f.p.x>gb.x0&&f.p.x<gb.x1&&f.p.z>gb.z0&&f.p.z<gb.z1;
    if(t.st!=='garage')mark(t,X(f.p.x),Z(f.p.z),R);if(inG||t.st==='garage')mark(t,GX(f.p.x),GZ(f.p.z),R-1.5);}
  ctx.restore();
}

/* ══════════ DESSIN DANS L'IMAGE DU NOYAU (engine/noyau/decor.js drawWorld) ══════════ */
extension({nom:'montagnes-russes',
  dessin(e,D){const s=D.s,vis=D.vis,dry=D.dry;
    if(e==='sol'){if(WOODY){ctx.strokeStyle=TEX.dirt;ctx.globalAlpha=.85;ctx.lineWidth=8.5;ctx.stroke(dirtP);ctx.globalAlpha=1;}} // terre battue sous la charpente en bois
    else if(e==='ombres'||e==='ombresSurToit'){ // ombres de la voie, des trains et des passerelles de service, au sol ou sur le toit d'un bâtiment survolé
      for(const o of chunks)if(vis(o.x0,o.x1,o.z0,o.z1)&&!devHide(o)){const k=swPush(o);ctx.lineWidth=DECKW;ctx.stroke(o.sh);if(s>2.4){lw(BOB?.35:INV?.45:STL?.3:.2,.6);ctx.stroke(o.shb);}if(k)ctx.restore();}
      for(const t of trains)for(let k=0;k<NCARS;k++)if(!inTun(((t.s-(k+.5)*CAR)%L+L)%L))drawCar(t,k,true);
      if(CATW.walks.length||CATW.towers.length){if(e==='ombresSurToit')catwalkShadows();else{ctx.save();ctx.fillStyle=ctx.strokeStyle=`rgba(12,28,14,${.26*dry})`;catwalkShadows();ctx.restore();}}} // passerelles de service (aucune sur Zeus : rien ne change)
    else if(e==='gare'){(TRAV?drawTraverser:drawTable)();drawStationFloor(s);} // garage, sol de la gare et des quais
    else if(e==='portillons')drawGates();
    else if(e==='quai')drawStationPeople();}, // personnes du quai : au-dessus de la voie et des trains
  objets(items,dt,vis){ // voie + trains, triés par hauteur avec les rochers et passerelles du noyau
  for(const o of chunks)if(vis(o.x0,o.x1,o.z0,o.z1)&&!devHide(o))items.push(o);
  brakeState(dt);
  const hI=s=>chunkH[Math.floor((((s%L)+L)%L)/DS)%N];
  for(const t of trains){const ex=t.st==='run'&&zoneOf(t.s)==='course'&&t.v>9;t.arms=lerp(t.arms,ex?1:0,Math.min(1,dt*4));
    const cs=t.st==='run'?t.s:t.st==='station'?S_ST:null;
    for(let k=0;k<NCARS;k++){let h=INV?ST_Y-1.5:ST_Y+.05; // garage : au niveau des voies ; coaster inversé (issue #16, OzIris) : wagon suspendu SOUS la poutre des voies et du rail du pont, comme sur le circuit
      if(cs!==null){const sc=cs-(k+.5)*CAR,hs=[hI(sc-CAR/2),hI(sc),hI(sc+CAR/2)],up=t.st==='run'&&frameAt(sc,_cf).U.y<0;
        // le wagon est dessiné APRÈS tous les tronçons qu'il recouvre (le plus haut des trois + 5 cm) : jamais recouvert par sa propre voie, ses freins, sa chaîne ;
        // suspendu (coaster inversé) : AVANT sa voie ; tête en bas (looping, vrille) : après, avec ses rails redessinés par-dessus (drawCar)
        h=inTun(((sc%L)+L)%L)?-99:INV&&!up?Math.min(...hs)-1.5:Math.max(...hs)+.05;}
      items.push({h,t,k});}}
  for(const u of TUN)items.push({h:u.h,tun:u});
  for(const w of CATW.walks)for(const g of w.segs)items.push({h:g.h,cw:g});for(const t of CATW.towers)items.push({h:t.y-.02,tw:t});if(LIP)items.push({h:ST_Y+.02,lip:1});
  },
  dessinObjet(o,s){
    if(o.tun){drawTunnel(o.tun);return true;}
    if(o.cw){drawCatwalk(o.cw);return true;}
    if(o.tw){drawTower(o.tw);return true;}
    if(o.lip){drawLip();return true;}
    if(o.t){drawCar(o.t,o.k);return true;}
    const k=swPush(o);
    if(o.rp){ctx.fillStyle='rgba(0,0,0,.3)';ctx.save();ctx.translate(.25,.2);ctx.fill(o.rp);ctx.restore();ctx.fillStyle=BOB?TRO.edge:TKC.support||'#5b544a';ctx.fill(o.rp);} // poteaux sur le rocher
    if(BOB){ // gouttière en acier : bords sombres, fond clair, reflet au centre
      ctx.strokeStyle=TRO.edge;lw(.22,.7);ctx.stroke(o.str);
      if(o.lay){ctx.fillStyle=TRO.deck;ctx.fill(o.lay[0]);ctx.fillStyle=o.col;ctx.fill(o.lay[1]);ctx.fillStyle=TRO.shine;ctx.fill(o.lay[2]);} // gouttière de gare, rétrécie (TRF)
      else{ctx.strokeStyle=TRO.deck;ctx.lineWidth=DECKW;ctx.stroke(o.deck);ctx.strokeStyle=o.col;ctx.lineWidth=2;ctx.stroke(o.deck);
      ctx.strokeStyle=TRO.shine;ctx.lineWidth=.9;ctx.stroke(o.deck);}
      ctx.strokeStyle=TRO.rim;lw(.1,.5);ctx.stroke(o.rail);
    }else if(INV){ // équipements des zones de freinage SOUS la poutre (au niveau du chariot suspendu, issue #32), puis poutre caisson, rails, portiques et poteaux par-dessus
      drawBU(o);
      ctx.strokeStyle='rgba(20,24,30,.55)';ctx.lineWidth=DECKW+.25;ctx.stroke(o.deck);ctx.strokeStyle=TKC.spine;ctx.lineWidth=DECKW;ctx.stroke(o.deck);
      ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=.3;ctx.stroke(o.deck);
      ctx.strokeStyle=TKC.rail;lw(.14,.6);ctx.stroke(o.rail);
      ctx.strokeStyle=TKC.support;lw(.5,.8);ctx.stroke(o.str);lw(.7,1);ctx.stroke(o.hand);
    }else if(STL){ // supports en A, puis entretoises, rails tubulaires et poutre centrale (au-dessus des rails quand la voie est tête en bas)
      ctx.strokeStyle=TKC.support;lw(.34,.7);ctx.stroke(o.str);lw(.18,.6);ctx.stroke(o.hand);
      if(!o.inv){ctx.strokeStyle='rgba(20,24,30,.28)';ctx.lineWidth=DECKW+.35;ctx.stroke(o.deck);} // ombre sous la voie (tête en bas : voie ajourée, on voit le train dessous)
      ctx.strokeStyle=TKC.spine;lw(.1,.5);ctx.stroke(o.ties);if(!o.inv){lw(.16,.6);ctx.stroke(o.spine);}
      ctx.strokeStyle=TKC.rail;lw(.2,.7);ctx.stroke(o.rail);
      if(o.inv){ctx.strokeStyle=TKC.spine;lw(.22,.6);ctx.stroke(o.spine);}
    }else{
      ctx.strokeStyle='#6e6a63';lw(.16,.7);ctx.stroke(o.str);
      ctx.strokeStyle=o.col;ctx.lineWidth=DECKW;ctx.stroke(o.deck);
      if(s>2){ctx.strokeStyle='#5a4028';lw(.24,.5);ctx.stroke(o.ties);}
      ctx.strokeStyle='#e6cfa0';lw(.12,.5);ctx.stroke(o.hand);
      ctx.strokeStyle='#2b2b30';lw(.17,.9);ctx.stroke(o.rail);
    }
    if(!INV)drawBU(o);
    if(o.ch){ // chaîne du lift, même langage que les roues de friction (drawBU) : dimensions en pixels, couleurs sourdes, état lisible de loin (vert sourd = entraînée, gris = arrêtée, brique = bloquée par panne ou arrêt d'urgence)
      const px=1/s,pit=Math.max(3,27*px),lp=pit/3,dl=Math.max(.45,4*px),run=CHAINE.v>.01,bl=G.liftBroken||G.estop,far=s<3.2;
      ctx.lineCap='butt';ctx.strokeStyle=bl?'#6a3a33':run?'#4d6d58':'#3d4046';ctx.lineWidth=Math.max(.45,(far?4:6)*px);ctx.stroke(o.ch); // gouttière de la chaîne : le trait d'état
      if(!far){ctx.strokeStyle=bl?'#8a8780':run?'#a5a393':'#6f7074';ctx.lineWidth=Math.max(.3,3*px);ctx.setLineDash([lp*.5,lp*.1,lp*.3,lp*.1]);ctx.lineDashOffset=-(CHAINE.pv%pit);ctx.stroke(o.ch);} // maillons : intérieurs longs, extérieurs courts, en alternance
      ctx.strokeStyle=bl?'#a2574b':run?'#d6d0b8':'#9c9889';ctx.lineWidth=Math.max(.5,4.4*px);ctx.setLineDash([dl,pit-dl]);ctx.lineDashOffset=-(CHAINE.pv%pit);ctx.stroke(o.ch);ctx.setLineDash([]);ctx.lineDashOffset=0;} // taquets (chiens) plus larges que la chaîne : ils défilent avec elle, immobiles si elle est arrêtée ou bloquée
    if(k)ctx.restore();return true;},
  surQuai:k=>onPlat(k)}); // marcheur dessiné avec les personnes du quai
