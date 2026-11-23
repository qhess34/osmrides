/* Point d'entrée du moteur (docs/versions.md). Le jeu charge seulement ce fichier, local (engine/moteur.js)
   ou en ligne à une version (https://cdn.jsdelivr.net/gh/qhess34/osmrides@0.0.1/engine/moteur.js) ;
   il charge ensuite les autres fichiers du moteur, dans l'ordre, depuis le même dossier.
   La liste suit la version : un fichier ajouté au moteur n'oblige pas à changer les jeux. */
(function(){
  const FICHIERS=['core','garage','state','queue','sim','ui','render','save'];   // même ordre que tools/build.py
  const base=document.currentScript.src.replace(/[^/]*$/,'');
  const suite=i=>{
    if(i>=FICHIERS.length)return;
    const s=document.createElement('script');
    s.src=base+FICHIERS[i]+'.js';
    s.onload=()=>suite(i+1);
    s.onerror=()=>{document.body.innerHTML='<p style="padding:2em;color:#fff">Moteur incomplet : '+s.src+' introuvable.</p>';};
    document.body.appendChild(s);
  };
  suite(0);
})();
