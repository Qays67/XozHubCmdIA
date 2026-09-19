# Donner XozHub.GPT à tout le monde — la ligne à coller dans cmd

La personne ouvre une fenêtre **cmd**, colle **une seule ligne**, appuie sur Entrée : XozHub.GPT
s'installe tout seul. Rien à télécharger à la main, rien à décompresser.

---

## 1. La ligne, prête à envoyer

```
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Qays67/XozHubCmdIA/main/install-en-ligne.ps1 | iex"
```

Copie-la telle quelle dans un message (Discord, SMS, mail…). C'est tout.

Ce que ce fichier fait, dans l'ordre :

1. il vérifie **Node.js 18+** et propose de l'installer automatiquement (`winget`) s'il manque ;
2. il écrit l'IA dans `%LOCALAPPDATA%\XozHub` — le code y arrive **chiffré** : aucun script lisible
   n'est déposé sur le disque ;
3. il ajoute la commande `xozhub` au PATH de l'utilisateur ;
4. il masque le dossier d'installation et pose le raccourci **XozHub.GPT** sur le Bureau
   (double-clic = l'IA s'ouvre dans une fenêtre de terminal) ;
5. il lance l'IA.

Le code ne vient **pas** du dépôt : il voyage *dans* `install-en-ligne.ps1`. Rien d'autre n'est
téléchargé, rien n'est décompressé, et aucun sous-dossier du dépôt n'est nécessaire.

---

## 2. Ton dépôt, et ce qu'il doit contenir

| | |
| --- | --- |
| Adresse | `https://github.com/Qays67/XozHubCmdIA` |
| Branche utilisée | `main` |
| Visibilité | **Public** (un dépôt privé = ligne qui ne marche pour personne) |

**Un seul fichier est indispensable, à la racine du dépôt :**

```
install-en-ligne.ps1      ← ce que la ligne télécharge, et qui contient tout
```

C'est tout. Ce fichier embarque le code de l'agent (chiffré), `package.json`, `xozhub.cmd` et le `.env` :
la personne qui l'exécute n'a besoin de rien d'autre, et **aucun sous-dossier n'est nécessaire** — ni
`bin/`, ni `src/`. Pas de dossier à glisser correctement, pas d'archive à décompresser, pas de fichier
qui manque : c'est ce qui rend cette méthode impossible à rater.

⚠️ Ce fichier est un **artefact** : ne l'édite pas à la main. Après une modification du code, refais-le
et remonte-le :

```
node fabriquer-en-ligne.mjs
```

Le plus simple, et c'est ce qui évite l'erreur la plus fréquente : **double-clic sur `publier.cmd`**.
Il refait le fichier, le remonte sur le dépôt et **vérifie que c'est bien la nouvelle version qui est
servie**. Si le dépôt sert encore l'ancienne, la ligne échoue chez tout le monde en annonçant un
projet « incomplet » — ce contrôle le dit tout de suite.

Pour savoir si c'est bon, ouvre cette adresse dans ton navigateur — elle doit **afficher du code**,
pas « 404 » :

```
https://raw.githubusercontent.com/Qays67/XozHubCmdIA/main/install-en-ligne.ps1
```

*(Si tu veux aussi pouvoir utiliser l'autre méthode — `install-depuis-le-depot.ps1`, qui télécharge le
projet depuis le dépôt —, remonte en plus les dossiers `bin/` et `src/` **eux-mêmes**, pas les fichiers
qu'ils contiennent. Ce n'est plus nécessaire pour la ligne du point 1.)*

---

## 3. La clé API commune

Ton fichier **`.env` est dans le dépôt** : le `.zip` téléchargé le contient, `install.cmd` le reprend
et le pose dans `%LOCALAPPDATA%\XozHub\.env`. **Personne n'a donc rien à taper** : tout le monde
utilise la même clé, automatiquement.

C'est aussi la **seule source** de la clé : il n'y a rien à remplir dans `install-en-ligne.ps1`, qui
pose telle quelle la clé du projet. Le seul réglage de ce fichier est son adresse, tout en haut :

```
$Depot   = 'Qays67/XozHubCmdIA'   # proprietaire/nom du depot GitHub
$Branche = 'main'                 # branche utilisee (un depot prive ne marche pour personne)
```

Si un jour tu supprimes `.env` du dépôt, `install.cmd` **demande la clé** à la personne qui installe :
c'est le seul cas où quelqu'un doit taper quelque chose.

> ⚠️ **À savoir, sans détour.** Ton `.env` est dans un dépôt **public** : ta clé est donc lisible par
> n'importe qui, y compris des robots qui scannent GitHub en permanence. Elle peut être utilisée par
> des gens à qui tu ne l'as pas donnée — et c'est ton compte qui paie. Si ça t'inquiète, supprime
> `.env` du dépôt et laisse chacun mettre sa clé.
>
> Autre point : si tu changes de clé un jour, il faut **remplacer `.env` dans le dépôt**, sinon toutes
> les futures installations installeront l'ancienne clé.

### Le piège qui casse tout : `.gitignore`

Par défaut git **n'envoie pas** les fichiers commençant par un point, et ce projet ignorait `.env`.
Résultat : la clé restait sur ton PC, le `.zip` du dépôt n'en avait pas, et **chacun devait taper la
sienne** — exactement ce que tu ne veux pas. C'est corrigé : `.env` n'est plus ignoré.

Vérifie quand même que le fichier est bien arrivé. Ouvre cette adresse dans ton navigateur :

```
https://github.com/Qays67/XozHubCmdIA/blob/main/.env
```

- elle **affiche tes trois lignes** → c'est bon, rien à faire ;
- elle affiche **404** → le fichier manque. Sur la page du dépôt : **Add file → Create new file**,
nomme le fichier `.env`, colle exactement ceci (avec TA clé), puis **Commit changes** :

```
XOZHUB_API_KEY=xgpt_ta_vraie_cle
XOZHUB_BASE_URL=https://xgpt-api.xshe.workers.dev/v1
XOZHUB_MODEL=xgpt-code
```

> Créer le fichier depuis GitHub est plus sûr que de le glisser : les fichiers qui commencent par un
> point sont souvent **masqués** dans la fenêtre de sélection, et on croit les avoir envoyés.

---

## 4. Vérifier avant d'envoyer la ligne à tes potes

Fais-le **toi-même une fois**, sinon tu découvriras les problèmes par tes amis :

1. ouvre une **nouvelle** fenêtre cmd, colle la ligne, Entrée ;
2. tu dois voir `[1/6]`, `[2/6]`, `[3/6]`, `[4/6]`, `[5/6]`, `[6/6]`, puis l'écran d'installation de
   XozHub ;
3. vérifie qu'un raccourci **XozHub.GPT** est apparu sur ton **Bureau** : double-clic dessus, l'IA
   doit s'ouvrir dans une fenêtre cmd ;
4. ouvre aussi une nouvelle fenêtre cmd et tape `xozhub` : l'interface doit démarrer ;
5. si tout va bien, envoie la ligne.

Pour retester comme si tu n'avais rien installé : supprime le dossier
`%LOCALAPPDATA%\XozHub` (colle ce chemin dans la barre d'adresse de l'Explorateur).

---

## 5. Ce que la personne voit, de son côté

1. Touche Windows, tape `cmd`, Entrée.
2. Clic droit dans la fenêtre = coller, puis Entrée.
3. Les fichiers arrivent, l'installation se fait toute seule.
4. Une nouvelle fenêtre s'ouvre : elle tape `xozhub`, et l'IA démarre.
5. Un raccourci **XozHub.GPT** apparaît sur son **Bureau** : c'est ce qu'elle utilisera le plus —
   double-clic, et l'IA s'ouvre dans une fenêtre cmd.
6. Ensuite, `xozhub` marche dans n'importe quel dossier, pour toujours.

Si tu veux qu'elle se débrouille seule : envoie-lui aussi **`TUTORIEL.md`**, ou l'adresse de la page
`docs/tutoriel.html` si tu publies le site (voir point 7).

---

## 6. Dépannage

| Ce qui arrive | Quoi faire |
| --- | --- |
| `Le fichier d'installation est incomplet ou abime` | Le téléchargement s'est mal terminé : relance simplement la ligne. |
| `Impossible d'ecrire les fichiers dans ...` | Dossier verrouillé (antivirus, sauvegarde en cours) : réessaie dans une minute, ou redémarre le PC. |
| `irm : ... n'est pas reconnu` | Ligne collée dans autre chose que cmd (PowerShell très ancien, Git Bash…). Fais-la coller dans une vraie fenêtre **cmd**. |
| L'écran se ferme aussitôt | cmd a été lancé depuis un raccourci, ou un `exit` a été tapé. Relance la ligne dans une fenêtre cmd ouverte par la personne elle-même. |
| `'rrorlevel' n'est pas reconnu` | Elle utilise une vieille consigne qui télécharge `install.cmd` directement. Redonne-lui **la ligne du point 1**. |
| `Windows a protégé votre PC` | Normal sans signature payante : *Informations complémentaires* → *Exécuter quand même*. |
| `xozhub n'est pas reconnu` après l'installation | La fenêtre cmd était ouverte **avant** l'installation : il faut la fermer et en rouvrir une. |
| L'antivirus grogne | Un script qui télécharge et exécute du code, c'est ce que fait un virus aussi. Pour les plus méfiants, la version `.exe` (point 7) passe mieux : elle ne télécharge rien. |
| Rien ne se passe, aucune erreur | Une variable `XOZHUB_SRC` qui traîne sur la machine prend le pas sur le fichier : `set XOZHUB_SRC=` la supprime. |

---

## 7. Autres façons de partager (sans ligne à coller)

> Dans **toutes** ces méthodes, c'est le `.env` posé à côté des fichiers qui porte la clé :
> vérifie donc d'abord le point 3 (le fichier `.env` doit être dans le dépôt).

| Méthode | Comment | Pour qui |
| --- | --- | --- |
| **Fichier unique** | double-clic sur `fabriquer.cmd` → tu obtiens `XozHub-GPT-Installer.cmd` → envoie-le, la personne **double-clique** | le plus simple, aucun hébergement, aucun terminal |
| **`.exe`** | double-clic sur `fabriquer-exe.cmd` → `XozHub-GPT-Setup.exe` | le plus rassurant, ne télécharge rien (mais ⚠️ contient ta clé : ne le mets pas en téléchargement public) |
| **Le dossier** | clic droit sur le dossier → Compresser → envoie le `.zip` | quand la personne est à côté de toi |
| **Le site** | active **Settings → Pages → Source : `main` / `/docs`** → ta page est en ligne sur `https://qays67.github.io/XozHubCmdIA/` | pour donner un lien d'installation propre, avec le tutoriel |

---

## 8. La liste de mise en ligne, dans l'ordre

À faire une fois, puis c'est fini :

- [ ] le dépôt est **public** et sa branche s'appelle **`main`** ;
- [ ] `install-en-ligne.ps1` est **à la racine** du dépôt et vient d'être régénéré
      (`node fabriquer-en-ligne.mjs`) : c'est lui qui porte tout le code ;
- [ ] l'adresse de contrôle **affiche du code** (voir point 2) — pas « 404 » ;
- [ ] la clé X.GPT que tu veux diffuser est bien dans le `.env` de ton dossier **avant** de lancer
      `fabriquer-en-ligne.mjs` (voir point 3) ;
- [ ] tu as testé **la ligne toi-même** dans une nouvelle fenêtre cmd, après avoir supprimé
      `%LOCALAPPDATA%\XozHub` (voir point 4) ;
- [ ] *(facultatif)* **Settings → Pages → Source : `main` / `/docs`** : le site d'installation est en
      ligne sur `https://qays67.github.io/XozHubCmdIA/` et tu peux donner ce lien-là, c'est le plus
      propre ;
- [ ] *(facultatif)* un `.exe` pour ceux qui préfèrent les boutons : double-clic sur
      `fabriquer-exe.cmd`, puis joins `XozHub-GPT-Setup.exe` à une **Release** (le bouton du site le
      récupère tout seul). ⚠️ cet `.exe` **contient ta clé** : ne le pose jamais en téléchargement
      libre.

### La ligne à envoyer, prête à copier

```
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Qays67/XozHubCmdIA/main/install-en-ligne.ps1 | iex"
```

C'est tout ce dont les gens ont besoin : ils la collent dans **cmd**, appuient sur Entrée, et
XozHub.GPT s'installe — clé comprise.

---

## 9. Si tu changes quelque chose plus tard

| Tu modifies | À refaire |
| --- | --- |
| le code de l'IA (`bin/`, `src/`) | **double-clic sur `publier.cmd`** : il refabrique `install-en-ligne.ps1`, le remonte sur le dépôt et vérifie que c'est bien la nouvelle version qui est servie |
| la clé API | remplace `.env` dans ton dossier, puis double-clic sur `publier.cmd` |
| les réglages par défaut (`.env`, modèle…) | pareil : `.env` → `publier.cmd` |
| `install-depuis-le-depot.ps1` | rien à remonter : cette méthode lit le dépôt à chaque installation |
| `install.cmd` | attention : il est repris par le `.exe` et par `fabriquer.cmd`, qui gardent une **copie** |
