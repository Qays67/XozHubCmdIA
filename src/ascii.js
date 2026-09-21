// XozHub.GPT — logo ASCII en gros blocs, dégradé galaxie (nébuleuse → cyan → rose stellaire).

import { c, mix, theme } from './theme.js';

/**
 * Colorise une ligne en dégradé horizontal, caractère par caractère.
 * Les segments de même teinte sont regroupés (moins de codes ANSI à écrire),
 * et les espaces restent nus pour garder le fond du terminal.
 */
export function paintGradient(text, stops) {
  const chars = Array.from(text);
  const total = Math.max(1, chars.length - 1);
  const last = stops.length - 1;
  let out = '';
  let buffer = '';
  let color = null;
  const flush = () => {
    if (!buffer) return;
    out += color ? c(color, buffer, { bold: true }) : buffer;
    buffer = '';
  };
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    const next = ch === ' ' ? null : stops[Math.min(last, Math.round((i / total) * last))];
    if (next !== color) {
      flush();
      color = next;
    }
    buffer += ch;
  }
  flush();
  return out;
}

const ROWS = 8;

const GLYPHS = {
  X: [
    '███  ███',
    '███  ███',
    ' ██████ ',
    '  ████  ',
    '  ████  ',
    ' ██████ ',
    '███  ███',
    '███  ███',
  ],
  O: [
    ' ██████ ',
    '███  ███',
    '██    ██',
    '██    ██',
    '██    ██',
    '██    ██',
    '███  ███',
    ' ██████ ',
  ],
  Z: [
    '████████',
    '████████',
    '    ████',
    '   ████ ',
    '  ████  ',
    ' ████   ',
    '████████',
    '████████',
  ],
  H: [
    '███  ███',
    '███  ███',
    '███  ███',
    '████████',
    '████████',
    '███  ███',
    '███  ███',
    '███  ███',
  ],
  U: [
    '███  ███',
    '███  ███',
    '███  ███',
    '███  ███',
    '███  ███',
    '███  ███',
    '████████',
    ' ██████ ',
  ],
  B: [
    '███████ ',
    '███  ███',
    '███  ███',
    '███████ ',
    '███  ███',
    '███  ███',
    '███  ███',
    '███████ ',
  ],
};

/** Renvoie les lignes brutes (sans couleur) du mot en grosses lettres. */
export function logoLines(word = 'XOZHUB', gap = '  ') {
  const out = [];
  for (let r = 0; r < ROWS; r += 1) {
    out.push(
      Array.from(word)
        .map((ch) => (GLYPHS[ch] ? GLYPHS[ch][r] : ' '.repeat(8)))
        .join(gap),
    );
  }
  return out;
}

// Le logo est identique à chaque frame : on le peint une fois et on le garde. La garde est
// indexée sur les TEINTES, pas sur l'identité du tableau : la palette peut changer à chaud
// (/couleurs ocean), et le logo doit se repeindre au rendu suivant.
let logoCache = null;

/** Logo coloré : dégradé horizontal, relief vers le bas, badge « .GPT » vif. */
export function renderLogo({ gradient = theme.logoGradient, tag = '.GPT' } = {}) {
  const isDefault = gradient === theme.logoGradient && tag === '.GPT';
  const cacheKey = `${gradient.join('|')}§${tag}`;
  if (isDefault && logoCache && logoCache.key === cacheKey) return logoCache.lines;

  const lines = logoLines().map((line, row) => {
    // Les lignes du bas sont assombries : le logo prend du relief au lieu d'être plat.
    const depth = row / Math.max(1, ROWS - 1);
    const stops = gradient.map((stop) => mix(stop, '#090818', depth * 0.34));
    return paintGradient(line, stops);
  });
  if (tag) {
    const idx = Math.min(6, lines.length - 1);
    lines[idx] += '  ' + c(theme.vivid.cyan, tag, { bold: true });
  }
  if (isDefault) logoCache = { key: cacheKey, lines };
  return lines;
}

/** Bandeau compact, utilisé quand le terminal est petit. */
export function compactTitle() {
  return (
    paintGradient('▚ XOZHUB', theme.logoGradient) +
    c(theme.vivid.cyan, '.GPT', { bold: true })
  );
}

export const LOGO_WIDTH = logoLines().reduce((max, l) => Math.max(max, l.length), 0);
