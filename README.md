# Mes trajets — Train + métro à Lille

Version **100 % statique pour GitHub Pages**, sans serveur privé, sans clé API et sans dépendance npm à installer.

- Matin : Armentières → Lille-Flandres, départs de 06:45 à 07:45.
- Soir : Lille-Flandres → Armentières, départs de 17:00 à 18:30.
- Deux profils : Richard (M2, Mons Sarts) et Louis (M1, Pont de Bois).
- Mode Automatique : aller avant midi, retour après midi, selon l’heure de Paris. Les boutons Aller et Retour permettent de changer manuellement.
- Correspondance du matin : arrivée du train + marche à Lille-Flandres, puis premier métro prévu accessible. Choisir un train dans le menu si vous êtes déjà à bord ; sinon le mode automatique cherche le prochain départ depuis Armentières.
- Retour : prochain métro compatible depuis votre station puis train dans le créneau 17:00–18:30, avec marche et sécurité. Si le train est dans plus d’une heure, le métro est choisi plus tard pour éviter une attente excessive en gare. Le choix manuel d’un train propose le dernier métro compatible.
- Marche à Lille-Flandres : 5 min par défaut ; sécurité avant le train retour : 5 min ; accès à votre station : 0 min (vous êtes supposé être déjà au quai). Toutes ces marges sont réglables de 0 à 30 min.
- Profil et marges mémorisés localement dans le navigateur. Aucune géolocalisation.
- Comptes à rebours, retards et suppressions SNCF lorsqu’ils sont transmis.
- Horaires des dates de circulation réelles, week-ends et jours fériés compris selon le fichier SNCF.

## Installation dans `richardservoise/SNCF`

1. Décompresser l’archive et déposer **le contenu du dossier** à la racine du dépôt `SNCF`. Le fichier `index.html` doit être à la racine, pas dans un sous-dossier supplémentaire.
2. Vérifier que `.github/workflows/pages.yml` et `.nojekyll` sont également ajoutés. Les fichiers commençant par un point peuvent être masqués dans l’explorateur. Pour les afficher sur Mac : Cmd + Maj + point.
3. Dans le dépôt GitHub : **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Envoyer les fichiers sur la branche `main` (ou `master`). Si le dépôt est déjà configuré et les fichiers sont déjà envoyés, ouvrir **Actions → Publier Mes trains sur GitHub Pages → Run workflow**.
5. Attendre la fin de l’exécution puis ouvrir l’URL indiquée par GitHub dans **Settings → Pages → Visit site**.

Pour ce dépôt, l’URL habituelle sera `https://richardservoise.github.io/SNCF/` une fois le déploiement réussi. Elle n’a pas été déployée ni vérifiée depuis cette archive.

### Depuis un clone local existant

Copier les fichiers à la racine de votre clone puis, après vérification :

```sh
git add .
git commit -m "Add static train app for GitHub Pages"
git push
```

Aucun secret GitHub ou SNCF n’est nécessaire. Le workflow utilise les permissions natives GitHub Pages. Ne pas saisir de jeton dans le JavaScript.

## Lancer et vérifier localement

Python 3 et Node.js 22 ou supérieur pour les tests et la préparation. Aucun `npm install` requis.

```sh
npm test
npm run dev
# Ouvrir http://localhost:8080/
```

Ouvrir le site avec le serveur local, plutôt qu’en double-cliquant sur `index.html` (les modules et le chargement des données nécessitent HTTP).

```sh
npm run update-data  # télécharger un nouveau fichier d’horaires
npm run build        # générer dist/ pour GitHub Pages
```

## Fonctionnement des données

**Horaires prévus.** `data/schedule.json` est extrait du GTFS SNCF officiel. Le workflow régénère les fichiers train et métro au déploiement et quotidiennement à 03:20 UTC, puis republie Pages sans modifier les fichiers source du dépôt. GitHub peut décaler les exécutions planifiées. Les exécutions planifiées doivent être activées et se font sur la branche par défaut. Sur un dépôt public inactif, GitHub peut les désactiver ; vérifier l’onglet Actions si la date des horaires cesse d’évoluer.

**Métro.** Les quatre trajets sont extraits du GTFS officiel Ilévia (`https://media.ilevia.fr/opendata/gtfs.zip`) dans `data/metro.json`, avec dates de circulation et heures exactes en secondes. Les variantes courtes qui traversent les deux stations sont conservées. Les passages métro sont **prévus**, pas confirmés en temps réel : aucun flux fiable de passages M1/M2 n’a été identifié pour ces stations lors de la réalisation. Les durées de marche et les marges sont des hypothèses utilisateur, pas des données Ilévia.

**Trafic M1/M2.** Lecture directe du flux public de perturbations MEL/Ilévia :
`https://data.lillemetropole.fr/geoserver/ogc/features/v1/collections/dsp_ilevia:perturbations/items?f=application%2Fjson&limit=1000`

Les messages visent `ME1` et `ME2`. Le flux contient aussi des messages anciens : un message modifié depuis plus de deux heures est marqué « ancien · à confirmer », pas comme interruption active. Un flux dont l’horodatage est vieux de plus de 10 minutes est rejeté. Une interruption récente est signalée au-dessus de la correspondance, qui reste théorique. Aucune absence d’alerte n’est présentée comme une garantie de trafic normal. Le lien Ilévia reste disponible dans tous les cas. Les messages sont affichés en texte nettoyé, sans exécuter le HTML source.

**Temps réel SNCF.** Le navigateur consulte directement le flux SIRI public SNCF via transport.data.gouv.fr. Le serveur de cette source autorise actuellement les appels CORS. Aucune dépendance à l’ancienne application ChatGPT Sites. L’app télécharge le flux seulement à proximité de vos trajets (entre une heure avant et une heure après un départ prévu), et au maximum toutes les deux minutes quand la page est visible. Le flux national peut représenter plusieurs dizaines de Mo : attention à l’utilisation des données mobiles. Le traitement en streaming limite la mémoire utilisée.

La source couvre surtout les 60 prochaines minutes. Sa couverture TER peut être incomplète. Les retards et suppressions s’affichent seulement lorsqu’ils sont transmis ; l’absence de donnée reste affichée comme « Horaire prévu ». Un flux vieux de plus de 10 minutes est rejeté. Si le réseau, la source ou sa politique CORS change, les horaires prévus restent disponibles, avec une indication d’indisponibilité du temps réel.

**Suivi.** L’heure de Paris est utilisée quelle que soit la zone de l’appareil. À 7h10, le premier départ encore accessible est surveillé (7h13 dans l’exemple du 27 octobre 2026). Les retards annoncés changent l’ordre de sélection, les trains supprimés sont écartés. La minute de départ est conservée jusqu’à la minute suivante. Le suivi se réévalue toutes les 15 secondes. La page doit rester ouverte et visible ; aucune notification en arrière-plan n’est configurée.

## Fichiers

- `index.html` : interface et styles responsive.
- `js/app.mjs` : affichage, calendrier, compte à rebours et rafraîchissement.
- `js/watch.mjs` : fonctions horaires Paris et sélection train.
- `js/journeys.mjs` : moteur des correspondances aller/retour.
- `js/journey-ui.mjs` : profils, réglages, chronologie et trafic.
- `js/traffic.mjs` : accès et contrôle de fraîcheur des perturbations Ilévia.
- `js/data.mjs` : lecture du fichier horaires et fenêtre de suivi.
- `js/realtime.mjs` : lecture du flux SNCF, retards et suppressions.
- `scripts/update_schedule.py` : extraction des trajets train depuis le GTFS SNCF.
- `scripts/update_metro.py` : extraction des quatre trajets métro Ilévia.
- `.github/workflows/pages.yml` : actualisation et déploiement Pages.
- `tests/` : vérification de la sélection, du flux et des chemins sous `/SNCF/`.

## Sources

- SNCF Open Data : https://ressources.data.sncf.com/explore/dataset/horaires-sncf/
- Flux SIRI : https://proxy.transport.data.gouv.fr/resource/sncf-siri-lite-estimated-timetable
- GitHub Pages : https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

Réutilisation des données : consulter les licences et conditions SNCF associées à ces sources. Ce projet n’est pas une application officielle SNCF.

## Correction de l’affichage

Les horaires de train sont affichés directement, sans section repliée. Les cartes « Prochains métros » affichent les trois passages prévus depuis Lille-Flandres à l’aller, ou depuis Pont de Bois (Louis/M1) et Mons Sarts (Richard/M2) au retour. Ces prochains passages sont distincts du métro conseillé pour rejoindre votre train plus tard.

Les boutons Trains, Métros M1 / M2 et Ma correspondance permettent d’accéder directement à chaque section. Les scripts de la version construite portent une révision dans leur URL pour éviter de mélanger d’anciens fichiers en cache avec de nouveaux modules. Le chargement des horaires de train reste indépendant du rendu des correspondances métro.


Interface iPhone : sens du trajet et train sélectionnés automatiquement selon l’heure de Paris, sans boutons de sens ni liste déroulante de trains. Richard utilise M2, Louis M1.

Version 1.4 : Richard = M2 / Mons Sarts ; Louis = M1 / Pont de Bois. Aucun bouton Auto, Aller, Retour et aucune liste de trains.
