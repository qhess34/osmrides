# Hiérarchie du jeu : type → lieu → éléments (analyse, issue #48)

Statut (23/11) : migration faite (étapes 1 à 5 de §3), réponses du propriétaire du 23/11 : URL en français `type` / `lieu` / `el` ; fichiers déplacés tout de suite ; second lieu prévu = station de ski Vars Les Claux (pas encore fait) ; station = lieu, remontées = éléments ; **aucune compatibilité** des anciens liens `?site=` ni `parc.html` ; migration unique des sauvegardes au chargement (`lieux/index.js`). Réalisé en KISS : un seul `lieux/index.js` (catalogue) au lieu d'un `lieu.js` par lieu ; `plan.html` remplace `parc.html` ; l'éditeur ne gère que `lieux/parc/asterix/`. Le reste du texte est l'analyse d'origine. Vision : `docs/ROADMAP.md`.

Hiérarchie voulue : **type (n) → lieu (n) → éléments (n)**.
- Type « parc d'attractions » : lieux Parc Astérix, un autre parc… ; éléments = attractions.
- Type « transports » : lieux = réseaux ; éléments = lignes.
- Type « domaine skiable » : lieux = stations (par exemple Val d'Isère, « stations vas » dans l'issue) ; éléments = remontées.

## 1. Situation actuelle

Tout est implicitement « Parc Astérix », avec un seul niveau : l'attraction, appelée `site`.

- `jeu.html?site=zeus` : `jeu.html` lit `site` (défaut `zeus`), charge `sites/<site>.data.js`, `.js`, `.game.js` puis `engine/*.js`. Aucun lieu ni type dans l'URL.
- `sites/` : 4 attractions à plat (zeus, hourra, oziris, goudurix), 3 fichiers chacune, plus `tools/specs/<site>.json`.
- `index.html` : écran titre « Parc Astérix » en dur ; 4 vignettes `a.card[data-site]` écrites à la main ; fond canvas = `parc/parc.data.js` (`PARK`).
- `parc.html` + `parc/parc.data.js` : plan du Parc Astérix, généré par `tools/make_park.py` ; une attraction avec `site` ouvre `jeu.html?site=…`.
- Sauvegarde : `t2z.save.<site>.<mode>` (`engine/save.js`, `SITE.id`) ; `t2z.mode` global.
- Moteur : générique sur le papier, mais le vocabulaire (train, gare, lapbars, frein final, canton) est celui des montagnes russes et des bobsleighs ; `OSM.cps` suppose une voie ferrée à `st0/st1/lift0/lift1/brk`.

Conséquence : un deuxième parc, un réseau de bus ou une station de ski n'ont aucune place dans les noms de fichiers, l'URL ou l'écran titre.

## 2. Proposition KISS

Principe : on n'invente pas de moteur nouveau. On ajoute deux niveaux de rangement autour de ce qui existe, et on garde le niveau « élément » tel quel.

### 2.1 Dossiers

```
lieux/
  parc/                      type
    asterix/                 lieu
      lieu.js                LIEU={nom, type, bbox, plan:'plan.data.js', elements:[{id,nom,resume}]}
      plan.data.js           ex-parc/parc.data.js (généré)
      zeus.data.js  zeus.js  zeus.game.js     éléments (ex-sites/)
      hourra.* oziris.* goudurix.*
  transport/                 (plus tard) type
    <reseau>/ <ligne>.*
  ski/                       (plus tard) type
    <station>/ <remontee>.*
engine/                      moteur commun (inchangé)
engine/types/parc.js         (plus tard) ce qui est propre au type
```

Un élément garde ses 3 fichiers (`.data.js` généré, `.js` écrit à la main, `.game.js` écrit par l'éditeur). Un lieu ajoute `lieu.js` (nom, emprise, liste des éléments) et son plan. Pas de base de données, pas de `fetch` : tout reste chargé par balises `<script>` (`file://`).

### 2.2 URL

- Nouveau : `jeu.html?type=parc&lieu=asterix&el=zeus&mode=sandbox`.
- `plan.html?type=parc&lieu=asterix` remplace `parc.html` (le plan du lieu, même code, données du lieu).
- `index.html` (types) → `lieux.html?type=parc` (liste des lieux) → `lieu.html?type=parc&lieu=asterix` (éléments du lieu).
- Compatibilité : `jeu.html?site=zeus` reste valide pour toujours = `type=parc&lieu=asterix&el=zeus` (table de correspondance de 4 lignes dans `jeu.html`). `parc.html` reste une redirection. Les pages tutoriels et le PWA gardent leurs liens.

### 2.3 Sauvegardes

- Nouvelle clé : `t2z.save.<type>.<lieu>.<el>.<mode>`.
- Lecture : si la nouvelle clé est absente et que `type=parc` et `lieu=asterix`, on lit l'ancienne `t2z.save.<el>.<mode>` (sans la supprimer), puis on écrit sous la nouvelle clé. Aucune partie perdue ; l'ancienne clé peut être effacée plus tard, sur décision du propriétaire.
- `SITE.id` reste l'identifiant de l'élément ; on ajoute `SITE.type` et `SITE.lieu`.

### 2.4 Générique ou propre au type

| Commun à tous les types | Propre au type |
|---|---|
| Lecture et import OSM, `make_site.py`, tracé et abscisse `s`, caméra, rendu des sols et chemins, visiteurs sur chemins et files, cantonnement et commande par zones, sauvegarde, éditeur, synchronisation vers OSM | Parc : gare, quai, portillons, lapbars, file, garage, météo, budget. Transports : arrêts, voyageurs, horaires, correspondances. Ski : télésièges, gares amont / aval, débit, neige, pistes |

Règle : on ne déplace rien tant qu'un second type n'existe pas. Quand il arrive, on sort du moteur actuel ce qui est du vocabulaire « parc » vers `engine/types/parc.js` (le moteur ne se coupe qu'au besoin, pas par avance).

### 2.5 Ce qu'on lit dans OSM à chaque niveau

- **Type** : rien (choix du jeu).
- **Lieu** : un parc = relation ou way `leisure=theme_park` (+ `name`, `wikidata`, emprise pour `bbox`). Un réseau = relation `type=network` (`network=*`) ou agrégat de lignes. Un domaine = zone `landuse=winter_sports` ou relation `site=piste` / `type=site`, `name`. Sert au nom, à l'emprise, au plan.
- **Élément** : une attraction = ways `roller_coaster=track`, gare, file, sortie (déjà fait, `docs/OSM-GUIDE.md`). Une ligne = relation `route=bus|tram|subway|train` avec arrêts `public_transport=stop_position|platform`. Une remontée = way `aerialway=chair_lift|gondola|drag_lift…` avec `aerialway=station`, pylônes `aerialway=pylon` ; pistes voisines `piste:type=downhill`.

### 2.6 Écran titre à 3 niveaux

1. Types : cartes « Parcs d'attractions », (plus tard) « Transports », « Domaines skiables ». Un type sans lieu jouable est grisé.
2. Lieux du type : cartes ou liste (Parc Astérix, …) avec le plan en fond comme aujourd'hui.
3. Éléments du lieu : les vignettes actuelles ; « Plan du lieu » ; « Partie en cours » (Continuer retrouve la dernière sauvegarde, tous types confondus).

Avec un seul type et un seul lieu, les niveaux 1 et 2 se sautent : l'écran actuel reste identique tant qu'on n'a pas d'autre parc.

## 3. Migration en étapes courtes

Chaque étape est livrable seule ; vérification : `tools/check.js` ×4, `tools/save.js`, `tools/mobile.js`, `tools/editor-test.js`, aucun `pageerror`.

1. **Lecture de l'URL** : `jeu.html` accepte `type/lieu/el` en plus de `site`, sans bouger de fichiers. Test : les deux URL ouvrent la même partie.
2. **Sauvegarde à deux clés** : nouvelle clé + lecture de l'ancienne. Test : `tools/save.js`, plus une partie créée avant la migration reprise après.
3. **Déplacer les fichiers** vers `lieux/parc/asterix/` (sites/ et parc/), mettre à jour `jeu.html`, `make_site.py`, `make_park.py`, éditeur, `pages.yml`, `sw.js`, `tools/*`. Test : les 4 attractions, éditeur compris.
4. **`lieu.js`** : liste des éléments et nom du lieu lus par `index.html` et le plan, vignettes générées au lieu d'être écrites à la main.
5. **Écran titre à 3 niveaux** et `plan.html` générique (`parc.html` redirige). Test : mobile, `index` sans lieu supplémentaire = rendu actuel.
6. **Premier second lieu du même type** (autre parc) : valide que le rangement tient, sans toucher au moteur.
7. **Premier second type** (une ligne ou une remontée) : seulement alors on sépare `engine/types/`. Étude à part, sur demande du propriétaire.

## 4. Questions au propriétaire

1. Garder « parc » en minuscules dans les URL (`type=parc`) et tout en français (`lieu`, `el`) : d'accord ?
2. Faut-il déplacer les fichiers (étape 3) tout de suite, ou garder `sites/` et ne changer que l'URL, l'écran titre et les sauvegardes, tant qu'il n'y a pas de second lieu ?
3. Quel second lieu ou type voulez-vous en premier (un autre parc, une station de ski, une ligne de transport) ? Cela fixe ce qu'on lit dans OSM et le premier vocabulaire à sortir du moteur.
4. « stations vas » : une station (par exemple Val d'Isère) = un lieu et ses remontées = les éléments ; est-ce bien cela ?
5. Les anciens liens `?site=` et les anciennes sauvegardes doivent-ils rester valables indéfiniment ?
