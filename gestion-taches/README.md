# Mes Tâches — application mobile de gestion des tâches

Application web progressive (PWA) pensée pour le mobile : installable sur l'écran d'accueil
(Android / iOS), fonctionne hors ligne, sans dépendance ni étape de compilation.

## Fonctionnalités

- Ajouter, modifier et supprimer des tâches (avec **annulation** de la suppression)
- Marquer une tâche comme terminée / à faire
- **Priorité** (haute, moyenne, basse), **date d'échéance**, **catégorie** et notes
- Filtres : Toutes, À faire, Aujourd'hui (inclut les tâches en retard), Terminées
- Recherche instantanée, filtre par catégorie, tri par échéance / priorité / date de création
- Tableau de bord : progression en %, tâches à faire, terminées et en retard
- Mise en évidence des tâches en retard ou dues aujourd'hui
- Thème clair / sombre (suit le système par défaut)
- Données enregistrées localement sur l'appareil (`localStorage`)
- Fonctionne hors ligne grâce au service worker

## Lancer l'application

Le service worker nécessite un serveur HTTP (ou HTTPS en production) :

```bash
cd gestion-taches
npm start            # ou : python3 -m http.server 8080
```

Ouvrez ensuite <http://localhost:8080> ; sur téléphone, utilisez « Ajouter à l'écran d'accueil ».
Pour la publier, déposez simplement le dossier sur un hébergement statique (GitHub Pages, Netlify…).

## Tests

```bash
npm test
```

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de l'interface |
| `styles.css` | Styles mobile-first, thèmes clair et sombre |
| `store.js` | Logique métier (données, filtres, tri, statistiques), sans DOM |
| `app.js` | Interface : rendu, événements, dialogue d'édition |
| `sw.js` | Service worker (cache hors ligne) |
| `manifest.webmanifest` | Manifeste PWA (installation) |
| `tests/` | Tests unitaires de `store.js` (`node --test`) |
