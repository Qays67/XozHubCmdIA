// XozHub.GPT — lire une capture d'écran ou une maquette, pour pouvoir la refaire.
//
// Une image ne se raconte pas : il faut la voir, ou au moins en extraire ce qu'elle contient
// d'objectif. Deux choses se font ici, et la première marche même sans modèle qui voit :
//
//   1. on DÉCODE vraiment l'image (PNG : zlib + dé-filtrage des lignes) et on en tire sa palette
//      réelle — le fond, les neutres, la couleur d'accent, avec leur part de surface. C'est
//      déterministe : les teintes données à l'agent sont celles de l'image, pas une impression ;
//   2. on joint l'image elle-même (data:image) pour les modèles qui savent la regarder, afin de
//      reconstruire la mise en page.
//
//   ```image maquette.png
//   ```image captures/accueil.png
//
// Rien n'est modifié : on lit le fichier et on le rend.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// ```image chemin   (tolérant : img, capture, screenshot, photo, maquette, visuel…)
const OPEN =
  /^(`{3,})(?:image|img|capture|capture-ecran|screenshot|screen|photo|visuel|maquette|mockup)[\s:]+(.+?)\s*$/i;

const MAX_BYTES = 4_000_000; // au-delà, le data: devient énorme pour rien
const MAX_SAMPLES = 14_000; // échantillons de pixels pour la palette

function isClose(line, count) {
  const ticks = String(line).trim();
  return ticks.length >= count && /^`+$/.test(ticks);
}

function cleanPath(raw) {
  return String(raw || '')
    .trim()
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/^\.\s*[\\/]\s*/, '')
    .trim();
}

/** Repère les blocs « image » d'une réponse, dans l'ordre. */
export function parseImages(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) ticks = 0;
      continue;
    }
    const open = OPEN.exec(line);
    if (!open) continue;
    ticks = open[1].length;
    const file = cleanPath(open[2].split(/\s+/)[0]);
    if (file) out.push(file);
  }
  return out;
}

/** Le texte sans les blocs « image ». */
export function stripImages(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) ticks = 0;
      continue;
    }
    const open = OPEN.exec(line);
    if (open) {
      ticks = open[1].length;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

/** Le texte avec les blocs « image » remplacés par une marque. */
export function foldImages(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) {
        ticks = 0;
        out.push('… (image jointe) …', line);
      }
      continue;
    }
    const open = OPEN.exec(line);
    if (open) ticks = open[1].length;
    out.push(line);
  }
  return out.join('\n');
}

// --------------------------------------------------------------------- décodage PNG

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * Décode un PNG 8 bits non entrelacé (ce que produisent les captures d'écran et les exports
 * de maquettes) et renvoie { width, height, pixels } en RGBA.
 * Renvoie null pour tout le reste : on ne devine pas, on le dit.
 */
export function decodePng(buffer) {
  if (buffer.length < 8 || PNG_SIG.some((b, i) => buffer[i] !== b)) return null;
  let pos = 8;
  let header = null;
  let plte = null;
  const idat = [];
  while (pos + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        color: data[9],
        interlace: data[12],
      };
    } else if (type === 'PLTE') plte = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + length;
  }
  if (!header || header.depth !== 8 || header.interlace !== 0) return null;
  const channels = CHANNELS[header.color];
  if (!channels || !header.width || !header.height || !idat.length) return null;
  if (header.color === 3 && !plte) return null;

  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }

  const stride = header.width * channels;
  if (raw.length < (stride + 1) * header.height) return null;

  // Dé-filtrage ligne par ligne, comme le veut la spécification PNG.
  const out = Buffer.alloc(stride * header.height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < header.height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const cur = Buffer.from(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride));
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      switch (filter) {
        case 1:
          cur[i] = (cur[i] + a) & 255;
          break;
        case 2:
          cur[i] = (cur[i] + b) & 255;
          break;
        case 3:
          cur[i] = (cur[i] + ((a + b) >> 1)) & 255;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          cur[i] = (cur[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
          break;
        }
        default:
          break;
      }
    }
    cur.copy(out, y * stride);
    prev = cur;
  }

  // Conversion en RGBA, quel que soit le type de couleur du fichier.
  const pixels = new Uint8Array(header.width * header.height * 4);
  const readPixel = (x, y, target) => {
    const i = y * stride + x * channels;
    if (header.color === 3) {
      const idx = out[i] * 3;
      target[0] = plte[idx];
      target[1] = plte[idx + 1];
      target[2] = plte[idx + 2];
      target[3] = 255;
      return;
    }
    if (header.color === 0 || header.color === 4) {
      target[0] = out[i];
      target[1] = out[i];
      target[2] = out[i];
      target[3] = header.color === 4 ? out[i + 1] : 255;
      return;
    }
    target[0] = out[i];
    target[1] = out[i + 1];
    target[2] = out[i + 2];
    target[3] = header.color === 6 ? out[i + 3] : 255;
  };
  const px = [0, 0, 0, 255];
  for (let y = 0; y < header.height; y += 1) {
    for (let x = 0; x < header.width; x += 1) {
      readPixel(x, y, px);
      const o = (y * header.width + x) * 4;
      pixels[o] = px[0];
      pixels[o + 1] = px[1];
      pixels[o + 2] = px[2];
      pixels[o + 3] = px[3];
    }
  }
  return { width: header.width, height: header.height, pixels };
}

// --------------------------------------------------------------------- palette

const hex2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

function hsv([r, g, b]) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  return { sat: max === 0 ? 0 : (max - min) / max, val: max };
}

/**
 * La palette réelle d'une image : on échantillonne les pixels, on regroupe les teintes
 * proches (4 bits par canal), et on rend les plus présentes avec leur part de surface.
 */
export function paletteOf(pixels, width, height) {
  const buckets = new Map();
  const total = width * height;
  const step = Math.max(1, Math.floor(Math.sqrt(total / MAX_SAMPLES)));
  let samples = 0;
  let transparency = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < 128) {
        transparency += 1;
        continue;
      }
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const cur = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      cur.n += 1;
      cur.r += r;
      cur.g += g;
      cur.b += b;
      buckets.set(key, cur);
      samples += 1;
    }
  }
  if (!samples) return null;

  const list = [...buckets.values()]
    .map((c) => {
      const rgb = [c.r / c.n, c.g / c.n, c.b / c.n];
      return { hex: `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`, share: c.n / samples, ...hsv(rgb) };
    })
    .sort((a, b) => b.share - a.share)
    .slice(0, 10);

  const accent = list.filter((c) => c.sat > 0.35 && c.val > 0.3).sort((a, b) => b.sat * b.share - a.sat * a.share)[0] || null;
  const neutrals = list.filter((c) => c.sat <= 0.2);
  const luminance = list.reduce((sum, c) => sum + c.val * c.share, 0);
  return {
    list,
    dominant: list[0],
    accent,
    ink: neutrals.filter((c) => c.val > 0.75).sort((a, b) => b.share - a.share)[0] || null,
    surface: neutrals.filter((c) => c.val <= 0.4).sort((a, b) => b.share - a.share)[0] || null,
    luminance,
    transparency: transparency / Math.max(1, samples + transparency),
  };
}

// --------------------------------------------------------------------- lecture

const MIMES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};

/** La plus grande dimension d'aperçu, pour ne pas joindre des images inutilement lourdes. */
function kindOf(buffer, ext) {
  if (buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8) return { mime: 'image/jpeg', ext: '.jpg' };
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mime: 'image/webp', ext: '.webp' };
  }
  if (buffer.subarray(0, 3).toString('ascii') === 'GIF') return { mime: 'image/gif', ext: '.gif' };
  if (PNG_SIG.some((b, i) => buffer[i] !== b)) return null;
  return { mime: MIMES[ext] || 'image/png', ext: '.png' };
}

/**
 * Lit une image : métadonnées, palette réelle (si le format est décodable), et de quoi la
 * joindre à la conversation pour un modèle qui voit.
 */
export function readImage(rootDir, relPath) {
  const name = cleanPath(relPath);
  const target = path.isAbsolute(name) ? name : path.join(rootDir, name);
  const base = { path: name, ok: false, mime: '', bytes: 0, width: 0, height: 0, palette: null, dataUrl: '', error: '' };

  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    return { ...base, error: 'fichier introuvable' };
  }
  if (stat.isDirectory()) return { ...base, error: 'c’est un dossier, pas une image' };
  if (stat.size > MAX_BYTES) return { ...base, error: `image trop lourde (${Math.round(stat.size / 1024)} Ko)` };

  let buffer;
  try {
    buffer = fs.readFileSync(target);
  } catch (err) {
    return { ...base, error: `lecture impossible : ${err.message}` };
  }
  const kind = kindOf(buffer, path.extname(name).toLowerCase());
  if (!kind) return { ...base, error: 'ce n’est pas une image reconnue (PNG, JPEG, WebP ou GIF)' };

  const result = { ...base, ok: true, mime: kind.mime, bytes: stat.size, dataUrl: `data:${kind.mime};base64,${buffer.toString('base64')}` };
  if (kind.ext === '.png') {
    const decoded = decodePng(buffer);
    if (decoded) {
      result.width = decoded.width;
      result.height = decoded.height;
      result.palette = paletteOf(decoded.pixels, decoded.width, decoded.height);
    } else {
      result.error = '';
      result.note = 'PNG non décodable (16 bits, entrelacé ou palette) — appuie-toi sur l’image jointe';
    }
  } else {
    result.note = 'palette non extraite pour ce format — appuie-toi sur l’image jointe';
  }
  return result;
}

/** Ce qu'on écrit dans le journal : une image lue, en une ligne. */
export function describeImage(r) {
  if (!r.ok) return `Image illisible : ${r.path} — ${r.error}`;
  const size = r.width && r.height ? `${r.width}×${r.height}` : `${Math.round(r.bytes / 1024)} Ko`;
  const colors = r.palette ? ` · ${r.palette.list.length} teintes extraites` : '';
  return `${r.path} · ${size} · ${r.mime.replace('image/', '')}${colors}`;
}

/** Le texte qui accompagne l'image : ce qu'on a mesuré objectivement, dans l'image. */
export function imagesMessage(results) {
  const parts = [];
  for (const r of results) {
    if (!r.ok) {
      parts.push(`[Image illisible : ${r.path} — ${r.error}]`);
      continue;
    }
    const head = r.width && r.height ? `${r.width}×${r.height}` : `${Math.round(r.bytes / 1024)} Ko`;
    const lines = [`[Image fournie par l'utilisateur : ${r.path} — ${head}, ${r.mime}]`];
    if (r.palette) {
      const p = r.palette;
      const ambiance = p.luminance < 0.3 ? 'sombre' : p.luminance > 0.7 ? 'claire' : 'à mi-teinte';
      lines.push(
        `Ambiance mesurée : ${ambiance} (luminosité moyenne ${Math.round(p.luminance * 100)} %).`,
        'Palette extraite des pixels (part de surface réelle) — reprends EXACTEMENT ces teintes :',
        ...p.list.map((c) => {
          let role = 'teinte';
          if (p.dominant && c.hex === p.dominant.hex) role = 'fond dominant';
          else if (p.accent && c.hex === p.accent.hex) role = 'accent (la plus saturée)';
          else if (c.sat <= 0.2 && c.val > 0.75) role = 'neutre clair (texte, cartes)';
          else if (c.sat <= 0.2 && c.val <= 0.4) role = 'neutre sombre (surfaces)';
          return `  ${c.hex}  ${String(Math.round(c.share * 100)).padStart(3)}%  ${role}`;
        }),
      );
      if (p.dominant) lines.push(`Fond à reprendre : ${p.dominant.hex}${p.accent ? ` · accent : ${p.accent.hex}` : ''}`);
    } else if (r.note) {
      lines.push(r.note);
    }
    lines.push('Refais cette interface avec ces couleurs et cette mise en page, en HTML/CSS/JS propre.');
    parts.push(lines.join('\n'));
  }
  return parts.join('\n\n');
}

/**
 * Les messages à ajouter à la conversation : le texte mesuré, plus l'image elle-même quand le
 * modèle sait regarder (sinon l'application retire l'image et prévient — voir app.js).
 */
export function imageMessageParts(results) {
  const parts = [{ type: 'text', text: imagesMessage(results) }];
  for (const r of results) {
    if (r.ok && r.dataUrl) {
      parts.push({ type: 'image_url', image_url: { url: r.dataUrl } });
    }
  }
  return parts;
}
