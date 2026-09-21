# dist — ce qu'on envoie aux gens

Tout ce qui se donne à quelqu'un est **ici**, et nulle part ailleurs. Les fichiers sont déjà
fabriqués : il n'y a rien à préparer avant de les envoyer.

| Fichier | Poids | Ce que la personne en fait |
| --- | --- | --- |
| **`XozHub-AI-Setup.exe`** | ~328 Ko | **La nouvelle IA**, celle qui a sa propre fenêtre. Double-clic : elle s'installe, le raccourci **XOZHUB.AI** arrive sur le Bureau, et la fenêtre s'ouvre. C'est celui-là qu'on envoie. |
| `XozHub-GPT-Setup.exe` | ~316 Ko | La version terminal (dans `cmd`). Double-clic : elle s'installe et s'ouvre dans une fenêtre de commandes. |
| `XozHub-GPT-Installer.cmd` | ~195 Ko | La même version terminal, en « fichier texte » : utile quand un antivirus ou un réseau refuse les `.exe`. On le double-clique aussi. |

Les trois contiennent **tout** : le code, l'installateur et la clé. Rien n'est téléchargé pendant
l'installation, donc ni le réseau ni l'antivirus de la personne ne peuvent la faire échouer. La
nouvelle IA installe Node.js au passage s'il manque (`winget`), sinon elle ouvre nodejs.org et
s'arrête en le disant clairement.

## Le lien à envoyer

Le site est en ligne à cette adresse — c'est **ce lien-là** qu'on envoie, jamais un fichier de ton
dossier (un fichier ouvert en double-clic ne marche que sur ta machine) :

    https://qays67.github.io/XozHubCmdIA/

Ton ami clique, la page s'ouvre chez lui — sur son téléphone comme sur son PC — et il installe l'IA
d'un clic, ou avec la ligne à coller dans `cmd`.

## Le bouton « Installer XozHub.AI (.exe) » du site

Le bouton cherche l'installateur **à plusieurs endroits, dans l'ordre**, et prend le premier qui
répond — il ne peut donc pas tomber sur une page 404 :

1. **à côté de la page du site** : `https://qays67.github.io/XozHubCmdIA/XozHub-AI-Setup.exe` ;
2. une **version GitHub** : `https://github.com/Qays67/XozHubCmdIA/releases/latest/download/XozHub-AI-Setup.exe` ;
3. le **dépôt** : à la racine, ou dans `docs/`.

La façon la plus simple de le mettre en ligne, c'est **`publier.cmd`** : il copie tout seul
`dist/XozHub-AI-Setup.exe` dans `docs/`, puis publie le site — GitHub Pages sert alors le fichier à
l'adresse du site, et le bouton marche pour tout le monde, **sans aucune Release à fabriquer**.

Si tu préfères passer par une Release (cinq clics, une seule fois) :

1. va sur `https://github.com/Qays67/XozHubCmdIA/releases/new` ;
2. dans **Choose a tag**, écris `v1.0.0` puis clique sur *Create new tag* ;
3. titre : `XozHub.AI` — description : ce que tu veux ;
4. dans **Attach binaries**, glisse `dist/XozHub-AI-Setup.exe` (et `XozHub-GPT-Setup.exe` si tu
   veux aussi la version terminal) ;
5. clique sur **Publish release**.

Et si rien n'est encore en ligne, le bouton ne montre pas d'erreur : il le dit et propose la ligne à
coller, qui installe la même IA tout de suite.

## Comment ces fichiers ont été fabriqués

Depuis la racine du projet, chacun avec un double-clic :

```cmd
ia\fabriquer-exe.cmd   rem -> dist\XozHub-AI-Setup.exe     (la nouvelle IA, en fenetre)
fabriquer-exe.cmd      rem -> dist\XozHub-GPT-Setup.exe    (la version terminal)
fabriquer.cmd          rem -> dist\XozHub-GPT-Installer.cmd
```

**À refaire après chaque modification du code** : ces fichiers embarquent une copie du code au
moment où ils sont fabriqués — un ancien `.exe` installe l'ancien code.

## ⚠️ La clé est dedans

`.env` est repris dans les trois fichiers, donc la clé X.GPT y est lisible dès qu'on ouvre
l'archive. C'est ce qui fait que la personne n'a **rien** à saisir. À savoir avant de les mettre en
téléchargement public : c'est ce compte-là qui paie les utilisations. Pour un fichier vraiment
public, renomme `.env` avant de fabriquer, et l'installateur demandera la clé à la personne.
