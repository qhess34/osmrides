'use strict';
/* ══════════ BOUCLE ET DÉMARRAGE ══════════ */
let last=performance.now(),uiT=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  const modal=!$('mHelp').classList.contains('hidden')||!$('mBil').classList.contains('hidden')||!$('mNew').classList.contains('hidden');
  if(!modal)for(let i=0;i<G.speed;i++)step(dt);
  render(modal?0:dt);
  uiT+=dt;if(uiT>.12){uiT=0;ui();}
  requestAnimationFrame(frame);
}
document.title=SITE.title+' — Simulateur d\'exploitation';$('ttl').textContent=SITE.title;$('helpTtl').textContent=SITE.title+' — à vous les commandes';
log('Bienvenue sur '+SITE.title+' !'+appel('accueil').map(t=>' '+t+'.').join('')+' Ouvrez l\'entrée pour commencer.','good');
ui();requestAnimationFrame(frame);
Object.assign(window,{G,act,step,cam,render,ui});
