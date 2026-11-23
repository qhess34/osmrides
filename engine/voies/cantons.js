'use strict';
/* Cantonnement FACULTATIF (propriétaire, 23/11) : activé par le type (extension({voies:{cantonnement:true}}) : montagnes russes) ; sans lui, les véhicules roulent
   à vue (un tram ou un bus pourra rattraper celui qui le précède : à écrire avec ce type). Canton [a, b] : un véhicule y est si son avant est entre a et b + sa longueur. */
const VOIES={cantonnement:EXTENSIONS.some(e=>e.voies&&e.voies.cantonnement)};
// véhicules (st 'run', abscisse s) autres que self dans le canton [a, b] ; aucun sans cantonnement
const dansCanton=(a,b,self,vehicules,long)=>VOIES.cantonnement?vehicules.filter(o=>o!==self&&o.st==='run'&&o.s>a&&o.s<b+long):[];
