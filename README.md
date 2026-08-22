# Conquête Tribale — multijoueur

Serveur Node.js (aucune dépendance externe) + client web pour un monde partagé
en temps réel, avec de vrais comptes joueurs (pseudo + mot de passe) et du
combat PvP entre villages.

## Lancer en local

```
npm start
```
(ou directement `node server/server.js`)

Puis ouvrez `http://localhost:3000` dans votre navigateur. Le port peut être
changé avec la variable d'environnement `PORT`.

Les données de la partie (comptes, villages, missions...) sont stockées dans
`data/db.json`, créé automatiquement au premier lancement.

## Mettre le jeu en ligne (accessible à de vrais joueurs)

Ce jeu tourne dans un environnement cloud sans accès réseau sortant, donc
il ne peut pas être déployé directement depuis cette conversation. Voici le
moyen le plus simple de le mettre en ligne vous-même, gratuitement :

### Option recommandée : Render.com (gratuit)

1. Créez un compte sur [render.com](https://render.com) (gratuit).
2. Créez un nouveau dépôt Git (GitHub, GitLab...) et poussez-y le contenu de
   ce dossier `tribal-mmo/`.
3. Sur Render, cliquez « New + » → « Web Service », reliez le dépôt.
4. Render détecte Node.js automatiquement :
   - Build Command : (laisser vide, ou `npm install`)
   - Start Command : `node server/server.js`
5. Déployez. Render vous donne une URL du type
   `https://votre-jeu.onrender.com` — c'est le lien à partager à vos joueurs.

**Important — persistance des données entre redéploiements** : sur le plan
gratuit de Render, le disque est réinitialisé à chaque redéploiement (mais pas
entre deux requêtes normales — vos joueurs ne perdent rien tant que vous ne
redéployez pas). Pour que les comptes survivent aux redéploiements SANS payer
pour un disque persistant, le serveur sait sauvegarder automatiquement
`data/db.json` dans un Gist GitHub privé et le restaurer au démarrage si le
disque local est vide — voir « Persistance gratuite entre redéploiements »
ci-dessous. Sans cette configuration, un redéploiement effacera les comptes
comme avant. L'alternative payante reste d'ajouter un « Persistent Disk » sur
Render (quelques dollars/mois) monté sur `data/`, ou de migrer vers
Railway/Fly.io qui proposent des volumes persistants même gratuitement.

### Persistance gratuite entre redéploiements (recommandé)

Sans configuration supplémentaire, chaque redéploiement Render (plan gratuit)
efface tous les comptes. Pour l'éviter sans payer :

1. Allez sur [github.com/settings/tokens](https://github.com/settings/tokens)
   et créez un jeton d'accès personnel (« Personal access token ») avec
   **uniquement le scope `gist`** (aucun accès aux dépôts n'est nécessaire —
   plus le jeton a de droits, plus il est risqué s'il fuit un jour).
2. Sur Render, allez dans votre service → **Environment** → **Add Environment
   Variable**, et ajoutez `GITHUB_BACKUP_TOKEN` avec ce jeton comme valeur.
3. Redéployez une fois. À partir de là, le serveur sauvegarde automatiquement
   l'état du jeu dans un Gist GitHub **secret** (non listé publiquement, mais
   pas chiffré) toutes les ~60 secondes après un changement, et le restaure
   tout seul si un futur redéploiement repart d'un disque vide.

Sans cette variable, le jeu fonctionne exactement comme avant (aucune
sauvegarde distante, comptes perdus à chaque redéploiement). Ce jeton donne
seulement accès à vos Gists — jamais à vos dépôts de code ni à votre compte —
mais gardez-le secret comme n'importe quel mot de passe : ne le partagez pas,
ne le committez pas dans le dépôt.

### Alternative : Railway.app

Même principe : connectez votre dépôt Git, Railway détecte Node.js et lance
`npm start` automatiquement. Railway propose des volumes persistants même sur
son plan gratuit limité.

### Alternative : sur votre propre machine / VPS

```
npm start
```
puis exposez le port (redirection de port sur votre box, ou un tunnel comme
`ngrok http 3000` / `cloudflared tunnel`) pour le rendre accessible depuis
l'extérieur.

## Structure du projet

```
tribal-mmo/
├── package.json
├── shared/gameData.js       # formules de jeu partagées client + serveur
├── server/
│   ├── server.js            # serveur HTTP (routes API + fichiers statiques)
│   ├── auth.js              # hachage de mot de passe + jetons de session
│   ├── store.js             # génération du monde + persistance JSON
│   ├── gameLogic.js         # actions joueur, combats, tick périodique
│   └── backup.js            # sauvegarde/restauration distante (Gist GitHub)
├── public/
│   └── index.html           # client web (interface + logique d'affichage)
└── data/                    # créé automatiquement (db.json, secret.txt)
```

## Panneau Admin et Chat mondial

- **Chat mondial** : un widget de discussion flottant (en bas à gauche) est visible par tous les
  joueurs connectés, avec actualisation automatique toutes les ~2,5 secondes (au rythme du reste
  du jeu).
- **Panneau d'administration** : cliquez sur l'onglet **Aide**, section « Devenir administrateur »,
  et saisissez le code défini par la variable d'environnement `ADMIN_SECRET` (si elle n'est pas
  définie, le code par défaut est `changeme-admin-secret` — à changer impérativement en production).
  Une fois le code validé, un onglet **Admin** apparaît (uniquement pour ce compte) permettant de :
  - lister tous les joueurs et leur village (avec un champ de recherche) ;
  - définir ou ajouter des ressources à un village, ou à **tous les joueurs en une fois** ;
  - modifier directement les niveaux de bâtiments et le nombre de troupes ;
  - terminer instantanément la file de construction ou d'entraînement d'un joueur ;
  - régler un multiplicateur de vitesse mondial — s'applique **immédiatement à tout** : production
    de ressources, files déjà en cours et nouvelles files (temps divisé par ce facteur) ;
  - publier une **annonce** qui apparaît aussitôt dans la boîte de rapports de tous les joueurs ;
  - promouvoir ou révoquer les droits administrateur d'un autre compte ;
  - voir la liste des **missions en cours** (attaques, reconnaissances, soutiens...) et forcer la
    résolution/arrivée immédiate de l'une d'entre elles.

  Un joueur non-administrateur ne voit jamais cet onglet ni ces actions.

## Conquête par Noble

Envoyer un Noble seul contre un village pour le conquérir est très risqué : le
Noble a une chance de survie qui **augmente avec la puissance de l'escorte**
envoyée avec lui (plus vous dominez le combat, plus il est protégé). Un Noble
envoyé sans escorte suffisante contre une défense sérieuse a de bonnes chances
de mourir ; avec une escorte largement supérieure à la défense adverse, ses
chances de survie sont élevées (mais jamais garanties à 100%).

Une Académie permet de former jusqu'à **4 Nobles vivants à la fois dans le
village qui l'a construite** (chaque village conquis peut avoir la sienne et
former les siens séparément). En revanche, **une seule attaque ne peut
emporter qu'un seul Noble à la fois**, quel que soit le nombre disponible au
village — l'escorte reste le principal facteur de survie.

## Plusieurs villages : gérer un village conquis

Un village barbare conquis par un Noble devient un village de joueur à part
entière : il peut être **amélioré exactement comme votre premier village**
(bâtiments, files de construction, entraînement de troupes...), avec ses
**propres ressources et ses propres troupes**, totalement indépendantes de
vos autres villages.

- Dès que vous possédez plus d'un village, un **sélecteur** apparaît en haut
  de l'écran (à côté du nom du village) pour choisir celui que vous gérez
  actuellement — les onglets Bâtiments et Caserne agissent toujours sur le
  village actuellement sélectionné.
- Sur la carte, cliquez sur un de vos villages conquis puis sur **« Gérer ce
  village »** pour basculer directement dessus et l'améliorer.
- Un don de ressources reçu arrive toujours dans votre village d'origine
  (votre capitale), et des renforts rappelés reviennent toujours au village
  qui les avait envoyés à l'origine — quel que soit le village que vous êtes
  en train de gérer au moment du rappel.

## File de construction (une seule à la fois) et annulation

Une seule construction est réellement en cours à la fois dans un village, quel que soit le
bâtiment : les suivantes commandées attendent leur tour dans la file (jusqu'à 6), chacune démarrant
exactement à la fin de la précédente. Chaque élément de la file (dans la barre latérale) a un bouton
✖ pour l'**annuler** : les ressources sont intégralement remboursées et les éléments suivants sont
réenchaînés correctement (celui qui devient le premier de la file démarre alors immédiatement).

## Guildes

Un joueur peut fonder ou rejoindre une guilde depuis le nouvel onglet **Guilde** :

- Le chef d'une guilde peut **inviter** un joueur par son pseudo (l'invitation apparaît dans la boîte
  de rapports du joueur invité, avec des boutons Rejoindre/Refuser), et **exclure** un membre.
- Tout membre peut **quitter** la guilde à tout moment ; si le chef part, la direction est transmise
  automatiquement au membre restant le plus ancien (ou la guilde est dissoute s'il était seul).
- Construisez un **Hall de guilde** dans votre village (jusqu'au niveau 5) pour pouvoir **donner des
  ressources** à la guilde — chaque don augmente définitivement un bonus de production partagé par
  **tous les membres** (jusqu'à +25%, au prorata du total donné par la guilde). Le niveau du Hall
  limite le montant d'un don unique (1000 ressources par niveau).

## Renforts et dons entre joueurs

Depuis la fiche d'un village appartenant à un autre joueur (carte), en plus d'attaquer ou reconnaître :

- **Envoyer en soutien** : vos troupes voyagent puis se stationnent dans son village, où elles
  comptent pour sa défense au même titre que ses propres troupes (et se répartissent les pertes en
  cas d'attaque). Retrouvez vos renforts envoyés dans la barre latérale, avec un bouton **Rappeler**
  pour les faire revenir chez vous (nouveau trajet de retour, comme une mission classique).
- **Donner des ressources** : un don immédiat (sans marchand ni délai de trajet, pour rester simple),
  plafonné par vos ressources disponibles et par la capacité de stockage du destinataire.

## Gestion des rapports

Dans l'onglet **Rapports**, des filtres par catégorie (Tous / Attaques
envoyées / Attaques subies / Reconnaissances / Raids de pillards / Annonces)
permettent de n'afficher qu'un type de rapport, avec un compteur à jour pour
chaque catégorie. Chaque rapport possède un bouton 🗑️ pour le supprimer
individuellement, et un bouton de suppression groupée permet d'effacer en une
fois soit tous les rapports, soit uniquement ceux de la catégorie actuellement
affichée (une confirmation est demandée avant toute suppression groupée).

## Carte interactive

En plus du glisser-déposer, la molette de la souris zoome sur la carte en
gardant le point sous le curseur immobile.

## Ce qui a changé par rapport à la version solo

- **Comptes joueurs réels** (pseudo + mot de passe), un jeton de session
  valable 30 jours.
- **Monde partagé** : tous les joueurs évoluent dans le même monde (200×200
  cases), avec 220 villages barbares communs et un village par joueur.
- **Temps réel uniquement** (plus de sélecteur de vitesse) : l'économie et les
  files de construction/entraînement avancent en continu côté serveur, même
  hors ligne.
- **PvP réel** : vous pouvez attaquer et être attaqué par de vrais joueurs, pas
  seulement par des villages barbares.
- **Renseignement masqué** : les troupes et ressources d'un village qui n'est
  pas le vôtre ne sont visibles qu'après une reconnaissance (l'ancien mode
  solo affichait tout directement).
- **Classement** : un nouvel onglet affiche les meilleurs joueurs du monde.
- **Boutique supprimée** : les packs de ressources/troupes gratuits n'avaient
  de sens qu'en solo face à des adversaires contrôlés par le jeu.
- Sauvegarde automatique côté serveur — plus besoin d'exporter/importer un
  fichier de sauvegarde.
