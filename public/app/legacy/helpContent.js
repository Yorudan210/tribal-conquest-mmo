// Contenu de l'onglet Aide, porté texte pour texte depuis renderHelp() (index.html ~5401-5429),
// restructuré en sections distinctes {title, html} pour un rendu en volets déroulants (accordéon,
// voir HelpBox dans InformationTab.jsx) plutôt qu'un unique bloc HTML continu. Chaque section reste
// un fragment HTML (rendu via dangerouslySetInnerHTML) car son contenu ne contient aucune
// interactivité propre -- le bouton "Revoir le tutoriel" et le formulaire de code admin sont gérés
// séparément, en vraie JSX, par InformationTab.jsx (qui les insère autour de cet accordéon).
export function helpSections(ironIcon) {
  return [{
    title: "Principes",
    html: `<p>Améliorez vos bâtiments dans l'onglet <b>Bâtiments</b> pour augmenter la production de ressources, la capacité de stockage et la population disponible. Construisez une <b>Caserne</b> pour entraîner des troupes dans l'onglet du même nom. Utilisez la <b>Carte</b> pour envoyer vos troupes reconnaître ou attaquer des <b>villages barbares</b> (dont les campements de l'Armée Noire) afin de piller leurs ressources ; les rapports de bataille apparaissent dans l'onglet <b>Rapports</b>. Ce monde est intégralement <b>JcE</b> : l'attaque entre joueurs est désactivée, mais vous pouvez toujours reconnaître ou soutenir un autre joueur.</p>`
  }, {
    title: "Reconnaissance et renseignement",
    html: `<p>Contrairement à un jeu solo, le serveur ne révèle jamais les troupes ni les ressources d'un village qui n'est pas le vôtre : vous devez d'abord y envoyer une <b>reconnaissance</b> (au moins un Éclaireur) pour en apprendre le contenu. Ce renseignement reste affiché tant que vous n'avez pas refait de reconnaissance plus récente — il peut donc devenir obsolète si le village a changé entre-temps. Le niveau de muraille, lui, est toujours visible.</p>
      <p><b>Contre-espionnage :</b> une reconnaissance ne réussit que si le nombre d'Éclaireurs envoyés dépasse strictement le nombre d'Éclaireurs présents en défense dans le village visé (troupes du village + renforts alliés stationnés confondus). En cas d'égalité ou d'infériorité, tous les Éclaireurs envoyés sont repérés et éliminés, sans aucun renseignement obtenu. Une reconnaissance réussie reste totalement furtive (la victime n'est jamais prévenue) ; une reconnaissance repoussée, elle, prévient son propriétaire.</p>`
  }, {
    title: "Sièges et conquête",
    html: `<p>Le <b>Bélier</b> et la <b>Catapulte</b> sont des unités de siège : envoyées dans une attaque victorieuse contre un village barbare, elles endommagent respectivement sa muraille et sa capacité de stockage (l'entrepôt d'un vrai joueur ne peut pas être endommagé ainsi). Construisez une <b>Académie</b> (dès Hôtel de ville niveau 20 — coûteuse et longue, elle ne peut être bâtie qu'une seule fois) pour former des <b>Nobles</b> : un noble survit au combat tant qu'au moins <b>20% de l'escorte envoyée</b> (les autres troupes de la même attaque) revient vivante — en dessous de ce seuil, il est perdu avec le reste de l'armée. S'il survit à une attaque victorieuse contre un village barbare, il réduit la loyauté de la cible d'environ 20 à 35% et est alors consommé (survivre au combat ne veut donc pas dire qu'il rentre au village : un Noble part toujours pour un aller simple, sauf s'il conquiert la cible) ; à 0% le village est conquis et devient vôtre. La conquête d'un village appartenant à un autre joueur n'est pas possible dans cette version.</p>`
  }, {
    id: "helpBlackArmy",
    title: "🏴 Évènements rotatifs de campements",
    html: `<p>De temps à autre, une vague de campements PNJ à thème peut apparaître sur la carte pendant une durée limitée (bannière dans la colonne de gauche tant que l'évènement est actif) : ces campements sont en tout point semblables à des villages barbares pour le combat et la conquête, mais reconnaissables entre mille par la couleur dédiée de leur pin. Un seul thème actif à la fois ; le thème varie d'un évènement à l'autre.</p>
      <p><b>🏴 L'Armée Noire</b> (pin noir, lueur rouge) fut le tout premier de ces thèmes, à l'ouverture officielle du jeu, et reste le plus complet : chaque campement a un <b>Rang</b> (de I à V, indiqué au survol de son pin) qui détermine sa force. <b>Rang I-II</b> (les plus nombreux) sont volontairement accessibles à un tout nouveau village avec seulement quelques troupes entraînées — un bon premier objectif après vos toutes premières troupes. <b>Rang III-IV</b> demandent une petite armée dédiée et une muraille à entamer. <b>Rang V</b> (rares) sont redoutables : garnison conséquente et muraille haute, à réserver aux joueurs multi-villages avec béliers et catapultes en nombre.</p>
      <p>Chaque victoire contre un campement de l'Armée Noire rapporte un <b>butin nettement plus riche</b> qu'un barbare ordinaire, et compte pour le succès <b>Chasseur de l'Armée Noire</b> (sous-onglet Succès). Conquérir un campement (comme pour un barbare classique, via un Noble) est encore plus intéressant : contrairement aux barbares normaux (1 sur 8 seulement), un campement de l'Armée Noire garantit <b>toujours</b> un gisement riche (+10% de production sur une ressource, définitivement) une fois conquis, et son niveau de développement initial reflète son Rang — un Rang V conquis démarre avec des bâtiments déjà bien avancés, pas au niveau 1.</p>
      <p>Chaque évènement est temporaire : passé son délai, les campements pas encore conquis se retirent automatiquement du monde (une annonce prévient de son lancement et de sa fin). Aucun risque à s'y frotter au-delà du combat lui-même : comme pour un barbare, si vous perdez, vous ne perdez que les troupes envoyées.</p>`
  }, {
    id: "helpGoldenConvoy",
    title: "🌾 Évènement : le Convoi doré",
    html: `<p>Second thème d'évènement rotatif (voir ci-dessus), <b>Le Convoi doré</b> (pin ambre doré) prend le contrepied de l'Armée Noire : ses convois sont volontairement <b>faibles</b> — plus faciles à vaincre qu'un simple village barbare — mais chargés d'un <b>butin considérable</b>. Plus de campements apparaissent en une seule vague, et l'évènement dure typiquement bien moins longtemps (quelques heures à une journée) : une véritable ruée sur les ressources, accessible même à un village qui débute.</p>
      <p>Chaque victoire compte pour le succès <b>Chasseur de convoi</b> (sous-onglet Succès). Contrairement à l'Armée Noire, conquérir un convoi ne garantit pas de gisement riche à la clé : l'intérêt du Convoi doré est le pillage immédiat pendant qu'il est là, pas la valeur à long terme du village conquis.</p>`
  }, {
    id: "helpFactions",
    title: "🗡️ Repaires de brigands et camps de maraudeurs",
    html: `<p>En dehors des barbares classiques et de l'Armée Noire, deux autres types de campements PNJ permanents peuplent la carte pour varier les cibles disponibles :</p>
      <p>🗡️ <b>Repaires de brigands</b> (pin violet) : proches du centre de la carte, plus faibles qu'un village barbare classique de même distance — une cible d'appoint accessible même en fin de partie. De nouveaux repaires réapparaissent régulièrement à proximité des villages joueurs dès que trop peu en restent sur la carte : impossible de les épuiser durablement.</p>
      <p>🐎 <b>Camps de maraudeurs</b> (pin orange) : plus loin du centre, plus forts qu'un barbare classique de même distance. Chaque victoire contre un camp de maraudeurs octroie en plus du butin habituel une <b>Ration de guerre</b> : un bonus de production temporaire (quelques heures) sur le village qui a attaqué, visible en haut de l'écran tant qu'il est actif. De quoi donner une bonne raison de les traquer spécifiquement plutôt que de piller au hasard.</p>
      <p>Ces deux types de campement sont des villages barbares ordinaires pour tout le reste (combat, conquête par un Noble, gisement riche possible) — seuls leur force et, pour les maraudeurs, la récompense de victoire diffèrent.</p>`
  }, {
    id: "helpLegendary",
    title: "👑 Campements légendaires",
    html: `<p>Une poignée de <b>campements légendaires</b> (pin doré, lueur intense) sont dispersés sur toute la carte — reconnaissables entre tous, y compris face à l'Armée Noire. Leur garnison dépasse largement tout ce qu'un seul village, même très développé, peut espérer vaincre en une seule attaque.</p>
      <p>Contrairement à tout autre village barbare, un campement légendaire <b>ne se renforce jamais</b> : pas de nouvelle troupe, pas de muraille reconstruite avec le temps. Chaque attaque qu'il subit — gagnée ou perdue — use un peu plus durablement sa garnison, exactement comme contre n'importe quel village. Il finit donc immanquablement par tomber, à condition d'être attaqué assez de fois, potentiellement par plusieurs joueurs différents au fil du temps plutôt que par un seul assaut massif.</p>
      <p>Sa chute (par conquête au Noble, comme pour tout barbare) récompense le succès <b>Chasseur de légende</b> pour <b>chaque joueur</b> ayant contribué à l'affaiblir, pas seulement celui qui porte le coup de grâce. La fenêtre d'un campement légendaire indique le nombre de joueurs l'ayant déjà entamé.</p>`
  }, {
    title: "Gisements riches",
    html: `<p>Environ 1 village barbare sur 8 recèle un <b>gisement riche</b> en une ressource tirée au hasard (bois, argile ou fer), repérable sur la Carte par un petit badge ${ironIcon} sur son pin (survolez ou touchez le pin pour voir laquelle). Une fois ce village conquis par un Noble, il produit <b>+10%</b> de cette ressource — un bonus propre à ce village précis, qui ne s'applique jamais à vos autres villages.</p>`
  }, {
    title: "Un monde vivant, avec de vrais joueurs",
    html: `<p>Les villages barbares se développent tout seuls avec le temps (nouvelles troupes, muraille renforcée, réserves agrandies), surtout les plus éloignés du centre, et peuvent riposter par un raid si vous les attaquez trop souvent — restez donc prêt à défendre votre village (troupes en garnison, muraille) même hors ligne. Les autres joueurs, eux, ne peuvent pas vous attaquer : ce monde est intégralement JcE, seuls les villages barbares (et l'Armée Noire) représentent une menace. L'économie tourne en revanche en temps réel 24h/24, y compris en votre absence : reconnaissances, soutiens et échanges entre joueurs continuent de son côté.</p>`
  }, {
    title: "Succès et Classement",
    html: `<p>Le sous-onglet <b>Succès</b> (dans Informations, à côté d'Aide) reprend les mêmes catégories que le jeu officiel (points, conquêtes, pillage, troupes ennemies détruites, soutien, échanges au Marché, murailles démolies, campements de l'Armée Noire vaincus...), chacune avec 4 paliers — Bois, Bronze, Argent, Or — qui se débloquent automatiquement au fil de votre progression, sans réclamation ni récompense en jeu : c'est purement indicatif. L'onglet <b>Classement</b> affiche les meilleurs joueurs du monde par nombre de points.</p>`
  }, {
    title: "Licencier des troupes",
    html: `<p>Dans l'onglet <b>Caserne</b>, chaque type de troupe présent dans le village affiche un encart « 🗑️ Licencier » : indiquez un nombre et validez pour détruire définitivement ces troupes (aucun remboursement de ressources). Seules les troupes actuellement stationnées dans le village peuvent être licenciées — impossible pour celles en formation ou déjà parties en mission.</p>`
  }, {
    title: "Compte et progression",
    html: `<p>Votre village est sauvegardé automatiquement sur le serveur à chaque action : aucune sauvegarde manuelle n'est nécessaire, et vous pouvez vous reconnecter à tout moment avec votre pseudo et votre mot de passe, depuis n'importe quel appareil.</p>`
  }, {
    id: "helpInstall",
    title: "📱 Installer l'application",
    // Le bouton "Installer" natif (Chrome/Edge desktop et Android, via l'évènement
    // beforeinstallprompt capté dans public/index.html) est inséré en vraie JSX par
    // InformationTab.jsx/HelpBox juste après cette section -- ce paragraphe couvre la procédure
    // manuelle, seule option sur Safari/iOS (qui n'a pas cette API) et filet de secours partout
    // ailleurs si le bouton ne s'affiche pas encore (le navigateur ne propose l'installation
    // qu'après quelques visites, selon ses propres critères).
    html: `<p>Conquête Tribale peut s'installer comme une vraie application, sur téléphone comme sur ordinateur : icône sur l'écran d'accueil, ouverture en plein écran sans barre d'adresse, chargement plus rapide. Gratuit, sans passer par l'App Store ni le Google Play Store.</p>
      <p><b>📱 iPhone/iPad (Safari) :</b> ouvrez ce site dans <b>Safari</b> (pas Chrome, qui n'a pas cette fonction sur iOS) → appuyez sur l'icône <b>Partager</b> (le carré avec une flèche vers le haut, en bas de l'écran) → <b>Sur l'écran d'accueil</b> → <b>Ajouter</b>.</p>
      <p><b>🤖 Android (Chrome) :</b> le bouton <b>Installer</b> ci-dessous apparaît automatiquement dès que Chrome le propose. À défaut, ouvrez le menu <b>⋮</b> en haut à droite → <b>Installer l'application</b> (ou <b>Ajouter à l'écran d'accueil</b>).</p>
      <p><b>💻 Ordinateur (Chrome/Edge) :</b> même bouton <b>Installer</b> ci-dessous, ou l'icône d'installation (⊕) directement dans la barre d'adresse.</p>`
  }];
}