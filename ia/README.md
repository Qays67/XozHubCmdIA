# ia — XozHub.AI, la nouvelle IA

La nouvelle IA, celle du site : **une fenêtre graphique**, pas un terminal. Tu choisis le dossier,
tu écris ta demande en français, elle écrit les fichiers, lance les commandes, lit les erreurs et
corrige — et tu vois tout se faire dans le journal, à droite.

| Fichier | Rôle |
| --- | --- |
| `serveur.mjs` | le cœur : le serveur local, l'agent, l'ouverture de la fenêtre |
| `ui.html` | la fenêtre elle-même : conversation, dossier, fichiers, journal (palette galaxie) |
| `lancer.cmd` | lancement depuis ce dossier (développement) |
| `lancer.vbs` | lancement **sans console** — c'est ce que vise le raccourci du Bureau |
| `installer.ps1` | ce que le `.exe` exécute : Node.js, copie des fichiers, raccourci, lancement |
| `fabriquer-icone.mjs` | dessine `ia/xozhub-ai.ico` : le logo galaxie (6 tailles, de 16 à 256 px) |
| `xozhub-ai.ico` | l'icône : raccourci du Bureau, barre des tâches, onglet, site |
| `fabriquer-exe.cmd` / `.ps1` | fabrique `dist/XozHub-AI-Setup.exe` |

## Lancer

```cmd
lancer.cmd
```

ou, depuis la racine du projet :

```cmd
node ia\serveur.mjs
```

La fenêtre s'ouvre d'elle-même (Edge ou Chrome en mode application : pas d'onglets, pas de barre
d'adresse). Pour les tests sans fenêtre — le serveur tourne et affiche son adresse :

```cmd
node ia\serveur.mjs --sans-fenetre
```

## Fabriquer l'installateur `.exe`

```cmd
fabriquer-exe.cmd
```

→ `dist\XozHub-AI-Setup.exe`. Un seul fichier, à donner ou à mettre sur une Release GitHub.
Ce qu'il contient : `ia\`, `src\` (le moteur), `package.json` et `.env`, compressés puis encodés
dans un lanceur, lui-même emballé par IExpress (présent sur tous les Windows). Rien n'est
téléchargé pendant l'installation.

Ce qu'il fait chez la personne :

1. vérifie Node.js 18+ et l'installe via `winget` si besoin (sinon ouvre nodejs.org et s'arrête
   proprement en le disant) ;
2. installe tout dans `%LOCALAPPDATA%\XozHubAI` ;
3. pose le raccourci **XozHub.AI** sur le Bureau (il vise `lancer.vbs` : aucune console) ;
4. lance l'IA tout de suite.

## Le dossier, l'historique, le téléphone

- **Choisir le dossier** : le bouton « Choisir un dossier… » ouvre **la vraie fenêtre des dossiers de
  Windows** (celle de l'explorateur, avec l'arborescence) — ouverte par Windows lui-même via
  `cscript` + `Shell.Application.BrowseForFolder`, donc elle s'affiche à tous les coups. Si elle ne
  peut pas s'ouvrir, le navigateur de dossiers **de la fenêtre** prend le relais (lecteurs, dossiers,
  « Travailler ici »). Le dossier choisi est retenu d'un lancement à l'autre (`~/.xozhub-ai.json`).
- **Les conversations précédentes** : chaque conversation est enregistrée dans
  `~/.xozhub-ai-conversations.json` (60 dernières). Le panneau « Conversations » les liste : on clique,
  et tout revient — les questions, les réponses, le journal (fichiers, commandes, sorties) — **et le
  dossier de l'époque**, avec le contexte remis au modèle : on peut continuer la discussion.
- **Depuis un téléphone** : `node ia/serveur.mjs --reseau` accepte les connexions du Wi-Fi. Le terminal
  affiche alors l'adresse à taper sur le téléphone (`http://192.168.x.x:PORT/?cle=…`). ⚠️ Toute
  personne sur le même Wi-Fi qui a ce lien peut s'en servir : à n'activer que sur un réseau de
  confiance. Sans le drapeau, l'IA n'écoute que sur `127.0.0.1`.

## Comment ça marche

- **La fenêtre** : un serveur HTTP local (`127.0.0.1`, port tiré au hasard) sert `ui.html`, que le
  navigateur affiche en mode application. C'est ce qui donne une vraie fenêtre sans dépendance —
  une fenêtre native demanderait Electron, 150 Mo à télécharger.
- **Le jeton** : chaque lancement tire un jeton au hasard, et toutes les adresses `/api/…` l'exigent.
  Sans lui, une page web ouverte dans le navigateur de la personne ne peut pas commander l'IA.
- **Le dossier** : `%USERPROFILE%\XozHub` au premier lancement, puis le dernier choisi. Le bouton
  « Choisir un dossier… » ouvre le sélecteur natif de Windows (PowerShell + `FolderBrowserDialog`).
- **Le travail** : le modèle répond avec des blocs `write`, `edit` et `run` — c'est le serveur qui
  écrit les fichiers et lance les commandes, jamais le modèle. Il enchaîne jusqu'à 12 tours,
  relance après chaque commande pour lire le résultat, et s'arrête sur `TERMINÉ`.
- **Le moteur** : `src/` est réutilisé tel quel (`api.js`, `write.js`, `exec.js`, `config.js`,
  `report.js`) — l'IA en fenêtre et l'IA en terminal écrivent donc leurs fichiers exactement de la
  même façon. `package.json` doit voyager avec, sinon Node lit `src/*.js` comme du CommonJS.
- **La clé** : lue dans `.env` (`XOZHUB_API_KEY`), comme la version terminal.
- **L'icône** : dessinée par `node ia/fabriquer-icone.mjs` — un `.ico` multi-tailles (PNG dedans),
  généré aux couleurs de la marque. Elle sert au raccourci du Bureau, à la barre des tâches, et au
  favicon du serveur local (`/favicon.ico`).

## À savoir

- Le `.exe` contient `.env`, donc la clé API : à donner à la main, ou à savoir avant de le mettre
  en téléchargement public — c'est le compte qui paie les utilisations.
- Le port n'écoute que sur `127.0.0.1` : rien n'est exposé au réseau local.
- La conversation reste en mémoire : fermer l'IA la perd. Les fichiers, eux, restent sur le disque.
  Un `RAPPORT.md` est tenu à jour dans le dossier de travail (comme pour la version terminal).
