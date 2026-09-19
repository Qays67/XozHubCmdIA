# XozHub.GPT — le tutoriel, de A à Z

Ce guide s'adresse à quelqu'un qui n'a **jamais** touché à un terminal. Lis-le une fois en entier,
puis garde-le sous la main : il y a des demandes à copier-coller telles quelles.

## 1. C'est quoi, XozHub.GPT ?

Une IA qui travaille sur ton ordinateur, dans une fenêtre de terminal. Tu lui écris ce que tu veux
en français, avec tes mots, et elle **le fait vraiment** : elle crée les fichiers, écrit le code,
lance les commandes, lit les erreurs et corrige jusqu'à ce que ça marche.

Ce n'est pas un chat qui te donne des conseils : c'est un ouvrier. Tu demandes un site, tu obtiens
un vrai dossier avec un vrai site dedans.

## 2. Avant de commencer (5 minutes)

Il te faut trois choses :

1. **Un PC Windows** (10 ou 11).
2. **[Node.js](https://nodejs.org)** en version 18 ou plus — clique sur le bouton vert « LTS »,
   installe, et clique « Suivant » jusqu'au bout. Une seule fois dans ta vie.
3. **Une clé API** : une longue suite de caractères qui commence par `xgpt_`. C'est elle qui fait
   marcher l'IA. Demande-la à la personne qui t'a donné XozHub.GPT.

Pour vérifier que Node.js est bien installé : ouvre le menu Démarrer, tape `cmd`, ouvre
« Invite de commandes », et tape :

```cmd
node -v
```

Si un numéro comme `v22.11.0` s'affiche, c'est bon. Si tu lis « n'est pas reconnu », recommence
l'installation de Node.js et **rouvre** ensuite une nouvelle fenêtre cmd.

## 3. Installer XozHub.GPT

Trois méthodes. Prends celle que la personne qui t'a filé l'IA t'a indiquée.

### A. On t'a donné un fichier `XozHub-GPT-Setup.exe`

Double-clique dessus. Windows affichera peut-être « **Windows a protégé votre PC** » — c'est normal,
le fichier n'est pas signé (ça coûte cher, une signature). Clique sur *Informations
complémentaires* → *Exécuter quand même*. L'installation se fait toute seule.

### B. On t'a donné une longue ligne de commande

Colle-la dans l'invite de commandes (clic droit = coller) et appuie sur Entrée. Elle ressemble à :

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Qays67/XozHubCmdIA/main/install-en-ligne.ps1 | iex"
```

Cette ligne va chercher le projet, prépare les fichiers, vérifie Node.js, et te **demande ta clé** si
elle n'est pas fournie. Colle-la, Entrée.

### C. On t'a donné un dossier ou un `.zip` du projet

Ouvre le dossier (décompresse le `.zip` s'il y en a un) et **double-clique sur `install.cmd`**.
C'est tout — la clé est déjà dedans.

### À la fin

Dans tous les cas, **ferme la fenêtre cmd et ouvres-en une nouvelle** (important : le système ne
relit le chemin des commandes qu'à l'ouverture d'une fenêtre). Tape :

```cmd
xozhub
```

L'interface démarre. Tu n'as plus jamais besoin de retaper tout ça : `xozhub` marche depuis
n'importe quel dossier.

> Si rien ne se passe : `verifier.cmd` (double-clic) te dit laquelle des installations répond.

## 4. Ta première demande

Une fois l'interface ouverte, tu vois un logo, un journal au milieu et une zone de saisie en bas.
Écris ta demande, appuie sur **Entrée**, et laisse faire.

Un premier essai, à copier-coller :

```
crée un site vitrine pour un salon de coiffure dans le dossier coiffure-et-vous
```

L'IA travaille toute seule : elle crée le dossier, écrit `index.html`, `style.css` et `script.js`,
puis lance un petit serveur local pour vérifier que la page répond. Tu vois défiler **une ligne par
fichier créé** — jamais le contenu — et les commandes qu'elle lance. Quand c'est fini, elle écrit
`TERMINÉ`.

Tu ne confirmes rien : par défaut, **chaque commande part toute seule**. C'est le mode automatique.

## 5. Comment bien demander (les 5 règles)

C'est 90 % du résultat. L'IA est très forte quand on lui parle simplement.

1. **Dis ce que tu veux, pas comment le faire.** « Fais-moi un site pour mon garage » est mieux que
   « utilise du HTML et du CSS avec flexbox ». Le comment, c'est son métier.
2. **Donne un nom de dossier.** « …dans le dossier `mon-site` ». Sans ça, elle travaille dans le
   dossier courant et tu retrouves tout mélangé.
3. **Dis à qui ça s'adresse et le style voulu.** « pour un public jeune, style sombre et moderne »,
   « pour des parents d'élèves, sobre et rassurant ». Deux mots suffisent à changer tout le design.
4. **Une demande à la fois.** Fais ton site, regarde-le, puis demande une retouche. Ne lui enfourne
   pas dix choses dans une phrase : elle en oublie.
5. **Si quelque chose ne va pas, sois précis.** Pas « c'est moche », mais « le menu ne se replie pas
   sur téléphone » ou « le texte du titre est trop petit ». Elle corrige très bien quand c'est décrit.

Deux remarques utiles :

- **Pas besoin d'être poli ni parfait.** « corrige ça », « encore », « gros titre », ça marche. Elle
  ne se vexe pas.
- **Elle pose rarement des questions.** Si un détail manque, elle décide à ta place et continue. Son
  choix ne te va pas ? Demande de changer, c'est tout.

## 6. Créer un site propre, « comme un pro »

XozHub.GPT est réglé pour livrer, **par défaut**, un site de qualité d'agence : vraie palette de
couleurs, typographie soignée, espacements réguliers, responsive (mobile et ordinateur), contenu
crédible en français, accessibilité, pas de lien cassé, pas de « Lorem ipsum ».

Demande simplement :

```
crée un site vitrine pour une boulangerie artisanale à Lyon, dossier fournil-du-rhone :
présentation, nos pains, horaires et adresse. Ton chaleureux, beige et brun, photos en illustrations
```

### Ce que tu obtiens

```
fournil-du-rhone/
  index.html     la page, en HTML sémantique (en-tête, sections, pied de page)
  style.css      tout le design : couleurs en variables, mise en page, responsive
  script.js      le menu mobile et les petites interactions
```

### Vérifier le résultat toi-même

L'IA vérifie déjà que la page répond, mais c'est **toi** qui dois la regarder. Deux façons :

- ouvre le dossier et **double-clique sur `index.html`** : ça s'ouvre dans ton navigateur ;
- ou demande-le-lui en toutes lettres : « ouvre la page dans mon navigateur ».

Sur cette page, vérifie quatre choses, ce sont les quatre qui comptent :

1. **le texte est lisible** (rien de gris clair sur blanc) ;
2. **redimensionne la fenêtre** jusqu'à la taille d'un téléphone : rien ne doit dépasser sur le
   côté, le menu doit se replier ;
3. **clique sur les liens du menu** : ils doivent descendre aux bonnes sections ;
4. **le contenu te ressemble** : remplace les textes inventés par les tiens.

### Demander une retouche

Reprends exactement le même dossier et parle normalement :

| Ce que tu tapes | Ce qui se passe |
| --- | --- |
| `sur la page du fournil, ajoute une section « Nos horaires » avec un tableau` | une section est ajoutée, et le lien du menu avec |
| `le titre principal est trop petit sur téléphone, agrandis-le` | correction ciblée dans `style.css` |
| `change la palette : passe en bleu nuit et or` | toutes les couleurs de la page changent d'un coup |
| `ajoute une page « contact » avec un formulaire (nom, email, message)` | un `contact.html` + le lien dans le menu de toutes les pages |
| `le menu ne se replie pas sur mobile, corrige-le` | correction ciblée dans `script.js` |

### Idées de demandes prêtes à l'emploi

```
crée une page de portfolio pour un photographe animalier, dossier portfolio :
grille de 9 photos, galerie qui s'ouvre en grand au clic, style sombre et épuré
```

```
crée une page de vente pour une appli de gestion de budget, dossier budget-app :
titre accrocheur, trois avantages, une section tarifs avec deux formules, un bouton d'inscription,
et un pied de page. Style moderne, dégradé violet à bleu
```

```
crée un site pour mon association de protection des chats, dossier les-chats-libres :
qui nous sommes, nos actions, comment adopter, comment donner. Ton doux et chaleureux,
avec un bouton « Faire un don » bien visible
```

```
crée une page de restaurant italien, dossier trattoria-bella :
menu avec les plats et les prix, galerie, réservation par téléphone, plan d'accès
```

## 7. Tout le reste : elle sait aussi le faire

Un site n'est qu'un exemple. Le même principe marche pour tout :

| Ce que tu demandes | Ce que tu obtiens |
| --- | --- |
| « corrige le bug : le bouton ne fait rien » | le fichier est lu, la cause trouvée, le code corrigé et retesté |
| « explique-moi ce que fait ce dossier » | une explication en français, après avoir vraiment lu les fichiers |
| « fais-moi un script qui range mes téléchargements par type de fichier » | un script prêt à double-cliquer, testé |
| « renomme toutes les photos du dossier en photo-001, photo-002… » | les fichiers sont renommés, proprement |
| « fais-moi une calculatrice avec une interface » | un petit projet complet, à ouvrir dans le navigateur |
| « lis ce fichier CSV et fais-moi un graphique » | le graphique, dans un fichier que tu ouvres |
| « c'est quoi un service worker ? » | une réponse en texte, **sans rien modifier** sur ton disque |

Dernière ligne importante : pose-lui une vraie question (« c'est quoi… », « pourquoi… ») et elle
**répond** au lieu de bricoler dans tes fichiers. Elle devine toute seule si tu veux une réponse ou
du travail.

## 8. Les commandes et les raccourcis

Tu n'as presque rien à retenir : **deux commandes existent**, tout le reste se demande en français.

| À taper | Effet |
| --- | --- |
| `/miseajour` | récupère la dernière version du code **et** de l'IA, puis redémarre et reprend ta conversation |
| `/couleurs` | règle l'affichage des couleurs : `truecolor` (le plus beau), `256` ou `16` pour un vieux terminal, `none` pour couper |
| *n'importe quelle autre chose* | c'est une demande pour l'IA, écrite en français |

Raccourcis de l'interface :

| Touche / clic | Effet |
| --- | --- |
| `Entrée` | envoyer · pendant qu'elle travaille : **garder** le message pour après |
| `Échap` ou `ctrl-c` | interrompre ce qu'elle est en train de faire |
| le bouton **■ STOP** | la faire taire tout de suite (même chose) |
| `↑` `↓` | revoir tes demandes précédentes |
| molette, `Page↑` `Page↓` | faire défiler le journal |
| `ctrl-l` | nettoyer l'écran |
| clic sur **✕ End session** | ouvrir le menu de fin de session |

### Le menu de fin de session

Un clic sur **✕ End session** (en bas à droite) propose cinq choix : **Nouvelle session**,
**Reprendre la dernière session**, **Ouvrir une nouvelle fenêtre XozHub.GPT**, **Redémarrer**, ou
**Quitter**. Choisis avec `↑` `↓` puis `Entrée`, tape le numéro, ou clique sur la ligne. Pour
revenir en arrière : `Échap`, `q`, `x`, ou un clic sur la **✕** du panneau.

## 9. Où vont mes fichiers, et où est ma conversation ?

- **Tes fichiers** : dans le dossier que tu as nommé (« …dans le dossier `mon-site` »), donc à
  côté du dossier où tu as lancé `xozhub`. L'IA t'affiche le chemin exact à chaque fichier créé.
- **Le dossier de travail** est écrit dans la barre du bas. Si tu nommes un dossier dans ta demande,
  elle travaille là ; sinon, elle travaille dans ce dossier-là.
- **Ta conversation** est sauvegardée toute seule à la fin de chaque tour : tu peux fermer, revenir
  demain et choisir « Reprendre la dernière session ».
- **La mémoire du projet**, c'est le fichier `XozHub.md` créé dans le dossier de travail. Il contient
  ce que l'IA a jugé bon de retenir (choix, ports, conventions). Tu peux l'ouvrir et l'éditer à la
  main, ou même le supprimer : elle repartira de zéro.

## 10. Dépannage

| Ce que tu vois | Ce qu'il faut faire |
| --- | --- |
| `'xozhub' n'est pas reconnu` | ferme la fenêtre cmd et **rouvre-en une nouvelle**, puis retape `xozhub`. Sinon, relance `install.cmd`. |
| « Aucune clé API détectée » | redemande une clé à la personne qui t'a donné l'IA et relance l'installation. |
| `XozHub.GPT nécessite Node.js 18` | installe la version LTS de Node.js depuis nodejs.org, puis rouvre une fenêtre cmd. |
| « Windows a protégé votre PC » | *Informations complémentaires* → *Exécuter quand même*. |
| Le site s'affiche tout blanc | tu as ouvert le mauvais fichier, ou une page vide a été créée : demande « **la page est blanche, corrige-la** ». |
| « Commande bloquée : elle aurait ouvert une page » | elle ne s'autorise pas à ouvrir un navigateur sans que tu le demandes. Dis « **ouvre la page** », et c'est fait. |
| Elle patine ou part ailleurs | `Échap` pour l'arrêter, puis redis ta demande en une phrase, en nommant le dossier. |
| La fenêtre est bizarre (couleurs, flèches) | c'est normal : `xozhub` a besoin d'une **vraie** fenêtre cmd, pas d'un affichage capturé. |
| Ça semble bloqué | regarde la barre du bas et le titre de la fenêtre : elle écrit, réfléchit ou exécute. Attends — ou `Échap`. |

En dernier recours, `reparer.cmd` (double-clic) remet l'installation d'aplomb.

## 11. Partager XozHub.GPT à quelqu'un

C'est le but : personne n'a besoin d'être développeur.

1. Envoie **`XozHub-GPT-Setup.exe`** (le plus simple : un double-clic et c'est fini) ;
2. ou envoie le **dossier du projet en `.zip`** : la personne le décompresse et double-clique sur
   `install.cmd` ;
3. ou donne-lui la **ligne de commande** d'installation ci-dessus, si le projet est sur GitHub.

⚠️ Un point de vigilance, si tu fabriques l'installateur toi-même : s'il y a un fichier `.env` à côté
du projet, **ta clé API part dedans**. Pour un fichier que tu diffuses, renomme-le avant de le
fabriquer : l'installateur demandera la clé à la personne qui installe.

Pour publier la page d'installation (celle que tu peux donner comme lien d'accueil) : le fichier
`docs/index.html` est prêt. Sur GitHub, active **Settings → Pages → Source : `main` / `/docs`** et
elle sera en ligne sur `https://qays67.github.io/XozHubCmdIA/`.

## 12. Aide-mémoire

```
Installer      → double-clic sur XozHub-GPT-Setup.exe  (ou install.cmd)
Lancer         → xozhub
Demander       → en français, Entrée. Une demande à la fois, avec un nom de dossier.
Arrêter        → Échap   ·   Reprendre : ↑ puis Entrée
Terminer       → clic sur ✕ End session → « Nouvelle session »
Se mettre à jour → /miseajour

Une bonne demande ressemble à ça :
« crée un site pour <ton activité> dans le dossier <nom-du-dossier>,
  pour <à qui c'est destiné>, ton <chaleureux / sobre / moderne> »
```
