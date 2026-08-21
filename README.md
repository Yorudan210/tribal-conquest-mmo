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

**Important — persistance des données** : sur le plan gratuit de Render, le
disque est réinitialisé à chaque redéploiement (mais pas entre deux requêtes
normales — vos joueurs ne perdent rien tant que vous ne redéployez pas).
Pour une persistance garantie même après redéploiement, ajoutez un « Persistent
Disk » (payant, quelques dollars/mois) monté sur le dossier `data/`, ou migrez
vers Railway/Fly.io qui proposent des volumes persistants.

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
│   └── gameLogic.js         # actions joueur, combats, tick périodique
├── public/
│   └── index.html           # client web (interface + logique d'affichage)
└── data/                    # créé automatiquement (db.json, secret.txt)
```

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
