// XozHub.GPT — fabrique l'aperçu du lien : docs/og.png (1200 × 630).
//
// Pourquoi un générateur plutôt qu'une image dessinée à la main : cet aperçu est
// la PREMIÈRE chose que voit la personne à qui on envoie le lien du site (WhatsApp,
// Discord, Twitter, SMS…). Il doit donc être exactement aux couleurs du projet, et
// pouvoir être refait en une commande le jour où la palette change.
//
//   node fabriquer-og.mjs
//
// Résultat : docs/og.png — un ciel profond, des étoiles, une galaxie en spirale et
// le X de la marque. Aucune dépendance : zlib, déjà dans Node, suffit à écrire un PNG.
// C'est l'adresse https://qays67.github.io/XozHubCmdIA/og.png qui est déclarée dans
// les balises og:image de docs/index.html.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WIDTH = 1200;
const HEIGHT = 630;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'docs', 'og.png');

// ------------------------------------------------------------------ couleurs

const hex = (s) => {
  const h = String(s).replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

// La palette du projet, celle de src/theme.js : violet de nébuleuse, magenta,
// cyan glacé. Un aperçu qui n'est pas de ces teintes ne sert à rien.
const NUIT = hex('#06040F');
const PROFOND = hex('#140A33');
const VIOLET = hex('#7C3AED');
const MAGENTA = hex('#E879F9');
const MAUVE = hex('#A78BFA');
const CYAN = hex('#22D3EE');
const BLANC = [255, 255, 255];

// ------------------------------------------------------------------ outils

/** Générateur pseudo-aléatoire à graine : deux exécutions donnent la même image. */
function graine(n) {
  return () => {
    n |= 0;
    n = (n + 0x6d2b79f5) | 0;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const melange = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** t lissé entre deux bornes : c'est ce qui donne des bords nets mais doux. */
function lisse(bas, haut, x) {
  const t = Math.min(1, Math.max(0, (x - bas) / (haut - bas)));
  return t * t * (3 - 2 * t);
}

/** Distance d'un point à un segment — sert à dessiner le X. */
function distanceSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const long = dx * dx + dy * dy;
  const t = long === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / long));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

// ------------------------------------------------------------------ l'image

// Un accumulateur de lumière : chaque élément (halo, étoile, spirale) AJOUTE sa
// lumière au lieu de la remplacer. C'est ainsi qu'un ciel se construit.
const ecran = new Float32Array(WIDTH * HEIGHT * 3);
const poser = (i, rgb, a) => {
  if (a <= 0) return;
  ecran[i] += rgb[0] * a;
  ecran[i + 1] += rgb[1] * a;
  ecran[i + 2] += rgb[2] * a;
};

const CX = WIDTH / 2;
const CY = HEIGHT / 2;

// --- 1) le fond : nuit, dégradé du haut vers le bas + trois halos de nébuleuse
for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    const i = (y * WIDTH + x) * 3;
    const teinte = melange(NUIT, PROFOND, lisse(0, HEIGHT, y) * 0.75);
    poser(i, teinte, 1);

    const versMagenta = Math.max(0, 1 - Math.hypot(x - 210, y - 90) / 560);
    poser(i, MAGENTA, versMagenta * versMagenta * 0.16);
    const versCyan = Math.max(0, 1 - Math.hypot(x - 1010, y - 560) / 560);
    poser(i, CYAN, versCyan * versCyan * 0.14);
    const versViolet = Math.max(0, 1 - Math.hypot(x - 600, y - 330) / 430);
    poser(i, VIOLET, versViolet * versViolet * 0.13);
  }
}

// --- 2) les étoiles : 1300 points, chacun avec sa taille et sa couleur
// (la plupart blanches, quelques-unes bleutées ou rosées — un ciel uniforme
// n'existe pas).
const rnd = graine(20260921);
const teintesEtoiles = [BLANC, hex('#D6E7FF'), hex('#FFE3FA'), hex('#C7F5FF')];
for (let s = 0; s < 1300; s += 1) {
  const x = Math.floor(rnd() * WIDTH);
  const y = Math.floor(rnd() * HEIGHT);
  const eclat = 0.25 + rnd() * 0.75;
  const taille = 0.6 + rnd() * 1.9;
  const couleur = teintesEtoiles[Math.floor(rnd() * teintesEtoiles.length)];
  const rayon = Math.ceil(taille * 2.2);
  for (let dy = -rayon; dy <= rayon; dy += 1) {
    const py = y + dy;
    if (py < 0 || py >= HEIGHT) continue;
    for (let dx = -rayon; dx <= rayon; dx += 1) {
      const px = x + dx;
      if (px < 0 || px >= WIDTH) continue;
      const d = Math.hypot(dx, dy);
      const a = Math.max(0, 1 - d / (taille * 2.2)) * eclat * 0.85;
      poser((py * WIDTH + px) * 3, couleur, a);
    }
  }
}

// --- 3) la galaxie : une spirale en deux bras, vue de trois quarts
// On tourne le repère de -24°, puis on module la densité par un cosinus de
// l'angle : c'est ce qui fait apparaître deux bras au lieu d'un disque.
const angle = (-24 * Math.PI) / 180;
const cosA = Math.cos(angle);
const sinA = Math.sin(angle);
const RAYON_BRAS = 330;

for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    const u = (x - CX) * cosA + (y - CY) * sinA;
    const v = -(x - CX) * sinA + (y - CY) * cosA;
    const r = Math.hypot(u, v);
    if (r > RAYON_BRAS) continue;

    const theta = Math.atan2(v, u);
    // Deux bras logarithmiques : la forme d'une vraie galaxie spirale.
    const bras = 0.5 + 0.5 * Math.cos(2 * (theta - 2.1 * Math.log(Math.max(r, 26))));

    // Le disque : épais au centre, effilé vers le bord, et écrasé (vue oblique).
    const disque = Math.exp(-((r / 210) ** 2)) * (0.35 + 0.65 * bras);
    // L'anneau lumineux qui marque le bord du disque.
    const anneau = Math.exp(-(((r - 235) / 46) ** 2)) * (0.4 + 0.6 * bras);
    const densite = disque * 0.5 + anneau * 0.5;

    // La couleur change le long du rayon : magenta au cœur, violet au milieu,
    // cyan glacé sur les bords — exactement le dégradé du logo.
    const t = Math.min(1, r / RAYON_BRAS);
    const couleur = t < 0.5 ? melange(MAGENTA, MAUVE, t * 2) : melange(MAUVE, CYAN, (t - 0.5) * 2);
    poser((y * WIDTH + x) * 3, couleur, densite * 0.5);

    // Le cœur : une lumière blanche qui écrase tout au centre.
    const coeur = Math.exp(-((r / 62) ** 2));
    poser((y * WIDTH + x) * 3, BLANC, coeur * 0.7);
    poser((y * WIDTH + x) * 3, MAGENTA, coeur * 0.45);
  }
}

// --- 4) le X de la marque, posé sur le cœur de la galaxie
// Deux barres croisées, distance au segment pour la forme, un halo plus large
// pour la lumière : au centre d'un cœur lumineux, un X blanc pur disparaîtrait.
const X = CX;
const Y = CY;
const DX = 104;
const DY = 112;
const barres = [
  [X - DX, Y - DY, X + DX, Y + DY],
  [X - DX, Y + DY, X + DX, Y - DY],
];

for (let y = Y - DY - 40; y <= Y + DY + 40; y += 1) {
  if (y < 0 || y >= HEIGHT) continue;
  for (let x = X - DX - 40; x <= X + DX + 40; x += 1) {
    if (x < 0 || x >= WIDTH) continue;
    const d = Math.min(
      distanceSegment(x, y, barres[0][0], barres[0][1], barres[0][2], barres[0][3]),
      distanceSegment(x, y, barres[1][0], barres[1][1], barres[1][2], barres[1][3]),
    );
    // La barre elle-même, avec son anti-aliasing.
    const corps = 1 - lisse(15, 18, d);
    // Le halo : trois fois plus large, très faible.
    const halo = 1 - lisse(18, 52, d);

    // La couleur suit la largeur : blanc à gauche, magenta et cyan à droite.
    const t = Math.min(1, Math.max(0, (x - (X - DX)) / (DX * 2)));
    const couleur = t < 0.42 ? melange(BLANC, MAGENTA, t / 0.42) : melange(MAGENTA, CYAN, (t - 0.42) / 0.58);

    const i = (y * WIDTH + x) * 3;
    poser(i, couleur, halo * 0.22);
    poser(i, couleur, corps * 0.95);
    poser(i, BLANC, corps * 0.35);
  }
}

// --- 5) le développement : on ramène la lumière dans l'affichable
// Sans ça, le cœur de la galaxie et le X saturent en blanc pur : on perd la
// couleur au moment précis où elle compte. `1 - e^-x` garde les hautes lumières
// colorées, comme le fait un appareil photo.
const pixels = Buffer.alloc(WIDTH * HEIGHT * 3);
for (let p = 0; p < ecran.length; p += 1) {
  const v = 1 - Math.exp(-Math.max(0, ecran[p]) / 255);
  pixels[p] = Math.round(Math.min(255, v * 255));
}

// ------------------------------------------------------------------ le PNG

const tableCrc = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = tableCrc[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function morceau(type, donnees) {
  const tete = Buffer.alloc(8);
  tete.writeUInt32BE(donnees.length, 0);
  tete.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tete.subarray(4), donnees])), 0);
  return Buffer.concat([tete, donnees, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // 8 bits par composante
ihdr[9] = 2; // couleur vraie (RVB)
ihdr[10] = 0; // compression deflate
ihdr[11] = 0; // filtre standard
ihdr[12] = 0; // pas d'entrelacement

// Chaque ligne est précédée de son octet de filtre (0 = aucun) : c'est la règle
// du PNG, sinon l'image sort en bouillie diagonale.
const brut = Buffer.alloc(HEIGHT * (WIDTH * 3 + 1));
for (let y = 0; y < HEIGHT; y += 1) {
  const dest = y * (WIDTH * 3 + 1);
  brut[dest] = 0;
  pixels.copy(brut, dest + 1, y * WIDTH * 3, (y + 1) * WIDTH * 3);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  morceau('IHDR', ihdr),
  morceau('IDAT', deflateSync(brut, { level: 9 })),
  morceau('IEND', Buffer.alloc(0)),
]);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, png);

const ko = Math.round(png.length / 1024);
console.log(`Aperçu écrit : docs/og.png · ${WIDTH}×${HEIGHT} · ${ko} Ko`);
console.log('C\'est lui que voient tes amis dans WhatsApp, Discord ou Twitter quand tu envoies le lien.');
