# Banc d'essai et micro-tests

Quand la lire : toute vérification d'un correctif du moteur, ajout d'un test, ou doute sur ce qui doit être lancé avant de dire « c'est fait ».

Propriétaire, 27/11 : alléger la consommation de tokens, moteur générique, tests **unitaires** sur la partie qui pose problème (un souci d'affichage d'un coaster inversé se vérifie sur une portion de coaster inversé, pas sur une journée d'un parc). La règle d'usage (quel test pour quel cas) est écrite une seule fois, dans `AGENTS.md`, « Vérifier avant de dire que c'est fait ».

## Contenu (`tools/banc/`, aucune donnée de parc, aucun réseau)

| Fichier | Rôle |
|---|---|
| `banc.html` | page de jeu minimale (même squelette DOM que `jeu.html` des jeux, sans style de jeu). `banc.html?site=<site.js>[&moteur=<dossier engine/>][&mode=sandbox\|career]` : charge `site.js` (qui déclare `OSM` et `SITE`) puis le moteur local `../../engine/moteur.js` (`file://`, comme un jeu). Définit `cleSauvegarde` (le catalogue des jeux la fournit) |
| `constructeur.js` | fabrique un mini-site synthétique : circuit fermé d'environ 207 m (gare de 14 m, lift de 8 m, descente, retour en zone finale `brk`/`fin`), file, sortie, garage (le moteur exige `SITE.yard`). `ecrire(dossier, options)` écrit `site.js` ; `construire(options)` rend `{OSM, site}` |
| `lib.js` | `essai(nom, corps)` : lance Chromium, passe `ouvrir(options, {mode, width, height})` (page prête, vitesse 0, météo figée) et `ok(nom, condition, info)` au corps du test ; une ligne `ok` / `FAIL` par assertion, `PASS` / `FAIL (n)`, toute erreur de page échoue. Trouve Playwright seul |
| `*.test.js` | un micro-test par fonction (ci-dessous) |
| `../batterie.js` | lance les micro-tests l'un après l'autre : une ligne par test (nom, PASS / FAIL, durée, première assertion en échec) puis un total |

Options du constructeur (toutes fausses par défaut) : `inverse` (coaster inversé), `passerelle` (passerelles de service du lift, plancher galvanisé sous la voie d'un inversé), `toit` (bâtiment `building=roof` de la gare, tags de toit), `quai` (zone `railway=platform`), `quaiCourt` (gare taguée de 4 m, plus courte que le train de 6 m), `tranchee` (`man_made=excavation` niveau -2 béton, voie de niveau -1 sur s 120-150), `structure` (deux `man_made=structure` en acier, niveaux -1 et 1), `freins` (zone de bloc B1, repères `bz1`/`blk1`), `montee` (B1 en montée, bosse de 3 m), `pont` (pont transbordeur, rail mobile, à la place de l'aiguillage), `railsS` (aiguillage à deux groupes de rails `yard.rails` : tronçon droit seul, tronçon en S seul), `wagons` (4), `trains` (2). Une option = un objet OSM ou un réglage de `SITE` ; en ajouter une quand un nouveau défaut en demande une.

## Micro-tests

| Test (`--seulement=`) | Vérifie | Commit du défaut |
|---|---|---|
| `passerelle` | ordre de dessin d'un plancher de passerelle et du train : inversé, plancher avant le train suspendu ; assis, passerelle latérale avant le wagon (journal des appels `drawCatwalk` / `drawCar`) | c554d7b |
| `freins` | mâchoires de frein (`BZS[zone].c`) : écartées zone libre, serrées en MANU, serrées sur un train retenu, restées écartées sur un train qui ralentit seul en montée (`brakeState`, `freeA`) | 7fb216f, abc21dc |
| `lift` | chaîne du lift : AUTO (démarre à l'approche, rampe de 3 s, s'arrête 4 s après), MANU (marche, arrêt, refus en AUTO), blocage net par panne ou arrêt d'urgence ; taquets dessinés gris / clairs / brique (appels `stroke`), phase `CHAINE.pv` | 3287a2f |
| `gare` | gare lue dans OSM : quai = zone `railway=platform` (profondeurs lues), toit = bâtiment OSM, arrêt le long du quai plus court que le train, places d'attente jamais superposées, zone d'attente éditée trop courte | f1ed74a |
| `niveaux` | tranchées, voie de niveau -1 (`PROF_AFF`), structures `man_made=structure` lues et dessinées ; rien sans objet OSM | #68 |
| `tour` | un tour complet (gare, lift, bloc, zone finale, retour) sans erreur de page : assis, inversé + passerelle, pont, gare / tranchée / structures | |
| `aiguillage-rails` | aiguillage coulissant (osmrides#72) : sans `yard.rails`, groupe unique inchangé et défaisable ; deux groupes : S seul déplacé, circuit passant tant que le tronçon droit est en ligne, S refusé sur la voie tant que le tronçon droit est en ligne, train retenu en gare quand aucun rail n'est en ligne, tronçon droit bloqué tant que le S est en ligne | |

Chaque test a été vérifié sur un défaut réel : moteur d'avant le correctif (`git revert --no-commit` de c554d7b, abc21dc, f1ed74a dans un worktree) ou défaut introduit à la main dans une copie du moteur ; il échoue alors, sans sortie de captures. Un test pour une option du constructeur ne dépend d'aucune attraction : il tourne en 1 à 5 s (le dessin coûte 8 ms l'image, donc quelques images seulement : un rendu tous les 2 à 5 pas).

Non couvert : groupes de rails mobiles de l'éditeur (`editor-test.js`, serveur nécessaire : inchangé) ; sauvegarde, interface mobile et parcours des visiteurs (tests des parcs, ci-dessous).

## Commandes

- `node tools/batterie.js` : tous les micro-tests (10 s environ). `--seulement=<nom>` : un seul (nom contenant la valeur). Variable `MOTEUR=<dossier engine/, chemin absolu>` : essayer un autre moteur (version publiée, worktree d'avant un correctif).
- `node tools/batterie.js --parcs=<dépôt de jeu> [--attractions=hourra,zeus]` : ajoute `check.js`, `save.js`, `mobile.js` de chaque attraction (défaut : zeus, hourra, oziris, goudurix), une après l'autre, avec le moteur local. **Piège** : `jeu.html` des parcs n'accepte le moteur local que sous la forme d'un chemin relatif commençant par `../` (`a-z 0-9 _ . / -` seulement) ; tout autre forme (chemin absolu…) retombe en silence sur le moteur publié. La batterie calcule le chemin relatif elle-même et vérifie dans le navigateur que `moteur.js` vient de ce dépôt avant de lancer le moindre test des parcs (échec sinon).
- Réservées à l'adoption ou à la publication d'une version, une seule fois (`AGENTS.md`).

## Limites

- `banc.html` copie le squelette DOM de `jeu.html` des jeux : un identifiant ajouté à l'interface du moteur doit y être ajouté (l'oubli se voit à une erreur de page à l'ouverture).
- Le site fabriqué n'a ni parc, ni plan, ni catalogue : la sauvegarde (`cleSauvegarde`) et les lieux ne sont pas testés ici.
