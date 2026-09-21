// XozHub.AI — fabrique l'icône de l'application : ia/xozhub-ai.ico
//
//   node ia/fabriquer-icone.mjs
//
// Pourquoi la dessiner ici plutôt que la fournir en fichier : l'icône doit être
// EXACTEMENT aux couleurs de la marque, et pouvoir être refaite en une commande
// le jour où la palette change. Elle sert à trois endroits :
//
//   - le raccourci XOZHUB.AI du Bureau (l'icône qu'on voit tous les jours) ;
//   - la fenêtre de l'IA, dans la barre des tâches (favicon du serveur local) ;
//   - le site, qui la sert sur téléphone comme sur ordinateur.
//
// Un .ico, ce n'est qu'un conteneur : un en-tête, puis plusieurs images. Windows
// y choisit la taille dont il a besoin (16 px dans la barre des tâches, 256 px
// sur le Bureau). On dessine donc une grande image, puis on la réduit
// proprement pour chaque taille — un redimensionnement naïf laisserait des
// bords noirs autour du halo.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOSSIER = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.join(DOSSIER, 'xozhub-ai.ico');
const GRANDE = 256;
const TAILLES = [256, 128, 64, 48, 32, 16];

const hex = (s) => {
  const h = String(s).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const BLANC = [255, 255, 255];
const MAGENTA = hex('#E879F9');
const VIOLET = hex('#7C3AED');
const MAUVE = hex('#A78BFA');
const CYAN = hex('#22D3EE');
const NUIT = hex('#0A0620');

const melange = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function graine(n) {
  return () => {
    n |= 0;
    n = (n + 0x6d2b79f5) | 0;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ le dessin
//
// Une galaxie vue de face : un cœur très lumineux, deux bras en spirale, des
// étoiles posées autour. Chaque pixel accumule de la lumière (couleur + alpha),
// puis on développe — la même méthode que pour l'aperçu du lien.

function dessiner(taille) {
  const pixels = new Float32Array(taille * taille * 4); // r, g, b, alpha — prémultipliés
  const centre = taille / 2;
  const portee = taille / 2;
  const rnd = graine(4242);

  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      const i = (y * taille + x) * 4;
      // Coordonnées dans un cercle de rayon 1, légèrement penché.
      const dx = (x - centre + 0.5) / portee;
      const dy = (y - centre + 0.5) / portee;
      const angle = (-24 * Math.PI) / 180;
      const u = dx * Math.cos(angle) + dy * Math.sin(angle);
      const v = (-dx * Math.sin(angle) + dy * Math.cos(angle)) * 1.9; // disque écrasé
      const r = Math.hypot(u, v);

      let a = 0;
      let couleur = BLANC;

      // Le halo : la lumière diffuse qui déborde du disque.
      const halo = Math.max(0, 1 - r / 1.02);
      if (halo > 0) {
        const t = Math.min(1, r);
        couleur = t < 0.5 ? melange(MAGENTA, MAUVE, t * 2) : melange(MAUVE, CYAN, (t - 0.5) * 2);
        a += halo * halo * 0.85;
      }

      // Les deux bras : un cosinus de l'angle et du logarithme du rayon.
      if (r > 0.05 && r < 1.02) {
        const theta = Math.atan2(v, u);
        const bras = 0.5 + 0.5 * Math.cos(2 * (theta - 2.2 * Math.log(r * 12)));
        const epaisseur = Math.exp(-(((r - 0.62) / 0.34) ** 2));
        const densite = bras * epaisseur * 0.5;
        const t = Math.min(1, r);
        const teinte = t < 0.5 ? melange(MAGENTA, MAUVE, t * 2) : melange(MAUVE, CYAN, (t - 0.5) * 2);
        couleur = melange(couleur, teinte, Math.min(1, densite * 2));
        a += densite;
      }

      // Le cœur : blanc, il écrase tout au centre (c'est ce qui se lit à 16 px).
      const coeur = Math.exp(-((r / 0.30) ** 2));
      if (coeur > 0.002) {
        couleur = melange(couleur, BLANC, Math.min(1, coeur * 1.1));
        a += coeur * 0.85;
      }

      // Le fond : un disque très sombre, pour que l'icône se détache aussi sur
      // un fond clair (une icône transparente disparaît sur du blanc).
      const fond = 1 - Math.max(0, (r - 0.94) / 0.08);
      if (fond > 0) {
        const f = Math.min(1, fond);
        couleur = melange(NUIT, couleur, Math.min(1, a * 1.4));
        a = Math.max(a * 0.6, f * 0.92);
      }

      // Les étoiles : quelques points francs, posés à la fin.
      const px = (x + 0.5) / taille;
      const py = (y + 0.5) / taille;
      for (let s = 0; s < 26; s += 1) {
        const sx = rnd();
        const sy = rnd();
        const tailleEtoile = 0.004 + rnd() * 0.006;
        const d = Math.hypot(px - sx, py - sy);
        if (d < tailleEtoile) {
          const force = (1 - d / tailleEtoile) * 0.9;
          couleur = melange(couleur, BLANC, force);
          a = Math.min(1, a + force * 0.8);
        }
      }

      // Développement : les hautes lumières restent colorées au lieu de saturer.
      const alpha = Math.min(1, a);
      const developpe = (c) => 1 - Math.exp(-(Math.max(0, c) / 255) * 1.25);
      pixels[i] = Math.min(255, developpe(couleur[0]) * 255) * alpha;
      pixels[i + 1] = Math.min(255, developpe(couleur[1]) * 255) * alpha;
      pixels[i + 2] = Math.min(255, developpe(couleur[2]) * 255) * alpha;
      pixels[i + 3] = alpha * 255;
    }
  }
  return pixels;
}

/** Réduction par moyenne de surface, en prémultiplié (pas de bord noir). */
function reduire(source, de, vers) {
  const facteur = de / vers;
  const sortie = new Float32Array(vers * vers * 4);
  for (let y = 0; y < vers; y += 1) {
    for (let x = 0; x < vers; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      const y0 = Math.floor(y * facteur);
      const x0 = Math.floor(x * facteur);
      const y1 = Math.min(de, Math.ceil((y + 1) * facteur));
      const x1 = Math.min(de, Math.ceil((x + 1) * facteur));
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const i = (sy * de + sx) * 4;
          r += source[i];
          g += source[i + 1];
          b += source[i + 2];
          a += source[i + 3];
          n += 1;
        }
      }
      const i = (y * vers + x) * 4;
      sortie[i] = r / n;
      sortie[i + 1] = g / n;
      sortie[i + 2] = b / n;
      sortie[i + 3] = a / n;
    }
  }
  return sortie;
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

function png(pixels, taille) {
  const brut = Buffer.alloc(taille * (taille * 4 + 1));
  for (let y = 0; y < taille; y += 1) {
    const dest = y * (taille * 4 + 1);
    brut[dest] = 0; // filtre : aucun
    for (let x = 0; x < taille; x += 1) {
      const i = (y * taille + x) * 4;
      const alpha = pixels[i + 3] / 255;
      // L'accumulateur est prémultiplié : on redonne au PNG son alpha droit.
      const droit = (c) => (alpha > 0 ? Math.min(255, Math.round(c / alpha)) : 0);
      brut[dest + 1 + x * 4] = droit(pixels[i]);
      brut[dest + 2 + x * 4] = droit(pixels[i + 1]);
      brut[dest + 3 + x * 4] = droit(pixels[i + 2]);
      brut[dest + 4 + x * 4] = Math.round(pixels[i + 3]);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(taille, 0);
  ihdr.writeUInt32BE(taille, 4);
  ihdr[8] = 8; // 8 bits par composante
  ihdr[9] = 6; // RVB + alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau('IHDR', ihdr),
    morceau('IDAT', deflateSync(brut, { level: 9 })),
    morceau('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ le .ico

const grande = dessiner(GRANDE);
const images = TAILLES.map((taille) => ({
  taille,
  // Windows accepte du PNG dans un .ico depuis Vista : plus léger, et net.
  donnees: png(taille === GRANDE ? grande : reduire(grande, GRANDE, taille), taille),
}));

const entete = Buffer.alloc(6 + images.length * 16);
entete.writeUInt16LE(0, 0); // réservé
entete.writeUInt16LE(1, 2); // 1 = icône
entete.writeUInt16LE(images.length, 4);

let position = entete.length;
images.forEach((image, i) => {
  const o = 6 + i * 16;
  entete[o] = image.taille >= 256 ? 0 : image.taille; // 0 veut dire 256
  entete[o + 1] = image.taille >= 256 ? 0 : image.taille;
  entete[o + 2] = 0; // pas de palette
  entete[o + 3] = 0; // réservé
  entete.writeUInt16LE(1, o + 4); // plans
  entete.writeUInt16LE(32, o + 6); // 32 bits
  entete.writeUInt32LE(image.donnees.length, o + 8);
  entete.writeUInt32LE(position, o + 12);
  position += image.donnees.length;
});

const ico = Buffer.concat([entete, ...images.map((i) => i.donnees)]);
writeFileSync(SORTIE, ico);

const ko = Math.round(ico.length / 1024);
console.log(`Icône écrite : ia/xozhub-ai.ico · ${TAILLES.join(', ')} px · ${ko} Ko`);
console.log('Elle se pose sur le raccourci du Bureau, dans la barre des tâches, et sur le site.');
