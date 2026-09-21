# XozHub.GPT

Agent de développement en ligne de commande : logo ASCII **XOZHUB** en gros blocs (bandeau coloré
au lancement, à l'installation et à la mise à jour), barre de modèle,boîte de saisie encadrée — en palette **galaxie** : violet profond de nébuleuse,
cyan glacé et rose stellaire, dégradés horizontaux, filets et panneaux qui se fondent, badges colorés pour le bouton
d'arrêt et la fin de session.

XozHub.GPT discute avec ton compte X.GPT, peut proposer des commandes shell et les exécute
**automatiquement** — sans confirmation à valider à chaque étape. Le mode manuel
(confirmation `o` / `n`) reste disponible avec `/auto off`.

## XozHub.AI — la nouvelle IA, en fenêtre (pas dans le cmd)

La nouvelle IA a **sa propre fenêtre**, aux couleurs de la **galaxie** : ciel profond, nébuleuse
violette, cyan glacé, logo en spirale qui tourne. Tu **choisis le dossier** où elle travaille (bouton
« Choisir un dossier… », sélecteur de Windows), tu écris en français, et elle fait : elle écrit les
fichiers pour de vrai, lance les commandes, lit les erreurs, corrige — puis **se relance une fois
toute seule pour vérifier son travail** avant de te rendre la main.

| | **XozHub.AI** (la nouvelle) | XozHub.GPT (le terminal) |
| --- | --- | --- |
| où ça s'affiche | **sa propre fenêtre**, aucune console | une fenêtre `cmd` |
| comment on la lance | raccourci **XozHub.AI** du Bureau, ou `ia\lancer.cmd` | `xozhub`, ou raccourci du Bureau |
| choisir le dossier | bouton dans le panneau de droite, ou chemin collé | `/dir`, ou le dossier de lancement |
| ce qu'on voit | conversation, dossier, fichiers et journal, en direct | journal coloré dans le terminal |
| installateur à donner | **`dist/XozHub-AI-Setup.exe`** | `dist/XozHub-GPT-Setup.exe` |

Les deux partagent le **même moteur** (`src/`) et la même façon d'écrire les fichiers (blocs `write`,
`edit`, `run`) : ce n'est pas une autre IA, c'est la même avec un écran qui va avec. Le code de la
fenêtre est dans **`ia/`** — tout est détaillé dans `ia/README.md`.

Ce que la fenêtre a en plus :

- **la vraie fenêtre des dossiers de Windows** s'ouvre quand on clique sur « Choisir un dossier… »
  (celle de l'explorateur, avec l'arborescence) — et le dossier choisi est **retenu** au lancement
  suivant, dans `~/.xozhub-ai.json` ;
- **les conversations précédentes** : chacune est enregistrée (`~/.xozhub-ai-conversations.json`) et
  listée dans le panneau de droite. On clique, et tout revient — les questions, les réponses, le
  journal (fichiers, commandes, sorties) et le dossier de l'époque, avec le contexte remis au modèle
  pour continuer la discussion ;
- **l'icône galaxie** (`ia/xozhub-ai.ico`, dessinée par `node ia/fabriquer-icone.mjs`, six tailles
  de 16 à 256 px) : elle est sur le raccourci du Bureau, dans la barre des tâches, et dans l'onglet ;
- **l'accès depuis un téléphone** : `node ia/serveur.mjs --reseau` accepte les connexions du Wi-Fi et
  affiche l'adresse à taper sur le téléphone. ⚠️ Toute personne sur le même Wi-Fi avec ce lien peut
  s'en servir — à n'activer que sur un réseau de confiance. Sans ce drapeau, l'IA n'écoute que sur
  `127.0.0.1`.

```cmd
ia\lancer.cmd          rem lancer la nouvelle IA depuis le projet
ia\fabriquer-exe.cmd   rem fabriquer dist\XozHub-AI-Setup.exe
```

## Le bandeau XozHub

Le logo (blocs pleins, dégradé indigo → violet → magenta → cyan, badge `.GPT`) est défini **une
seule fois**, dans `banniere.ps1`, et s'affiche dans la fenêtre cmd à chaque moment important :

| Moment | Ligne affichée sous le logo |
| --- | --- |
| installation (`install.cmd`, `install-en-ligne.ps1`, lanceur `.exe`) | `En cours d'installation...` |
| lancement de la commande `xozhub` (ou du raccourci du Bureau) | `En cours de lancement...` |
| `/miseajour` | `En cours de mise à jour...`, dans une **nouvelle fenêtre cmd** |

Une seule source pour le dessin et les couleurs : les trois fenêtres affichent exactement le même
logo, et le fichier ne contient que de l'ASCII (les blocs pleins sont construits par le code), donc
il se lit pareil sur toutes les machines. `banniere.ps1` voyage avec le lanceur : `install.cmd`,
`partager.cmd`, `fabriquer*.ps1` et `fabriquer-installeur.mjs` l'embarquent à chaque fois.

## Partager XozHub.GPT

### Le site + l'installateur `.exe`

Le site, c'est **une seule page HTML pure** (aucune dépendance, aucun fichier à côté) :

- **`docs/index.html`** — **la ligne unique à coller dans `cmd`** avec son bouton « copier », le
  bouton de téléchargement de l'installateur, **le vrai lien du site** (à copier ou à partager tel
  quel, c'est celui qu'on envoie à quelqu'un), puis ce qui se passe, comment lancer l'IA, la première
  demande, **ce qui marche et ce qui peut bloquer**, les autres façons d'installer, le dépannage et
  les commandes utiles. Habillage **galaxie** : ciel profond, nébuleuse violette, cyan glacé, logo en
  spirale qui tourne, étoiles qui scintillent ;
- **`dist/`** — ce qui se donne : `XozHub-GPT-Setup.exe` et `XozHub-GPT-Installer.cmd`, déjà
  fabriqués (voir `dist/README.md` : le lien à envoyer et où mettre le `.exe` pour le bouton du site) ;
- **`docs/og.png`** — l'aperçu du lien (l'image que voit la personne à qui tu envoies l'adresse,
  dans WhatsApp, Discord ou Twitter), refabriquée par `node fabriquer-og.mjs`.

Le site est **en ligne** (`https://qays67.github.io/XozHubCmdIA/`), servi par **GitHub Pages** depuis
`main` / `/docs`. Rien à faire pour le mettre à jour : chaque publication de `publier.cmd` le reconstruit
tout seul, en une minute. Et la ligne d'installation marche **tout de suite** — elle ne dépend d'aucun
fichier hébergé à côté du site.

`fabriquer-exe.cmd` (double-clic) construit **`XozHub-GPT-Setup.exe`** : un seul fichier, que la personne
double-clique pour installer. Rien n'est téléchargé pendant l'installation, donc pas de `.cmd` abîmé par
les fins de ligne. Il emballe le code, `install.cmd` et `fabriquer-protege.mjs` dans un auto-extractible
Windows (IExpress, présent sur tous les Windows) — aucun outil à installer pour le fabriquer. La personne
obtient exactement la même installation que par la ligne de commande : icône sur le Bureau, dossier
masqué, code chiffré.

- les pages marchent sur **n'importe quel hébergement** : GitHub Pages, Netlify Drop, Vercel, un dossier
  partagé, ton propre serveur… c'est du HTML pur, il n'y a rien à installer ;
- joins `XozHub-GPT-Setup.exe` à une **Release** si tu veux pouvoir le donner à quelqu'un par un lien :
  ce n'est pas la méthode mise en avant sur le site, mais elle reste la plus simple à transférer ;
- ⚠️ si un `.env` est à côté de `fabriquer-exe.ps1`, la clé API part **dans** le `.exe` : pour un `.exe`
  public, renomme `.env` avant de le fabriquer et l'installateur demandera la clé à la personne ;
- Windows affichera « Windows a protégé votre PC » au premier lancement (pas de signature payante) :
  *Informations complémentaires* → *Exécuter quand même*. Le site prévient la personne.

### Rien à configurer : on envoie le dossier

1. Clic droit sur le dossier du projet → **Compresser** pour obtenir un `.zip`, puis envoie-le
   (Discord, Drive, mail, clé USB…).
2. La personne ouvre le `.zip`, entre dans le dossier et **double-clique sur `install.cmd`** :
   installation dans `%LOCALAPPDATA%\XozHub`, commande `xozhub` créée, et c'est fini.

Le `.env` voyage avec le dossier, donc la clé API n'a **rien** à régler : ni par toi, ni par
la personne qui installe.

### Version « une ligne dans cmd » (hébergement GitHub)

Le projet est en ligne : la personne n'a **rien à récupérer à la main**, elle colle une seule ligne
dans l'invite de commandes et l'IA s'installe.

```cmd
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Qays67/XozHubCmdIA/main/install-en-ligne.ps1 | iex"
```

`install-en-ligne.ps1` est un **fichier unique et complet** : le code de l'agent (déjà chiffré par
`fabriquer-protege.mjs`), `package.json`, `xozhub.cmd` et le `.env` voyagent **dedans**, en base64. Il fait
cinq choses, dans cet ordre : Node.js 18+ (avec installation via `winget` si besoin), écriture des fichiers
dans `%LOCALAPPDATA%\XozHub`, ajout de `xozhub` au PATH, dossier masqué + raccourci **XozHub.GPT** sur le
Bureau, puis lancement.

Conséquence, et c'est tout l'intérêt : **le dépôt n'a besoin d'aucun sous-dossier** — ni `bin\`, ni `src\`.
Ce seul fichier suffit, et l'installation ne télécharge rien d'autre : pas de `.zip`, pas de fins de ligne
CRLF à réparer, pas de dossiers à reconstituer, aucun risque d'archive incomplète. C'est la méthode
impossible à rater.

⚠ C'est un **artefact** : après une modification du code, refais-le — `node fabriquer-en-ligne.mjs` — et
remonte ce seul fichier sur le dépôt (le générateur embarque toujours la version chiffrée à jour).
Le plus simple : **double-clic sur `publier.cmd`** — il refait le fichier, le remonte sur le dépôt et
**vérifie que c'est bien la nouvelle version qui est servie**. Sans quoi la ligne échoue chez tout le
monde en annonçant un projet « incomplet ».

`install-depuis-le-depot.ps1` est l'ancienne version, qui téléchargeait le projet depuis le dépôt avant
d'installer : elle reste utile si tu veux que le dépôt serve le code source lisible, ou pour installer
depuis un dépôt déjà correctement rempli. Tout est détaillé pas à pas dans **`UNE-LIGNE.md`** : mise en
ligne du projet (avec ou sans compte GitHub), clé commune, vérification et dépannage.

> Méthode plus ancienne, toujours possible : joindre `install.cmd` à une Release et donner
> `curl -L -o "%TEMP%\xozhub-install.cmd" https://github.com/Qays67/XozHubCmdIA/releases/latest/download/install.cmd && "%TEMP%\xozhub-install.cmd"`.
> Elle dépend d'un `.cmd` servi avec ses fins de ligne CRLF, ce qui est fragile : la ligne ci-dessus
> est préférable.

`install.cmd` affiche sa progression et fait tout le travail :

1. il vérifie Node.js 18+ (et propose de l'installer via `winget` s'il manque) ;
2. il télécharge le code du dépôt (`SRC_URL`) et l'installe dans `%LOCALAPPDATA%\XozHub` ;
3. il écrit le fichier `.env` — clé reprise du `.env` fourni, sinon `API_KEY`, sinon **la clé est
   demandée** à la personne qui installe ;
4. il ajoute la commande `xozhub` au PATH de l'utilisateur ;
5. il pose un raccourci **XozHub.GPT** sur le **Bureau** : double-clic, et l'IA s'ouvre dans une
   fenêtre cmd. Le raccourci vise directement `xozhub.cmd` dans `%LOCALAPPDATA%\XozHub`, donc il
   marche même si le PATH de Windows n'a pas encore été rafraîchi — inutile de rouvrir une fenêtre ;
6. il **rassemble le code en un seul fichier chiffré** et **efface les sources** : chez la personne,
   il ne reste que ce fichier illisible, plus aucun script à lire ni à recopier. Le dossier
   d'installation est en plus **masqué** par Windows : on ne voit que l'icône du Bureau.

### Ce qui arrive chez la personne (et ce qui n'arrive pas)

Ce dépôt est public : son code, lui, est lisible par tout le monde. Ce que la protection change,
c'est ce qui **s'installe** sur la machine.

| | Sans protection | Avec `fabriquer-protege.mjs` |
| --- | --- | --- |
| chez la personne | `bin/` + `src/` en clair, `install.cmd`, `README.md` | **un seul fichier** `bin/xozhub.js`, chiffré |
| à l'écran | dossier visible dans `%LOCALAPPDATA%\XozHub` | dossier **masqué**, icône du Bureau seule |
| réutilisable ? | on ouvre, on lit, on recopie | illisible sans passer par le lanceur |

`fabriquer-protege.mjs` lit tous les modules (`bin/` + `src/`), les rassemble en un seul bloc, le
range dans une enveloppe **AES-256-GCM** et écrit à la place un petit lanceur qui déchiffre le bloc
**en mémoire** au démarrage — rien n'est jamais réécrit sur le disque. C'est le dernier pas de
`install.cmd`, et `fabriquer-installeur.mjs` s'en sert aussi pour le fichier unique.

Pour la voir à l'œuvre côté développement :

```cmd
node fabriquer-protege.mjs . dist\bin\xozhub.js
```

> ⚠️ **Ce n'est pas du chiffrement fort.** La clé voyage dans le lanceur : quelqu'un de déterminé
> peut la retrouver et lire le code. Ce qui est empêché, c'est la copie simple — ouvrir un fichier,
> lire l'agent, le reprendre tel quel. Pour une vraie protection, il faudrait que le code reste sur
> **ton** serveur et que le client ne soit qu'un afficheur ; c'est un autre projet.

Ensuite, double-clique sur l'icône **XozHub.GPT** du Bureau, ou ouvre une **nouvelle** fenêtre cmd et
tape `xozhub` : l'interface démarre et tu peux lui parler.

#### Mise en place, côté à toi (une seule fois)

1. Crée un dépôt **public**, branche `main`, et mets-y le code — l'interface web de GitHub suffit
   (*Add file → Upload files*), rien à installer sur ton PC. ⚠️ Glisse les **dossiers** `bin` et
   `src` eux-mêmes : glisser seulement les fichiers qu'ils contiennent ne recrée pas le dossier, et
   l'installation échoue alors à la copie.
2. Les **deux adresses** doivent pointer sur ton dépôt — elles sont déjà remplies pour
   `Qays67/XozHubCmdIA` :
   - dans `install-en-ligne.ps1` (`$SourceZip`) et `install.cmd` (`SRC_URL`) :
     `https://github.com/Qays67/XozHubCmdIA/archive/refs/heads/main.zip` ;
   - dans la ligne à donner :
     `https://raw.githubusercontent.com/Qays67/XozHubCmdIA/main/install-en-ligne.ps1`.
3. La **clé** n'est à régler nulle part : elle est déjà dans le `.env` du dépôt, et `install.cmd` le
   reprend tel quel. Chacun s'en sert donc sans rien taper. La contrepartie est à connaître : ce
   dépôt est **public**, donc cette clé est lisible par n'importe qui (robots qui scannent GitHub
   compris) et c'est ton compte qui paie. Le seul cas où quelqu'un doit taper quelque chose, c'est
   si tu supprimes `.env` du dépôt : `install.cmd` demande alors la clé à la personne qui installe,
   et il faut une clé X.GPT par personne.

**Rien d'autre à faire, aucune Release à fabriquer** : `install-en-ligne.ps1` rétablit lui-même les
fins de ligne **CRLF** des `.cmd` après le téléchargement, donc le `.zip` automatique de GitHub
convient très bien. `UNE-LIGNE.md` reprend tout ça pas à pas, y compris la méthode **sans compte
GitHub** (on envoie alors le fichier unique `XozHub-GPT-Installer.cmd`).

> Avec la méthode « on envoie le dossier », rien n'est à régler : les fichiers sont déjà à côté du
> `install.cmd` et le `.env` est repris tel quel.

## Le guide pour tout le monde

Le guide destiné aux personnes qui n'ont jamais ouvert un terminal : installer, première demande,
comment bien demander, commandes utiles, dépannage. Donne-le avec l'installateur : la personne est
autonome en dix minutes.

- **`docs/index.html`** — la page web, à donner comme lien ou à héberger (GitHub Pages) ;
- **`TUTORIEL.md`** — la version texte, pour le dépôt et les pièces jointes.

## Installation manuelle

1. Installe [Node.js 18 ou plus](https://nodejs.org) (une seule fois).
2. Dans le dossier du projet, vérifie que ta clé est présente dans `.env` :

```
XOZHUB_API_KEY=xgpt_...
```

3. Lance l'interface :

```cmd
xozhub
```

(ou `node bin\xozhub.js`, ou `npm start`)

Le plus simple : **double-clique sur `xozhub.cmd` dans le dossier du projet**. La première fois,
il propose d'installer la commande `xozhub` en la faisant pointer sur **ce dossier** — donc la
commande lance toujours cette version-là, jamais une copie. La question n'est posée qu'une fois.

Sinon, pour lancer `xozhub` depuis n'importe quel dossier, deux autres possibilités :

- **`link-dev.cmd`** — recommandé pendant le développement. Double-clic, et le dossier du projet
devient la commande `xozhub`. Une seule version installée, donc chaque modification du code est
prise en compte au lancement suivant, sans rien réinstaller.
- **`install.cmd`** — copie tout dans `%LOCALAPPDATA%\XozHub` et crée la commande globale.
Pratique pour partager, mais c'est une **copie** : il faut relancer `install.cmd` après chaque
modification du code, sinon la commande lance l'ancienne version.

Si une autre commande `xozhub` existe déjà sur la machine et passe avant la tienne, double-clique
sur **`forcer.cmd`** : il met le dossier du projet en tête du PATH et désactive les commandes
concurrentes quand c'est possible. En secours, **`xoz`** lance toujours la version de ce dossier,
puisque ce nom-là n'entre en conflit avec rien. Pour savoir laquelle répond, lance `verifier.cmd`.

## Utilisation

Tape ta demande puis **Entrée**. XozHub.GPT enchaîne alors tout seul : il propose une commande,
l'exécute, lit le résultat et continue jusqu'à ce que la demande soit terminée — **aucune
confirmation à donner**, et aucune limite sur l'enchaînement des étapes (un simple garde-fou,
`XOZHUB_MAX_TOURS`, coupe une boucle qui tournerait sans fin au-delà de 30 tours).

C'est le **mode automatique**, activé par défaut. Il va jusqu'au bout :

- il n'attend aucune validation — chaque commande part dès qu'il l'écrit ;
- il ne pose **aucune question** : s'il s'arrête pour t'en poser une (ou qu'il demande une
  confirmation), il est **relancé automatiquement** pour qu'il décide et termine — **sans limite
  de relances** (réglable avec `XOZHUB_MAX_RELANCES`, et une relance finit toujours par lui
  interdire de redemander) ;
- il vérifie son travail lui-même (il lance le code, lit les erreurs, corrige) et écrit
  `TERMINÉ` quand c'est fini.

Si tu préfères valider chaque commande, tape `/auto off` (l'agent affiche alors la commande et
attend `o` / `n`) ; `/auto` bascule entre les deux modes à chaud, et `/auto on` le réactive.

### Il ne refuse rien

Aucune demande technique n'est refusée ou renvoyée avec une mise en garde : système, réseau,
sécurité, scraping, automatisation, outils offensifs comme défensifs — l'agent traite le sujet sur
le plan technique et le fait. Pas de « je ne peux pas », pas de morale, pas de conseil de prudence
non demandé, pas de « il serait plus prudent de… ».

Il ne bavarde pas non plus : il n'annonce pas ce qu'il va faire, il ne commente pas sa propre
réponse, il ne propose jamais autre chose que ce qui a été demandé — et il n'introduit pas un
langage que la demande ne réclame pas (pas de Python « au fait », pas de PHP, pas de Java).

### Il répond, ou il agit ?

Avant chaque tour, XozHub.GPT regarde ce que tu viens d'écrire et en déduit l'intention :

| Ta demande | Ce qu'il fait |
| --- | --- |
| « c'est quoi un service worker ? », « pourquoi ça plante ? », « explique-moi ce fichier », « salut » | il **répond** en texte, sans rien modifier (il peut quand même lire le dossier — `dir`, `type`, `findstr`… — si c'est nécessaire pour répondre juste) |
| « bravo », « c'est moche », « j'aime pas le bleu », « ok merci beaucoup pour ton aide » | il **répond en une ligne**, et **rien ne se crée** : aucun fichier, aucune commande. Tu ne fais que lui parler — c'est l'application qui refuse d'écrire quoi que ce soit |
| « crée un site dans mon-site », « corrige le bug », « installe express », « tu peux me faire un serveur ? » | il **agit** : il travaille vraiment dans le dossier, exécute, vérifie et corrige |

En cas de doute, c'est l'action qui gagne : une demande vague le fait travailler plutôt que
bavarder. Et la reprise automatique du mode auto ne s'applique **qu'aux demandes d'action** —
une réponse à ta question n'est jamais relancée toute seule.

Un « ? » **n'importe où** dans la phrase suffit à en faire une question (même mal ponctuée), sauf
si elle contient un verbe d'action : « tu peux me créer un site ? » reste une demande d'action.

Un avis, un remerciement, une remarque (« c'est joli », « j'aime pas le bleu », « ok merci ») ne
déclenche **aucun travail** : l'agent répond, et rien d'autre. Ce n'est pas seulement une consigne
donnée au modèle : quand le message n'est pas une demande d'action, l'application **jette les
blocs d'écriture et les commandes** avant qu'ils n'atteignent le disque, et lui demande de répondre
en texte. Un dossier ne se remplit donc plus de scripts parce qu'on a dit « c'est pas mal ».
Et « ok, continue », « vas-y », « et alors ? » ne sont pas du bavardage : c'est une relance de la
tâche en cours, et l'agent reprend le travail là où il en était.

### Il crée les fichiers pour de vrai

En cmd.exe, écrire un fichier proprement oblige à bricoler des `echo … > fichier` ou des scripts qui
fabriquent les fichiers (accents cassés, guillemets perdus, sauts de ligne impossibles). L'agent
n'a plus besoin de ça : il écrit le contenu dans un bloc `write`, et **c'est l'application qui écrit
le fichier**, exactement comme il l'a écrit.

    ```write mon-site/index.html
    <!doctype html>
    <html lang="fr">
      <h1>Bonjour</h1>
    </html>
    ```

- un bloc par fichier, avec le **contenu complet** (un fichier existant est remplacé) ;
- les dossiers manquants sont créés : « fais un site dans mon-site » produit vraiment
  `mon-site/index.html`, `mon-site/style.css`… ;
- l'écran affiche **une ligne par fichier** (`✓ mon-site/index.html · 42 lignes · 1 234 o`), jamais
  le contenu, et l'agent enchaîne aussitôt la vérification (serveur local, test, ouverture) ;
- si le fichier contient lui-même des triples accents graves (un `README.md`, un tutoriel), le
  bloc s'ouvre avec **quatre** accents graves et ne se ferme qu'avec autant : rien n'est jamais
  coupé au milieu ;
- le prompt le lui interdit explicitement : pas de `echo > fichier`, pas de script générateur, pas de
  PowerShell pour du contenu. Il produit de vrais fichiers, du vrai code qui tourne.

### Il lit et il modifie sans casser

Les deux mêmes blocs existent pour **lire** et pour **modifier**, et pour la même raison : au
lieu de bricoler des commandes shell qui cassent les accents et coûtent un tour entier, c'est
l'application qui fait le travail.

    ```read src/app.js
    ```

    ```read src/app.js 200-320
    ```

- l'application lui rend le fichier **exactement** tel qu'il est sur le disque : mêmes accents,
  mêmes lignes. « type » en cmd.exe ne sait pas faire ça ;
- une **plage de lignes** quand le fichier est long, et sur un très gros fichier la réponse lui
  dit comment demander la suite — il ne noie pas son contexte ;
- un fichier binaire ou un dossier sont refusés proprement, avec la raison ;
- le journal affiche `◉ src/app.js · 1-500 sur 1 755 lignes lues`.

Pour modifier, un bloc `edit` remplace **seulement** ce qui change :

    ```edit src/app.js
    <<<<<<< ANCIEN
    const port = 3000;
    =======
    const port = 8080;
    >>>>>>> NOUVEAU
    ```

- plusieurs paires par bloc, plusieurs blocs par réponse ;
- si le passage apparaît **deux fois**, l'application refuse et le dit : il ajoute du contexte ;
- si l'indentation a bougé, elle est retrouvée (comparaison ligne à ligne sans les espaces) :
  le journal précise alors « indentation ajustée » ;
- si le passage est introuvable, elle le dit aussi, avec le geste à faire : relire puis recopier ;
- l'écran résume : `✓ src/app.js · 2 remplacements`.

Réécrire un fichier de 400 lignes pour changer trois lignes, c'est perdre du code au passage —
le prompt lui interdit donc `write` sur un fichier existant quand un `edit` suffit.

### Il copie un site entier, pages comprises

Quand c'est **le même site** qu'on veut, et pas « le même esprit », la reconstruction ne suffit
pas : il faut la copie. Elle se demande avec un bloc `clone`, et c'est l'application qui fait
tout le travail — le modèle n'a rien à télécharger à la main.

    ```clone https://exemple.fr mon-site

- elle ne prend pas que la page d'accueil : elle **suit les liens intérieurs** (menu, pied de
  page, articles, encadrés) et copie chaque page, jusqu'à douze pages sur deux niveaux ;
- elle ramasse les ressources sous toutes leurs formes : feuilles de style et leurs `url()`,
  `@import` et `@font-face`, scripts, images — **y compris celles en chargement différé**
  (`data-src`, `srcset`), les décors en `style="…"`, les icônes, le manifeste, les vidéos et
  les images de partage `og:image` ;
- chaque adresse devient un nom de fichier **sûr et unique** : `style.css?v=3` et `style.css?v=4`
  ne s'écrasent pas, et une image servie par `photo.php?id=7` prend l'extension de ce que le
  serveur a vraiment renvoyé ;
- les liens sont réécrits **depuis le dossier de chaque fichier** : une page dans
  `blog/article.html` pointe vers `../assets/…`, pas vers `assets/…`. La navigation reste dans la
  copie, d'une sous-page vers l'accueil comme d'une page vers ses styles ;
- ce qui n'a pas pu être pris (trop lourd, introuvable, hors du site) **garde son adresse
  d'origine** : un lien qui marche vaut mieux qu'un lien local mort — et l'application dit
  exactement quoi, y compris les pages du site qu'elle n'a pas copiées faute de place ;
- si la page est une **coquille rendue par JavaScript** (contenu fabriqué par le navigateur),
  elle le signale : la copie locale ne peut pas montrer ce contenu, et il vaut mieux le dire que
  de laisser croire que tout est là ;
- journal : `⧉ https://exemple.fr → mon-site/ · 156 fichier(s), 13 page(s), 2.1 Mo · 5 non récupéré(s)`.

Après la copie, l'application **vérifie ses propres références** (le même contrôle que pour un
site écrit à la main : chaque `src`, `href`, `url()` doit tomber sur un fichier qui existe).
Le prompt interdit ensuite au modèle de réécrire ces fichiers « pour faire joli » : une copie se
retouche avec des `edit`, et le reste ne bouge pas. Un `CLONE.md` rappelle l'adresse d'origine et
que le contenu reste la propriété de son éditeur.

### Il refait un site à partir d'un lien, une maquette à partir d'une capture

Deux entrées de plus, et c'est toujours la même idée : au lieu de deviner, l'application va
chercher l'information elle-même.

    ```fetch https://exemple.fr
    ```

- elle **télécharge la page** (et jusqu'à trois feuilles de style liées), écarte scripts,
  traqueurs et commentaires, et donne à l'agent : le titre, la description, la structure de la
  page **dans l'ordre** (en-tête, navigation et ses liens, titres, sections, boutons, pied de
  page), les vrais textes, les polices réellement chargées, les images en adresse absolue, les
  variables CSS déclarées, et surtout la **palette** — chaque teinte avec sa part d'occupation,
  la plus saturée marquée comme accent ;
- avec ça, « refais-moi ce site » devient une reconstruction : les couleurs sont celles du site,
  pas une impression. Le prompt lui interdit de recopier un fichier du site ou de réutiliser ses
  images par lien — il redessine les visuels en SVG ou en dégradé ;
- **pas besoin de la demander** : un lien collé dans ta phrase (`refais-moi https://exemple.fr`)
  est visité tout seul **avant** que l'agent commence à répondre — il a déjà la palette et la
  structure en main. Une même adresse n'est visitée qu'une fois par session ;
- l'adresse peut s'écrire sans `https://`, et ce qui n'est pas une page (un `.css`, un `.js`, un
  `.json`) est renvoyé tel quel ;
- journal : `🌐 https://exemple.fr · page analysée · 15 916 caractères utiles`.

    ```image maquettes/accueil.png
    ```

- l'application **décode vraiment l'image** (PNG : zlib et dé-filtrage des lignes) et en tire la
  palette réelle : fond dominant, neutres, couleur d'accent, chacun avec sa **part de surface**
  mesurée. Ça marche même avec un modèle qui ne voit pas les images ;
- l'image est **jointe** en plus, pour les modèles qui savent la regarder : ils voient la mise en
  page, pas seulement les couleurs. Si le modèle refuse les images, l'application s'en aperçoit
  une fois, retire l'image, garde la palette et **rejoue le tour** — rien n'est perdu ;
- journal : `🖼 capture.png · 1440×900 · png · 3 teintes extraites`.

### Il refait le même, et il le retouche si tu le demandes

L'analyse ne sert pas seulement à s'inspirer : tant qu'un site (ou une capture) a été analysé, il
devient la **cible** de la session, et l'agent sait exactement ce qu'il reproduit.

- « fais le même site » → reconstruction fidèle : même ordre des parties, **mêmes textes** (ils
  sont extraits paragraphe par paragraphe, section par section), mêmes couleurs, mêmes
  **proportions** — largeurs de conteneur, paddings, tailles de texte, rayons, grilles, points de
  rupture sont relevés dans le CSS de l'original ;
- « enlève la section tarifs », « change l'accent en vert », « ajoute une page contact » → il
  repart de la même copie et n'applique **que** la différence demandée ; tout le reste ne bouge pas ;
- la cible est rappelée au modèle **à chaque tour** (adresse, palette, parties), donc pas besoin de
  la redonner trois messages plus loin quand tu demandes une retouche.

Et parce qu'une copie se juge d'abord à sa couleur, l'application **mesure la fidélité** après
chaque écriture : elle compare les teintes livrées à celles de la cible dans OKLab — l'espace de la
perception — en comptant le fond et l'accent double, puisque ce sont eux qui se voient.

    🎯 Fidélité des couleurs : 75 % sur 6 teintes visées — proches : #0b1020 → #111827 · à reprendre : #6366f1

Sous 80 %, l'agent a droit à une **seconde relecture**, la cible et l'écart sous les yeux : une
copie dont la palette est fausse n'est pas une copie.

### Il relit avant de livrer

Une page finie ne se juge pas à l'œil : elle se vérifie. À chaque fois que l'agent écrit un
fichier, **l'application relit ce qui vient d'être écrit** — sans rien lui demander — et lui
renvoie la liste de ce qui ne va pas :

- **le travail web** : `<!doctype html>`, `charset`, `viewport`, `<title>` rempli, `lang`,
  `header`/`nav`, `footer`, au moins deux sections, un seul `h1`, un `alt` sur chaque image,
  les balises de partage `og:`, le favicon, et la chasse aux `Lorem ipsum` / « Texte ici » /
  « à compléter » ;
- **le CSS** : `:root` avec ses variables, les couleurs écrites en dur hors `:root`,
  les `!important`, la présence d'une `@media` et d'un `:focus-visible`, le `box-sizing`, le
  nombre de polices, les transitions ;
- **le JavaScript** : les `console.log`, les `TODO`, les `debugger`, les `eval(` ;
- **les références locales** : chaque `src`, `href` et `url(…)` doit mener à un fichier qui
  existe vraiment. Une image introuvable s'affiche en rouge dans le journal, et l'agent la corrige.

Tout ça tient sur **une ligne** dans le journal, du genre :

    🔍 Contrôle qualité : 7 points à corriger dans index.html, style.css (dont 2 bloquants) — …

Ensuite, **avant de te rendre la main**, l'agent est renvoyé une fois sur ses propres fichiers
avec une liste de contrôle complète : le *design* pour une page (palette, espacement,
typographie, hiérarchie, mobile, finitions) et la *propreté* pour du code (cas limites,
exécution réelle, restes de debug). S'il reste du bloquant, il a droit à **une seconde
relecture** — jamais plus de deux, donc jamais de boucle.

Une relecture tient en **un seul tour** : l'agent corrige par blocs `edit` (le passage exact à
remplacer, pas le fichier entier) et vérifie sa correction dans la même réponse. Réécrire une page
de 400 lignes pour changer trois valeurs, c'est du temps perdu et du code perdu au passage.

Pour ça, le prompt ne lui donne pas des conseils : il lui donne des **valeurs**. Les jetons CSS
sont écrits dans le prompt, avec trois directions artistiques complètes (« Nuit douce »,
« Éditorial clair », « Néon maîtrisé » : fonds, surfaces, textes, accents, polices) plus les
détails de composants qui font la différence — en-tête collant, cartes qui montent au survol,
:focus-visible, pied de page.

`XOZHUB_RELECTURE=off` coupe la relecture automatique (le contrôle des références et le
contrôle qualité restent, eux, toujours actifs).

### Il reste concentré

L'agent traite **uniquement le dernier message** : les échanges précédents lui servent de contexte,
jamais de liste de tâches à finir. Concrètement :

- un **rappel d'ancrage** est collé au dernier message à chaque tour : il redit quelle est la seule
  demande en cours (« QUESTION », « DEMANDE D'ACTION »…) et que tout le reste n'est que du contexte.
  C'est la consigne que le modèle lit juste avant d'écrire, donc celle qui pèse le plus. Il y
  rappelle aussi les trois interdits : aucune techno qui ne soit ni dans la demande ni dans le
  projet (pas de Python « au fait »), aucun fait non lu ni non observé, et aucune commande qui ne
  fasse pas avancer la demande en cours ;
- le **contexte du projet et la mémoire** (`XozHub.md`) sont envoyés comme du **décor, pas comme un
  sujet** : ils servent à ne pas se tromper quand la demande concerne le projet, et à rien d'autre ;
- **aucune techno hors sujet** : un langage, un framework, un outil ou un fichier n'est nommé que
  s'il apparaît dans la demande ou dans le projet — pas d'exemple de code dans un autre langage au
  passage, pas de « et si on le faisait en … » ;
- une question sans rapport avec le dossier se répond **sans jamais parler du dossier ni du projet** ;
- l'historique envoyé au modèle est **borné** (16 derniers messages) et chaque message est **tronqué**
  à 3 000 caractères — le journal garde toute la sortie, le modèle n'en reçoit que l'essentiel ;
- un simple **bonjour / merci** part sans historique du tout : rien à quoi s'accrocher ;
- la mémoire est bornée elle aussi : au-delà de 4 000 caractères, ce sont les **notes récentes** qui
  partent (plus le titre), jamais un gros bloc de notes anciennes ;
- l'état du projet (fichiers, git, scripts) est **relu à chaque message**, donc il ne parle jamais
  d'un fichier qui a changé ou disparu ;
- la **température est basse** (0.2) : il suit le sujet au lieu de divaguer ;
- les blocs techniques (`run`, `memory`) et les annonces creuses (« je vais maintenant vérifier… »)
  sont **retirés de l'affichage** — à l'écran il ne reste que la commande et le résultat ;
- le prompt lui interdit explicitement le hors-sujet : pas d'actualité, pas de conseils non demandés,
  pas de fichier bonus, pas de « prochaines étapes », rien d'inventé — un fichier se lit avant d'en parler.

### Il répond court

Pas de bavardage : il n'annonce pas ce qu'il va faire (« je vais maintenant vérifier… »), il ne
récapitule pas ce que la sortie juste au-dessus montre déjà, il ne rappelle pas le dossier de
travail ni le système (c'est écrit en haut de l'écran), pas de « n'hésite pas », pas de conseils
non demandés. La réponse contient le résultat, la réponse ou le code — et rien d'autre.

### Où il travaille

Le **dossier de travail** (affiché dans la barre du bas, `/dir` pour le changer) est son point de
départ. Ensuite, **c'est ta demande qui décide** : si tu nommes un dossier ou un projet
(« fais un site dans `mon-site` »), il le crée si besoin et travaille dedans ; sinon il travaille
directement dans le dossier de travail.

### Commandes

Il n'y a que **deux commandes** : tout le reste se demande en français.

| Commande | Rôle |
| --- | --- |
| `/miseajour` | dernière version du code **et** de l'IA, puis redémarrage — dans une **nouvelle fenêtre cmd**, avec le bandeau « En cours de mise à jour… » |
| `/couleurs` | règle les couleurs : `truecolor`, `256`, `16` ou `none`, ou une **palette** (`/couleurs ocean`) |

Toute autre ligne commençant par `/` affiche simplement le rappel : écris ta demande en français.
`/miseajour code` redémarre tel quel, sans chercher de nouveau code ni de nouveau modèle.

### Les palettes de couleurs

`/couleurs <palette>` — par exemple `/couleurs ocean` — change **tout** d'un coup : logo, cadres,
rails, badges, spirale. Il n'y a plus de bouton dans la barre du bas : la commande suffit, et
`/couleurs` seul redonne la liste des palettes.

| Palette | Ambiance |
| --- | --- |
| **Galaxie** | le défaut : nébuleuse violette, cyan glacé et rose stellaire |
| **Aurore** | violet indigo, cyan et menthe |
| **Océan** | bleus profonds et turquoise, chaud en ambre |
| **Forêt** | verts et turquoise, or et miel |
| **Sunset** | orangés et roses, comme un soir d'été |
| **Néon** | magenta et cyan saturés |
| **Crépuscule** | indigo et mauve, rose au bout |

Le choix est **enregistré** dans `.xozhub.json` et repris au lancement suivant. Changer de palette
change **tout** d'un coup — logo, cadres, rails, badges, spirale — parce qu'une palette est un jeu
complet de seize teintes, pas un réglage isolé : impossible d'obtenir une interface bariolée dont on
a oublié un morceau. Deux teintes gardent leur sens dans toutes les palettes : la menthe dit
« réussi », le corail dit « erreur ».

Ajouter une palette se fait dans un seul endroit, `src/theme.js` (`PALETTES`) : il suffit de donner
seize teintes, tout le reste en dérive.

### Il connaît déjà ton projet

Au démarrage (et après chaque `/dir`), l'agent fait sa propre enquête dans le dossier de travail :
technos repérées (`package.json`, `tsconfig.json`, `pyproject.toml`, `Cargo.toml`…), scripts npm,
dépendances, **état git** (branche + fichiers modifiés), début du `README.md` et un aperçu de
l'arborescence. Tout ça part dans le prompt : il répond en connaissant le terrain, sans que tu
racontes le projet. `/context` affiche exactement ce qu'il a sous les yeux.

### Il se souvient (mémoire du projet)

`XozHub.md`, à la racine du dossier, est la mémoire durable du projet : choix techniques, ports,
conventions, pièges à éviter. Elle est relue à chaque tour, et tu peux l'éditer à la main.

- l'agent l'enrichit **tout seul** : quand il a quelque chose de durable à retenir, il termine sa
  réponse par un bloc `memory` et la note est ajoutée (`🧠 Mémoire du projet mise à jour`) ;
- toi, tu fais pareil à la main avec `/remember le port de l'API est 8787` ;
- `/memory` relit les notes, `/forget` efface tout.

### Se mettre à jour : `/miseajour`

Tape `/miseajour` : XozHub.GPT fait un `git pull --ff-only` dans son dossier d'installation (si
c'est bien un dépôt git), t'annonce s'il y avait du nouveau, puis **se relance tout seul dans le
même terminal** avec le code à jour. Comme la conversation est sauvegardée juste avant, la
nouvelle instance **reprend la session automatiquement** — tu ne perds ni l'historique ni les
fichiers de travail.

Pendant l'opération, un **titre en haut de l'écran** annonce `MISE À JOUR EN COURS` (le titre de la
fenêtre du terminal suit aussi) ; quand c'est terminé, la nouvelle version affiche
`MISE À JOUR VALIDÉE` pendant **3 secondes**, puis le bandeau disparaît tout seul. Si le pull échoue
(ou que l'installation vient d'un `.zip`, sans dépôt git), le titre indique `MISE À JOUR INCOMPLÈTE`
— il reste affiché 3 secondes avant le redémarrage pour que tu puisses le lire.

La même commande met aussi **l'IA à la dernière version** : elle redemande la liste des modèles au
compte, compare les numéros de version dans la famille du modèle courant (« `deepseek-v4-flash` »
→ « `deepseek-v5-flash` »), bascule dessus si une version plus récente est apparue et l'enregistre
dans `.xozhub.json`. Le choix reste dans la même famille et, à version égale, garde la variante
courante (`flash` reste `flash`) ; si le compte est injoignable, le redémarrage se fait quand même
et l'ancien modèle est conservé.

- `/miseajour code` : redémarre tel quel, sans chercher de nouveau code ni de nouveau modèle (utile
  quand tu bricoles le code).
- Installé par `.zip` (donc sans dépôt git) : le redémarrage marche quand même, il faut juste
  remplacer les fichiers à la main pour changer de version.
- Le menu de fin de session propose aussi « Redémarrer (recharge le code) ».

### Les sessions se reprennent

La conversation est **sauvegardée automatiquement** (à la fin de chaque tour et en quittant) dans
`.xozhub-session.json`, dans le dossier de travail. Au lancement suivant dans ce dossier, tape
`/resume` (ou choisis « Reprendre la dernière session » dans le menu de fin de session) : les
messages, le journal affiché et le modèle reviennent comme si tu n'étais jamais parti.

Ajoute `.xozhub-session.json` (et `XozHub.md` si tu ne veux pas la partager) au `.gitignore`
de tes projets.

### Écrire pendant qu'il travaille

La zone de saisie reste ouverte pendant que l'agent réfléchit, écrit ou exécute : tu peux taper
la suite tranquillement. `Entrée` ne l'envoie pas tout de suite — le message est **gardé en
attente** (compteur `⏳` dans la case) et part automatiquement dès que le tour en cours est fini.

Pour le faire taire tout de suite, deux possibilités : le bouton **■ STOP** affiché dans la case
de saisie (clique dessus), ou `Échap` / `ctrl-c`. Après un arrêt manuel, un message gardé revient
dans la zone de saisie au lieu de partir tout seul : tu le relis, tu le modifies, tu l'envoies.

### Fin de session : le menu

Un clic sur **✕ End session** ne coupe plus tout : il ouvre un **écran de choix** dans la case
de saisie, et c'est toi (ou la personne à qui tu passes la main) qui décide de la suite.

| Choix | Effet |
| --- | --- |
| `1` Nouvelle session | conversation vidée, écran réinitialisé, on repart de zéro dans la même fenêtre |
| `2` Reprendre la dernière session | recharge la conversation sauvegardée dans ce dossier |
| `3` Ouvrir une nouvelle fenêtre XozHub.GPT | lance une **vraie nouvelle fenêtre** de terminal avec un xozhub neuf, puis ferme celle-ci |
| `4` Redémarrer | recharge le code et reprend la session en cours |
| `5` Quitter XozHub.GPT | ferme la session |

Navigation : `↑` `↓` puis `Entrée`, les touches `1` à `5`, ou un **clic** sur une ligne.

Pour ressortir des choix sans rien faire, clique sur la **✕** en haut à droite du panneau —
toute la **ligne du haut** est cliquable, pas seulement le caractère — ou appuie sur `Échap`,
`q` ou `x` : tu reviens à la conversation en cours. `ctrl-c` (ou `ctrl-q`) quitte directement
depuis le menu. Rien ne peut donc te bloquer dans cet écran.

Si l'agent était en train de travailler au moment du clic sur End session, il est coupé
proprement avant l'ouverture du menu.

### Style

Interface en palette « galaxie », colorée et lisible : **chaque rôle a sa couleur**. Tout ce qui
vient de toi est **chaud** (or → ambre → orange → corail → rose), tout ce qui vient de l'IA est
**froid** (magenta → violet → bleu → cyan → menthe), les commandes sont **menthe**, les fichiers
écrits **vert menthe**, les erreurs **corail**, les sorties **indigo discret** : au premier regard,
on sait qui parle et ce qui se passe.

Les couleurs s'adaptent au terminal : **truecolor** (24 bits) quand il sait le faire, sinon
**256 couleurs**, sinon les **16 couleurs de base** — il y a donc toujours de la couleur à l'écran.
`NO_COLOR=1` coupe tout, `XOZHUB_COLOR=256` force un mode, et `/couleurs` change à chaud dans
l'application (`truecolor`, `256`, `16`, `none`).

- **en-tête** — logo ASCII au grand dégradé indigo → violet → magenta → rose → cyan → menthe,
  assombri vers le bas pour lui donner du relief, pastille `.GPT` cyan ; deux étiquettes
  `▸ Directory` / `▸ code` ; filet dégradé ponctué d'un `◆` violet.
- **conversation** — messages de l'utilisateur sur un rail **chaud** (or → ambre → orange → corail →
  rose) avec un badge `TOI` en or ; réponses de l'IA dans une **carte sombre** aux rails dégradés
  magenta → violet → bleu → cyan → menthe, nom en dégradé et état `écrit…` en vert vif dans le
  bandeau ; commandes sur un badge `$` menthe ; fichiers écrits sur un badge `✓` vert ; sorties le
  long d'un rail indigo discret ; erreurs en badge `!` corail ; lignes de service avec une pastille
  dont la teinte annonce le contenu (✓ menthe, ! or, 🧠 magenta, ⏳ orange, ◆ cyan).
- **saisie** — **carte sombre pleine largeur** (fond continu, filets haut/bas en dégradé
  cyan → menthe → lime, rails qui se fondent), invite `❯` rose, et une ligne d'aide où chaque
  raccourci a sa couleur : `↵ envoyer · /miseajour mise à jour · mode [auto|manuel] · ✕ End
  session`, le mode en pastille (menthe en auto, or en manuel).
- **barre du bas** — fond dégradé indigo nuit → bleu nuit, badge `XozHub.GPT` en dégradé
  magenta → violet → cyan → menthe, pastille d'état (menthe au repos, cyan quand il écrit, or quand
  il exécute) et bouton `✕ End session` en dégradé violet → rose.
- **animation** — la spirale d'attente traverse tout le spectre (magenta, violet, bleu, cyan,
  menthe, lime) et le menu de fin de session s'ouvre sur un titre dégradé avec la ligne choisie en
  bleu vif.

Tout est calculé en caractères et codes ANSI uniquement — aucune dépendance.

Les réponses de l'IA sont **habillées en teintes vives** : son nom passe en dégradé rose → violet →
cyan dans l'en-tête du panneau (et pendant qu'il travaille), les titres `#` ressortent en rose ou
cyan, les puces et numéros en rose/cyan, les citations en violet, `` `code` `` sur un badge sombre,
`**gras**` en blanc vif, et le mot final `TERMINÉ` s'affiche en badge vert. Les blocs de code sont
rendus en menthe, leurs délimiteurs en violet vif.

### Raccourcis

- `Entrée` envoyer — pendant une réponse : garder le message pour la fin du tour
- `■ STOP` (clic) / `Échap` / `ctrl-c` interrompre (pendant une réponse ou une commande)
- `ctrl-c` sur une saisie vide : quitter directement
- clic sur **✕ End session** (en bas à droite) : ouvrir le menu de fin de session
- `↑` `↓` historique, molette ou `Page↑` `Page↓` pour faire défiler
- `ctrl-l` effacer l'écran, `ctrl-u` vider la ligne

Le **titre de la fenêtre** du terminal suit l'état de l'agent (`écrit…`, `exécute…`, `prêt`) et un
bip discret retentit à la fin d'un tour qui a duré plus de 8 secondes : tu peux aller faire
autre chose et revenir quand ça sonne.

## Configuration

Ordre de priorité : variables d'environnement, puis `.env`, puis `.xozhub.json` (écrit automatiquement quand l'agent bascule de modèle).

| Variable | Défaut |
| --- | --- |
| `XOZHUB_API_KEY` | *(requis)* |
| `XOZHUB_BASE_URL` | `https://xgpt-api.xshe.workers.dev/v1` |
| `XOZHUB_MODEL` | `xgpt-code` (voir `.env.example` : `xgpt-smart`, `xgpt-deepseek`, `xgpt-sol`, `xgpt-kimi`, `xgpt-glm`…) |
| `XOZHUB_COLOR` | *(auto)* `truecolor`, `256`, `16` ou `none` — l'auto s'adapte au terminal |
| `XOZHUB_PALETTE` | `galaxie` (défaut), `aurore`, `ocean`, `foret`, `sunset`, `neon`, `crepuscule` |
| `XOZHUB_AUTO` | `1` (exécution sans confirmation) |
| `XOZHUB_TEMPERATURE` | `0.2` (agent concentré ; `off` pour ne pas envoyer le paramètre) |
| `XOZHUB_MAX_RELANCES` | aucune limite (`3` pour brider les relances automatiques) |
| `XOZHUB_MAX_ECRITURES` | aucune limite (plafond d'écritures de fichiers d'affilée) |
| `XOZHUB_MAX_TOURS` | `30` (garde-fou : tours de l'agent pour une même demande ; `off` pour aucune limite) |
| `XOZHUB_RELECTURE` | `on` (relecture du travail livré avant de rendre la main ; `off` pour couper) |
| `XOZHUB_HISTORIQUE` | `16` (messages renvoyés au modèle ; `off` pour tout garder) |
| `XOZHUB_MESSAGE_MAX` | `3000` (taille max d'un message envoyé au modèle ; `off` pour ne rien couper) |
| `XOZHUB_DOCUMENT_MAX` | `40000` (taille max d'un document joint : fichier lu, site analysé) |

Toutes ces variables de plafond acceptent `0`, `off` ou `non` pour dire « aucune limite » — l'agent
est **sans plafond par défaut** sur les relances et les écritures ; ces réglages ne servent qu'à le
brider, ou à le protéger d'une boucle qui n'en finit pas.

Au démarrage, XozHub.GPT interroge `/v1/models` : si le modèle configuré n'existe pas, il bascule
automatiquement sur le plus récent de sa famille, sinon sur le meilleur disponible du compte. Et si
le modèle réglé est un ancien modèle « passe-partout » (`xgpt-glm`, `xgpt-mini`, `xgpt-flash`)
alors que le compte propose mieux, il monte dessus et l'enregistre — l'IA est donc toujours sur le
meilleur modèle possible, sans rien régler.

## Structure

```
install.cmd      installateur Windows (une ligne à coller dans cmd)
fabriquer-exe.cmd fabrique l'installateur XozHub-GPT-Setup.exe (un seul fichier à donner)
docs/index.html  LE site (GitHub Pages) : la ligne à coller dans cmd, ce qui marche, les autres méthodes, dépannage
TUTORIEL.md      le tutoriel complet en texte, à joindre à l'installateur
fabriquer-protege.mjs rassemble bin/ + src/ en UN SEUL fichier chiffré (le code livré est illisible)
fabriquer-og.mjs fabrique docs/og.png : l'aperçu galaxie du lien (le carré des partages WhatsApp / Discord)
ia/              XozHub.AI : la nouvelle IA en fenetre graphique (voir ia/README.md)
ia/serveur.mjs   le coeur : serveur local, agent (write/edit/run), ouverture de la fenetre, bouton dossier
ia/ui.html       la fenetre : conversation, dossier, fichiers, journal - palette galaxie
ia/installer.ps1 ce que le .exe execute : Node.js, installation, raccourci du Bureau, lancement
ia/fabriquer-exe.ps1 fabrique dist/XozHub-AI-Setup.exe (IExpress, un seul fichier)
dist/            ce qu'on envoie : XozHub-GPT-Setup.exe + XozHub-GPT-Installer.cmd (voir dist/README.md)
fabriquer-en-ligne.mjs fabrique install-en-ligne.ps1 : le fichier unique qui contient tout (code chiffré inclus)
publier.cmd      publie la ligne d'installation : refabrique le fichier, le remonte sur le dépôt, vérifie (double-clic)
publier.ps1      ce que fait publier.cmd (récupération du dépôt, copie, commit, envoi, contrôle)
install-en-ligne.ps1 CE QUE LA LIGNE TÉLÉCHARGE : installation complète, code chiffré embarqué (artefact)
install-depuis-le-depot.ps1 ancienne méthode : télécharge le dépôt, répare les CRLF, appelle install.cmd
UNE-LIGNE.md     comment mettre le projet en ligne et quelle ligne donner à tout le monde
link-dev.cmd     installation « live » : le dossier du projet devient la commande xozhub
forcer.cmd       force la commande xozhub à lancer le dossier du projet
verifier.cmd     diagnostic : quelle version répond quand on tape xozhub
xoz.cmd          alias garanti, insensible aux conflits de nom
bin/xozhub.js    point d'entrée
src/app.js       boucle de l'agent (clavier, streaming, exécution)
src/ui.js        rendu de l'interface (logo, journal, barre, boîte de saisie)
src/api.js       client X.GPT (streaming SSE)
src/ascii.js     logo en blocs + dégradé bleu
src/theme.js     palettes (galaxie par défaut) + dégradés (mix, ramp)
src/config.js    .env / .xozhub.json
src/context.js   contexte du projet (git, technos, fichiers) + mémoire durable
src/session.js   sauvegarde et reprise de la conversation
src/write.js     écriture directe des fichiers demandés par l'agent (blocs write)
src/exec.js      exécution des commandes shell, presse-papiers, nouvelle fenêtre
src/keys.js      analyse des touches et de la souris
src/terminal.js  écran alternatif, mode raw
```

Aucune dépendance externe : le projet utilise uniquement Node.js.
