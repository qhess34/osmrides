/* Point d'entrée du moteur (docs/versions.md, docs/ARCHITECTURE.md D14). Le jeu charge seulement ce fichier, local (engine/moteur.js)
   ou en ligne à une version (https://cdn.jsdelivr.net/gh/qhess34/osmrides@0.1.0/engine/moteur.js) ; il charge ensuite les autres fichiers, dans l'ordre,
   en scripts classiques (file://, ni module ni fetch). Trois couches :
   - noyau/ : commun à tous les jeux (carte, visiteurs, file, zone d'attente, météo, partie, sauvegarde), depuis le dossier de ce fichier ;
   - les couches de SITE.extensions, dans l'ordre : un nom (dossier voisin de ce fichier : 'voies', 'montagnes-russes') ou un chemin finissant par « / »,
     relatif à jeu.html (couche prise dans le dépôt du jeu). Sans SITE.extensions : ['voies','montagnes-russes'] (TRANSITOIRE, jeux d'avant 0.1.0).
   Ordre : noyau de base, puis le manifeste de chaque couche (<dossier>/extension.js, qui déclare ses fichiers par étape), puis, étape par étape, les fichiers
   du noyau suivis de ceux de chaque couche. Un fichier ajouté au moteur n'oblige pas à changer les jeux. */
(function(){
  const base=document.currentScript.src.replace(/[^/]*$/,'');
  const ETAPES=['modele','reseau','personnes','interface','carte','decor','fin']; // modèle (voie, véhicules, zones d'attente déclarées par le type), réseau (garage, appareils, commande par zones, puis
  // l'exploitation du type), visiteurs, pupitre, carte, décor et image, démarrage
  const NOYAU={base:['base','attente'],personnes:['personnes'],interface:['partie','interface'],carte:['carte'],decor:['decor'],fin:['demarrage','sauvegarde']};
  const COUCHES=(typeof SITE!=='undefined'&&Array.isArray(SITE.extensions)?SITE.extensions:['voies','montagnes-russes']).map(c=>/\/$/.test(c)?c:base+c+'/');
  const charge=(src,ok)=>{const s=document.createElement('script');s.src=src;s.onload=ok;
    s.onerror=()=>{document.body.innerHTML='<p style="padding:2em;color:#fff">Moteur incomplet : '+s.src+' introuvable.</p>';};document.body.appendChild(s);};
  const suite=(L,i,fin)=>i>=L.length?fin():charge(L[i],()=>suite(L,i+1,fin));
  const F=[]; // fichiers de chaque couche, par étape (manifeste)
  const manifeste=i=>{if(i>=COUCHES.length)return etapes();const n=EXTENSIONS.length;
    charge(COUCHES[i]+'extension.js',()=>{const d=EXTENSIONS.slice(n).find(e=>e.fichiers);F.push(d?d.fichiers:{});manifeste(i+1);});};
  const etapes=()=>{const L=[];for(const e of ETAPES){for(const f of NOYAU[e]||[])L.push(base+'noyau/'+f+'.js');COUCHES.forEach((c,i)=>{for(const f of F[i][e]||[])L.push(c+f+'.js');});}
    suite(L,0,()=>{});};
  suite(NOYAU.base.map(f=>base+'noyau/'+f+'.js'),0,()=>manifeste(0));
})();
