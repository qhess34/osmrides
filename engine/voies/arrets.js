'use strict';
/* ══════════ ARRÊTS ET ZONES D'ATTENTE (docs/manoeuvres.md, issue #36) ══════════
   Zones toutes équivalentes (propriétaire, issue #36) : l'arrêt (gare, 'St') est une zone d'attente comme les autres ; entre deux zones d'attente consécutives,
   un canton ordinaire. Le type les déclare dans l'ordre de marche (VOIES.attentes, engine/voies/reseau.js) : montagnes russes, gare, puis zones de freinage
   B1…Bm (toutes ordinaires). Le garage est branché sur l'une d'elles, YZ (VOIES.raccord) ; ANCH = point d'arrêt de l'avant du véhicule dans
   cette zone (point de raccordement). Un seul arrêt aujourd'hui ; plusieurs arrêts sur un réseau : à écrire avec le type qui en aura besoin. */
const ATT={};for(const a of VOIES.attentes)ATT[a.id]=a;
const WZ=VOIES.attentes.map(a=>a.id); // zones d'attente du circuit, dans l'ordre de marche
const zStop=z=>(ATT[z]||{}).s; // point d'arrêt de l'avant du véhicule dans une zone d'attente
const YZ=VOIES.raccord,ANCH=zStop(YZ);
const dnS=(a,b)=>(((b-a)%L)+L)%L; // distance de a à b vers l'aval, le long du circuit
const zArt=z=>ATT[z]&&ATT[z].dit||'« '+zName(z)+' »'; // nom d'une zone d'attente dans une phrase
const zSur=z=>{const a=zArt(z);return /^le /.test(a)?'au '+a.slice(3):'sur '+a;}; // « au frein 2 », « sur la gare »
const ANCH_NAME=zArt(YZ),ANCH_ON=YZ==='St'?'à quai':zSur(YZ); // « arrêté à quai / au frein 2 »
