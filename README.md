# 🌫️ Blurrio

Devine le perso avant que l'image ne devienne nette. L'image se dévoile en ~18 s ; plus tu réponds tôt, plus tu gagnes de points. Une fois l'image nette, 4 noms te sont proposés (points réduits).

## Jeux
League of Legends · Pokémon (au choix par génération) · Super Mario · Animal Crossing · Zelda · Fire Emblem · Splatoon · Nintendo mélange · Mélange (tous les jeux)

## Compétition
- **Défi du jour** : les mêmes 10 personnages pour tout le monde, par jeu. Il change à **8h (heure de Paris)**. Seule la **première partie du jour** compte.
- **Classements** par jeu : aujourd'hui · ce mois-ci · tous les temps (meilleur score de chaque joueur).
- Pseudo libre, sans compte. Pokémon : le défi du jour utilise la génération 1 seulement.
- Bouton **Partager mon score** avec un lien qui rouvre le même jeu.

## Fonctionnement
Page statique (`index.html`, `style.css`, `app.js`), sans serveur à gérer.
- **League of Legends** : Riot Data Dragon, en direct (skin de base).
- **Pokémon / Nintendo** : données téléchargées une fois dans `data/` par `python tools/build-data.py` (PokéAPI et AmiiboAPI). Relancer le script pour les mettre à jour.
- **Scores** : table `scores` sur Supabase (lecture et ajout publics, ni modification ni suppression). Une seule ligne par pseudo, jeu et jour.

Limite connue : les scores sont calculés dans le navigateur, donc un joueur motivé peut tricher. La base refuse les valeurs impossibles (score hors 0–3000).

## Lancer en local
Ouvrir `index.html` dans un navigateur (connexion nécessaire).

*Projet de fan, non affilié à Riot Games, Nintendo ni The Pokémon Company.*
