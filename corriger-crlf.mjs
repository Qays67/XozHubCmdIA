// XozHub.GPT — corrige les fichiers .cmd / .bat.
//
// Pourquoi : cmd.exe a besoin de fins de ligne CRLF. Si les .cmd sont en LF
// (« style Unix »), cmd se trompe de position des qu'il croise un goto ou un
// bloc if ( ... ) et execute des morceaux de lignes, ce qui donne une cascade
// d'erreurs du genre :
//   'rrorlevel' n'est pas reconnu en tant que commande interne...
//   'Premiere' n'est pas reconnu...
//   'll' / 'it' / 'em' / 'use' ... n'est pas reconnu...
//
// Ce script reecrit les .cmd/.bat du dossier en CRLF. Il convertit aussi les
// caracteres accentues en ASCII, pour que l'affichage reste lisible dans une
// console Windows (page de codes OEM) au lieu de sortir en mojibake.
//
// Utilisation :  node corriger-crlf.mjs
//
// Aucune dependance, ne touche a aucun autre fichier.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// Accents / ponctuation typographique -> ASCII.
const MAP = {
  à: 'a', â: 'a', ä: 'a', á: 'a', ã: 'a', å: 'a',
  ç: 'c',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ñ: 'n',
  ò: 'o', ó: 'o', ô: 'o', ö: 'o', õ: 'o',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ý: 'y', ÿ: 'y',
  œ: 'oe', æ: 'ae',
  À: 'A', Â: 'A', Ä: 'A', Á: 'A', Ã: 'A', Å: 'A',
  Ç: 'C',
  È: 'E', É: 'E', Ê: 'E', Ë: 'E',
  Ì: 'I', Í: 'I', Î: 'I', Ï: 'I',
  Ñ: 'N',
  Ò: 'O', Ó: 'O', Ô: 'O', Ö: 'O', Õ: 'O',
  Ù: 'U', Ú: 'U', Û: 'U', Ü: 'U',
  Ý: 'Y',
  Œ: 'OE', Æ: 'AE',
  '«': '"', '»': '"', '“': '"', '”': '"',
  '‘': "'", '’': "'",
  '–': '-', '—': '-', '…': '...', '€': 'EUR', '°': 'deg',
};

function toAscii(text) {
  return text.replace(/[^\x00-\x7F]/g, (ch) => MAP[ch] ?? '?');
}

function toCrlf(text) {
  return text.replace(/\r\n|\r|\n/g, '\n').split('\n').join('\r\n');
}

const files = fs.readdirSync(root).filter((f) => /\.(cmd|bat)$/i.test(f));

console.log('');
console.log('  XozHub.GPT — correction des fichiers de commandes (LF -> CRLF)');
console.log('  Dossier : ' + root);
console.log('');

let changed = 0;
for (const name of files) {
  const file = path.join(root, name);
  let before;
  try {
    before = fs.readFileSync(file);
  } catch (err) {
    console.log('  IGNORE  ' + name + ' (' + err.message + ')');
    continue;
  }
  // BOM eventuel retire, accents convertis, fins de ligne normalisees.
  const text = toAscii(before.toString('utf8').replace(/^\uFEFF/, ''));
  const after = Buffer.from(toCrlf(text), 'utf8');
  if (before.equals(after)) {
    console.log('  OK      ' + name + ' (deja en CRLF)');
    continue;
  }
  try {
    fs.writeFileSync(file, after);
    console.log('  CORRIGE ' + name);
    changed += 1;
  } catch (err) {
    console.log('  ECHEC   ' + name + ' (' + err.message + ')');
  }
}

console.log('');
if (changed === 0) {
  console.log('  Rien a corriger : les fichiers sont deja bons.');
} else {
  console.log('  ' + changed + ' fichier(s) corrige(s).');
  console.log('');
  console.log('  Tu peux relancer l’IA : tape  xozhub  dans une nouvelle fenetre cmd.');
}
console.log('');
