'use strict';
/* Couche « montagnes-russes » (docs/ARCHITECTURE.md D14) : propre au type. Profil en hauteur, dévers, inversions, tunnels, supports, physique (pente, roulement,
   traînée), lift, freins de bloc, frein avant gare, frein final (déclarés à engine/voies/ comme zones d'attente : train.js), portillons, sécurités, opérateurs,
   quai à portillons et travées ; tout le dessin de la voie, des trains, du garage, du pont transbordeur, de la gare et du quai ; pupitre par zones.
   Ce fichier est le manifeste lu par engine/moteur.js : fichiers de la couche par étape (noms relatifs à ce dossier), clés de SITE surchargeables par GAME.site. */
// Couleur de la voie lue dans OSM (colour des tronçons du circuit, OSM.attrs role 'track', valeur dominante par longueur, issue #46) : couleur de l'épine (SITE.track.spine) d'un coaster inversé ou acier ; priorité GAME > OSM > SITE.
(()=>{if(typeof OSM==='undefined'||!Array.isArray(OSM.attrs)||typeof SITE==='undefined'||!SITE.track)return;const m={};for(const a of OSM.attrs)if(a&&a.role==='track'&&a.h&&a.h.colour)m[a.h.colour]=(m[a.h.colour]||0)+(a.l||1);const b=Object.keys(m).sort((x,y)=>m[y]-m[x])[0];if(b)SITE.track.spine=b;})();
extension({nom:'montagnes-russes',
  surcharges:['kind','car','trains','track','trough','phys','lap','stopBack','maxRun','preBrake','zones','yard','plat','holdBack','dropAfter','loadSide'], // GAME.site (docs/ARCHITECTURE.md D9), fusionnées ici, avant tout calcul de la couche
  voies:{cantonnement:true}, // un train n'entre dans un canton que s'il est libre (engine/voies/cantons.js)
  fichiers:{modele:['train','quai'],reseau:['zones','etat','exploitation'],interface:['pupitre'],carte:['voie-dessin'],decor:['dessin']},
  textes:{bilanCorrect:'Exploitation correcte. Un second train et moins de pannes feraient mieux.',bilanDifficile:'Exploitation difficile. Ouvrez l\'entrée et sortez le second train.'}});
