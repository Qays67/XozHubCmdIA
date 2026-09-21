// XozHub.GPT — rendu de l'interface (une « frame » = un tableau de lignes).

import { c, cb, padEnd, ramp, theme, truncate, vlen, withBg } from './theme.js';
import { compactTitle, paintGradient, renderLogo } from './ascii.js';
import { PACKAGE_ROOT } from './config.js';

export const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const END_SESSION = '✕ End session ';
const STOP_LABEL = '■ STOP';
// Hauteur maximale de la boîte de saisie. Elle n'est atteinte que si le contenu le réclame
// (menu de fin de session) : c'est un plafond, pas une taille fixe.
const MAX_BOX_ROWS = 10;

// Noms affichés dans la conversation : « Toi » pour l'utilisateur, « XozHub.GPT » pour l'IA.
const USER_NAME = 'Toi';
const AI_NAME = 'XozHub.GPT';
const CURSOR_CHAR = '▌';
const THINKING_CHAR = '▚';

/** ~\Desktop\Xozhub à la place de C:\Users\...\Desktop\Xozhub */
export function displayPath(p) {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  let out = String(p || '');
  if (home && out.toLowerCase().startsWith(home.toLowerCase())) out = '~' + out.slice(home.length);
  return out;
}

/** Découpe un texte en lignes d'au plus `width` caractères. */
export function wrapText(text, width) {
  const w = Math.max(4, width);
  const out = [];
  for (const rawLine of String(text ?? '').split('\n')) {
    if (rawLine === '') {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of rawLine.split(' ')) {
      if (word.length > w) {
        if (line) {
          out.push(line);
          line = '';
        }
        let rest = word;
        while (rest.length > w) {
          out.push(rest.slice(0, w));
          rest = rest.slice(w);
        }
        line = rest;
        continue;
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= w) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out.length ? out : [''];
}

/** Comme wrapText, mais suit la position du curseur dans le texte d'origine. */
function wrapWithCursor(text, cursor, width) {
  const w = Math.max(4, width);
  const str = String(text ?? '');
  const lines = [];
  let line = '';
  let curLine = 0;
  let curCol = 0;
  for (let i = 0; i < str.length; i += 1) {
    if (i === cursor) {
      curLine = lines.length;
      curCol = line.length;
    }
    const ch = str[i];
    if (ch === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    if (line.length >= w) {
      lines.push(line);
      line = '';
    }
    line += ch;
  }
  if (cursor >= str.length) {
    curLine = lines.length;
    curCol = line.length;
  }
  lines.push(line);
  return { lines, curLine, curCol };
}

/** Remplit `n` caractères avec un filet en dégradé de la palette (violet → cyan). */
function gradientRule(n, stops = theme.ruleGradient) {
  if (n <= 0) return '';
  const seg = Math.max(1, Math.ceil(n / stops.length));
  let out = '';
  let left = n;
  let i = 0;
  while (left > 0) {
    const size = Math.min(seg, left);
    out += c(stops[Math.min(i, stops.length - 1)], '─'.repeat(size));
    left -= size;
    i += 1;
  }
  return out;
}

/**
 * Bandeau-titre éphémère (« MISE À JOUR EN COURS », « MISE À JOUR VALIDÉE ») :
 * deux filets dégradés et le titre centré, en teintes vives.
 */
function bannerLines(banner, cols) {
  const text = String(banner.text || '').toUpperCase();
  if (!text) return [];
  const stops =
    banner.tone === 'ok' ? theme.bannerOk : banner.tone === 'warn' ? theme.bannerWarn : theme.bannerLive;
  const width = Math.min(Math.max(12, cols - 6), vlen(text) + 10);
  const pad = Math.max(0, Math.floor((cols - width) / 2));
  const label = paintGradient(` ${text} `, stops);
  const indent = Math.max(0, pad + Math.floor((width - vlen(text)) / 2));
  return ['', ' '.repeat(pad) + gradientRule(width, stops), ' '.repeat(indent) + label, ' '.repeat(pad) + gradientRule(width, stops)];
}

/** Couleur de rail pour la ligne `i` sur `total` : donne un dégradé vertical aux cadres. */
function railColor(stops, i, total) {
  if (stops.length < 2 || total <= 1) return stops[0];
  const t = Math.min(1, Math.max(0, i / (total - 1)));
  return stops[Math.min(stops.length - 1, Math.round(t * (stops.length - 1)))];
}

/** Chip (badge) dont le fond suit un dégradé, un caractère après l'autre. */
function gradientChip(text, from, to, inkHex, opts = {}) {
  const chars = Array.from(String(text));
  if (!chars.length) return '';
  const tints = ramp(from, to, chars.length);
  return chars.map((ch, i) => cb(inkHex, tints[i], ch, opts)).join('');
}

/**
 * Message de l'utilisateur : rail dégradé cyan → menthe, badge « TOI ».
 *
 *   ▌  TOI
 *   ▌ mon message…
 */
function userBlockLines(text, width) {
  const inner = Math.max(8, width - 2);
  const rail = (i) => c(railColor(theme.userRail, i, 8), '▌ ', { bold: true });
  const out = [
    rail(0) + cb(theme.onWarm, theme.vivid.gold, ` ${USER_NAME.toUpperCase()} `, { bold: true }),
  ];
  const body = wrapText(text, inner);
  body.forEach((line, i) => {
    out.push(c(railColor(theme.userRail, i + 1, body.length + 2), '▌ ') + c(theme.bright, line));
  });
  out.push('');
  return out;
}

/**
 * Habille une ligne de réponse : `code` en badge menthe, **gras** en blanc vif.
 * Appelé après le découpage en lignes, donc chaque ligne est colorée seule.
 */
function inlineStyled(text, base = theme.text) {
  const parts = String(text).split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  let out = '';
  for (const part of parts) {
    if (!part) continue;
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      out += c(theme.codeFg, part.slice(1, -1), { bold: true });
    } else if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      out += c(theme.bright, part.slice(2, -2), { bold: true });
    } else {
      out += c(base, part);
    }
  }
  return out;
}

/**
 * Ligne de réponse prête à afficher : titres, puces, citations, cases à cocher et
 * le mot TERMINÉ prennent des teintes vives ; le reste garde la couleur du panneau.
 */
function styleAssistantLine(line, base = theme.text) {
  const plain = String(line ?? '');
  if (!plain.trim()) return c(base, plain);
  if (/^\s*([-*_]\s*){3,}$/.test(plain)) return gradientRule(vlen(plain));

  const heading = /^\s*(#{1,6})\s+(.*)$/.exec(plain);
  if (heading) {
    const tone = heading[1].length <= 2 ? theme.vivid.pink : theme.vivid.cyan;
    return c(tone, heading[2], { bold: true });
  }

  const quote = /^(\s*)>\s?(.*)$/.exec(plain);
  if (quote) {
    return c(theme.vivid.violet, `${quote[1]}▏ `, { bold: true }) + c(theme.accent, quote[2], { italic: true });
  }

  const todo = /^(\s*[-*]\s*)\[([ xX])\]\s+(.*)$/.exec(plain);
  if (todo) {
    const done = todo[2].toLowerCase() === 'x';
    return (
      c(theme.muted, todo[1]) +
      c(done ? theme.ok : theme.faint, done ? '✓ ' : '☐ ', { bold: true }) +
      inlineStyled(todo[3], base)
    );
  }

  const bullet = /^(\s*)([-*•–]|\d{1,3}[.)])\s+(.*)$/.exec(plain);
  if (bullet) {
    const numbered = /^\d/.test(bullet[2]);
    return (
      c(theme.muted, bullet[1]) +
      c(numbered ? theme.vivid.cyan : theme.vivid.pink, bullet[2], { bold: true }) +
      ' ' +
      inlineStyled(bullet[3], base)
    );
  }

  if (/^\s*TERMIN[ÉE]\s*[.!]?\s*$/i.test(plain)) {
    return c(theme.vivid.mint, plain.trim(), { bold: true });
  }

  return inlineStyled(plain, base);
}

/**
 * Réponse de l'IA : panneau encadré « cyber » avec dégradé et curseur d'écriture.
 *
 *   ╭─ XozHub.GPT ──────────────╮
 *   │ la réponse en cours…      │
 *   ╰───────────────────────────╯
 */
function assistantBlockLines(text, width, { streaming = false, spinner = '' } = {}) {
  const inner = Math.max(8, width - 4);
  const empty = !String(text ?? '').trim();
  const body = empty ? `${spinner || THINKING_CHAR} analyse de ta demande…` : String(text);
  const wrapped = wrapText(body, inner);
  const out = [];

  // État affiché dans le bandeau du panneau : on voit qu'il écrit, sans quitter l'écran.
  const status = streaming && !empty ? ' écrit…' : '';
  const fill = Math.max(0, width - 5 - AI_NAME.length - vlen(status));
  // Le panneau est une carte : fond continu, filets dégradés, rails verticaux.
  out.push(
    withBg(
      theme.panelBg,
      padEnd(
        truncate(
          c(theme.vivid.pink, '╭─ ', { bold: true }) +
            paintGradient(AI_NAME, theme.aiGradient) +
            c(theme.vivid.lime, status, { italic: true }) +
            c(theme.vivid.pink, ' ') +
            gradientRule(fill) +
            c(theme.vivid.lime, '╮', { bold: true }),
          width,
        ),
        width,
      ),
    ),
  );

  // Les blocs ``` sont repérés au fil des lignes : les commandes ressortent en menthe,
  // les délimiteurs en violet vif, le reste du texte reste coloré normalement.
  let fence = false;
  wrapped.forEach((line, i) => {
    const last = i === wrapped.length - 1;
    const isFence = /^\s*```/.test(line);
    const inCode = fence && !isFence;
    if (isFence) fence = !fence;

    let styled;
    if (empty) {
      // « analyse de ta demande… » : la spirale ressort, le reste reste discret.
      const spin = Array.from(line)[0] || '';
      styled =
        (spin ? c(theme.vivid.pink, spin, { bold: true }) : '') +
        c(theme.muted, line.slice(spin.length));
    } else if (isFence) {
      const lang = line.trim().replace(/^`+/, '').trim();
      styled =
        c(theme.vivid.violet, '┈┈', { bold: true }) +
        (lang ? ' ' + c(theme.vivid.cyan, lang, { bold: true }) : '');
    } else if (inCode) {
      styled = c(theme.codeFg, line);
    } else {
      styled = styleAssistantLine(line);
    }

    const content =
      !empty && streaming && last
        ? padEnd(styled, Math.max(0, inner - 1)) + c(theme.vivid.cyan, CURSOR_CHAR, { bold: true })
        : padEnd(styled, inner);
    // Rail vertical dégradé : le panneau respire au lieu d'être une boîte grise.
    const rail = railColor(theme.agentRail, i + 1, wrapped.length + 2);
    // Le code est posé sur une bande un peu plus claire que le reste du panneau : il se lit
    // comme un bloc, pas comme une ligne perdue au milieu de la prose.
    const rowBg = inCode ? theme.codeBg : theme.panelBg;
    out.push(withBg(rowBg, c(rail, '│ ') + content + c(rail, ' │')));
  });

  // Bas du cadre en dégradé : le panneau se referme en fondu.
  out.push(
    withBg(
      theme.panelBg,
      c(theme.vivid.lime, '╰', { bold: true }) +
        gradientRule(Math.max(0, width - 2), theme.agentRail) +
        c(theme.vivid.lime, '╯', { bold: true }),
    ),
  );
  out.push('');
  return out;
}

/** Pastille d'une ligne de service : la couleur annonce le contenu. */
function noticeMark(text) {
  const t = String(text ?? '').trim();
  if (/^[✓✔]/.test(t)) return { mark: '✓', tone: theme.vivid.mint };
  if (/^[!⚠🚫]/u.test(t)) return { mark: '!', tone: theme.vivid.gold };
  if (/^🧠/.test(t)) return { mark: '✦', tone: theme.vivid.pink };
  if (/^👁/.test(t)) return { mark: '◉', tone: theme.vivid.cyan };
  if (/^🌐/.test(t)) return { mark: '◈', tone: theme.vivid.sky };
  if (/^🖼/.test(t)) return { mark: '▣', tone: theme.vivid.violet };
  if (/^[⏳⌛✦↻↩↺]/u.test(t)) return { mark: '✦', tone: theme.vivid.orange };
  if (/^(IA|Modèle)/i.test(t)) return { mark: '◆', tone: theme.vivid.cyan };
  return { mark: '·', tone: theme.vivid.teal };
}

function entryLines(entry, width, opts = {}) {
  const text = String(entry.text ?? '');
  const streaming = entry.kind === 'assistant' && opts.streaming ? 1 : 0;
  // Seule la ligne « analyse de ta demande… » est animée : elle seule se redessine à chaque tick.
  const key =
    entry.kind === 'assistant' && !text.trim()
      ? `${width}|sp|${streaming}|${opts.spinner || ''}`
      : `${width}|${streaming}`;
  if (entry._cache && entry._cache.key === key) return entry._cache.lines;
  const lines = [];
  const body = Math.max(8, width - 2);
  const push = (l) => lines.push(truncate(l, width));

  switch (entry.kind) {
    case 'user': {
      userBlockLines(text, width).forEach(push);
      break;
    }
    case 'assistant': {
      assistantBlockLines(text, width, opts).forEach(push);
      break;
    }
    case 'cmd': {
      // La commande exécutée : badge menthe sur fond sombre, texte vif, détachés de la prose.
      wrapText(text, Math.max(8, body - 6)).forEach((l, i) =>
        push(
          (i === 0 ? cb(theme.onMint, theme.cmd, ' $ ', { bold: true }) : c(theme.faint, '   ')) +
            c(theme.bright, l, { bold: true }),
        ),
      );
      break;
    }
    case 'output': {
      // Aucune ligne masquée : toute la sortie de la commande est affichée,
      // le long d'un rail discret pour la détacher de la conversation.
      let row = 0;
      for (const l of text.split('\n')) {
        for (const w of wrapText(l, body)) {
          push(c(railColor([theme.railDim, theme.railDim, theme.borderSoft], row, 12), '│ ') + c(theme.muted, w));
          row += 1;
        }
      }
      break;
    }
    case 'file': {
      // Fichier écrit par l'application : une ligne par fichier, jamais le contenu.
      wrapText(text, Math.max(8, body - 6)).forEach((l, i) => {
        push(
          (i === 0 ? cb(theme.onMint, theme.vivid.mint, ' ✓ ', { bold: true }) : c(theme.faint, '   ')) +
            c(i === 0 ? theme.text : theme.muted, l),
        );
      });
      break;
    }
    case 'error': {
      wrapText(text, Math.max(8, body - 6)).forEach((l, i) => {
        push(
          (i === 0 ? cb(theme.onCoral, theme.vivid.coral, ' ! ', { bold: true }) : c(theme.faint, '   ')) +
            c(theme.err, l),
        );
      });
      lines.push('');
      break;
    }
    default: {
      const { mark, tone } = noticeMark(text);
      wrapText(text, Math.max(8, body - 3)).forEach((l, i) => {
        push(
          (i === 0 ? c(tone, `${mark} `, { bold: true }) : c(theme.faint, '  ')) + c(theme.muted, l),
        );
      });
      break;
    }
  }

  entry._cache = { key, lines };
  return lines;
}

function renderLog(state, cols, height) {
  const width = Math.max(10, cols - 4);
  const spinner = SPINNER[state.spinnerIndex % SPINNER.length];
  const live = state.status === 'thinking' || state.status === 'streaming';
  const last = state.entries.length - 1;
  const all = [];
  state.entries.forEach((entry, i) => {
    all.push(...entryLines(entry, width, { streaming: live && i === last, spinner }));
  });

  const maxScroll = Math.max(0, all.length - height);
  const scroll = Math.min(state.scroll, maxScroll);
  const start = Math.max(0, all.length - height - scroll);
  const slice = all.slice(start, start + height);
  while (slice.length < height) slice.push('');
  return slice.map((l) => `  ${padEnd(l, width)}`);
}

/** Ligne d'aide sous la saisie : raccourcis essentiels et mode courant. */
function inputHint(state, inner) {
  const mode = state.auto
    ? cb(theme.onMint, theme.vivid.mint, ' auto ', { bold: true })
    : cb(theme.onWarm, theme.vivid.gold, ' manuel ', { bold: true });
  const sep = c(theme.faint, '  ·  ');
  const hint =
    c(theme.faint, '  ') +
    c(theme.vivid.lime, '↵', { bold: true }) +
    c(theme.hint, ' envoyer') +
    sep +
    c(theme.vivid.cyan, '/miseajour') +
    c(theme.hint, ' mise à jour') +
    sep +
    c(theme.hint, 'mode ') +
    mode +
    sep +
    c(theme.vivid.rose, '✕', { bold: true }) +
    c(theme.hint, ' End session');
  return truncate(hint, inner);
}

function buildBox(state, cols, spinner) {
  const inner = Math.max(10, cols - 4);
  const lines = [];
  let cursorRow = 0;
  let cursorCol = 3;
  let hasCursor = false;
  let stop = null;
  let menu = null;
  let menuClose = null;

  const busy =
    state.status === 'thinking' || state.status === 'streaming' || state.status === 'running';
  const queued = (state.queue || []).length;
  const queuedNote = queued
    ? c(theme.warn, `   ⏳ ${queued} en attente`)
    : '';

  if (state.menu) {
    // « Page » de fin de session : les choix, et une croix pour en sortir.
    // Toute la ligne du haut est cliquable : la croix n'a pas besoin d'être visée au pixel près.
    const close = '✕';
    const closeCol = Math.max(0, inner - vlen(close));
    lines.push(' '.repeat(closeCol) + c(theme.err, close, { bold: true }));
    menuClose = { row: 0 };

    // Titre du panneau, puis les choix numérotés (la ligne choisie devient un bandeau vif).
    lines.push(truncate(paintGradient('  Fin de session — que veux-tu faire ?', theme.bannerLive), inner));
    state.menu.items.forEach((item, i) => {
      const selected = i === state.menu.index;
      const text = truncate(`${selected ? ' ▸' : '  '} ${i + 1}. ${item.label}`, inner);
      // La ligne choisie se voit au curseur « ▸ » et au blanc, sans fond de couleur.
      lines.push(
        selected
          ? c(theme.vivid.cyan, text.slice(0, 2), { bold: true }) +
              c(theme.bright, text.slice(2), { bold: true })
          : c(theme.muted, text),
      );
    });
    menu = { firstRow: 2, count: state.menu.items.length };
  } else if (state.confirm) {
    for (const l of wrapText(`Exécuter « ${state.confirm.command} » ?`, inner)) {
      lines.push(c(theme.warn, l, { bold: true }));
    }
    lines.push(
      c(theme.ok, 'o / Entrée = oui', { bold: true }) +
        c(theme.faint, '      ') +
        c(theme.err, 'n / Échap = non', { bold: true }),
    );
  } else {
    // Pendant que l'agent travaille, on garde une ligne d'état et le bouton d'arrêt
    // cliquable « ■ STOP » — et la zone de saisie reste visible, on peut toujours taper.
    if (busy) {
      // Le nom de l'agent reste en dégradé vif, et la spirale change de teinte à chaque tour.
      const suffix =
        state.status === 'running'
          ? ` : ${state.runningCommand || ''}`
          : state.status === 'thinking'
            ? ' réfléchit…'
            : ' écrit…';
      const plainLabel = `${state.status === 'running' ? 'Exécution' : AI_NAME}${suffix}`;
      const spins = theme.spinnerGradient;
      const brand =
        state.status === 'running'
          ? c(theme.muted, 'Exécution')
          : paintGradient(AI_NAME, theme.aiGradient);
      const left =
        c(spins[state.spinnerIndex % spins.length], spinner, { bold: true }) +
        ' ' +
        brand +
        c(theme.muted, suffix) +
        c(theme.faint, '   Échap = couper') +
        queuedNote;
      const stopText = gradientChip(
        ` ${STOP_LABEL} `,
        theme.stopGradient[0],
        theme.stopGradient[1],
        theme.stopInk,
        { bold: true },
      );
      const stopLen = vlen(stopText);
      const pad = inner - vlen(left) - stopLen;
      let line;
      let col0;
      if (pad >= 1) {
        line = left + ' '.repeat(pad) + stopText;
        col0 = vlen(left) + pad;
      } else {
        // écran étroit : le bouton passe en tête de ligne
        line = stopText + ' ' + c(theme.muted, plainLabel);
        col0 = 0;
      }
      lines.push(truncate(line, inner));
      stop = { row: lines.length - 1, col0, len: stopLen };
    }

    // Invite de saisie « ❯ » : colorée sur la première ligne, alignée sur les suivantes.
    const wrapped = wrapWithCursor(state.input, state.cursor, inner - 2);
    wrapped.lines.forEach((l, i) => {
      lines.push(
        c(i === 0 ? theme.vivid.pink : theme.faint, i === 0 ? '❯ ' : '  ', { bold: i === 0 }) +
          c(theme.bright, l),
      );
    });
    cursorRow = wrapped.curLine;
    // 2 (rail « │ ») + 2 (invite « ❯ ») + colonne dans la ligne : le curseur tombe juste.
    cursorCol = wrapped.curCol + 5;
    hasCursor = true;
    if (!busy) lines.push(inputHint(state, inner));
  }

  if (lines.length > MAX_BOX_ROWS) lines.length = MAX_BOX_ROWS;
  if (cursorRow > lines.length - 1) cursorRow = lines.length - 1;

  return { lines, cursorRow, cursorCol, hasCursor, stop, menu, menuClose };
}

/**
 * Barre du bas : la marque, l'état, et le bouton de fin de session.
 * Le fond suit un dégradé violet nuit → bleu nuit, découpé en segments
 * (un seul code ANSI par segment, la barre reste légère à redessiner).
 */
function modelBar(state, cols) {
  const meta = state.modelMeta ? ` ${state.modelMeta}` : '';
  const brand = ` ${AI_NAME} `;
  const info = ` ${state.modelLabel}${meta} · ${state.quota || 'unlimited'} `;

  const brandLen = vlen(brand);
  const endLen = vlen(END_SESSION);
  // Pastille d'état : verte au repos, cyan quand il travaille, ambre quand il exécute.
  const dotTone =
    state.status === 'idle' ? theme.vivid.mint : state.status === 'running' ? theme.vivid.amber : theme.vivid.cyan;
  const dot = c(dotTone, ' ●', { bold: true });
  const dotLen = vlen(dot);
  const midLen = Math.max(1, cols - brandLen - dotLen - endLen);

  const tints = ramp(theme.barTop, theme.barDeep, 12);
  const chars = Array.from(truncate(info, midLen));
  const segSize = Math.max(1, Math.ceil(midLen / tints.length));
  let mid = '';
  let offset = 0;
  for (let i = 0; i < tints.length && offset < midLen; i += 1) {
    const size = Math.min(segSize, midLen - offset);
    const slice = chars.slice(offset, offset + size).join('');
    mid += cb(theme.barFg, tints[i], padEnd(slice, size));
    offset += size;
  }

  return {
    text:
      paintGradient(brand, theme.brandGradient) +
      dot +
      mid +
      gradientChip(END_SESSION, theme.endGradient[0], theme.endGradient[1], theme.onCool, {
        bold: true,
      }),
  };
}

/**
 * Construit la frame complète.
 * Renvoie { lines, cursor, layout } — `lines` ne dépasse jamais la hauteur du terminal.
 */
export function buildFrame(state, size) {
  const cols = Math.max(40, size.cols || 80);
  const rows = Math.max(10, size.rows || 24);
  const spinner = SPINNER[state.spinnerIndex % SPINNER.length];

  // Le logo reste affiché en permanence : il ne se retire que si la fenêtre est trop petite.
  const showLogo = rows >= 24 && cols >= 70;
  const logo = showLogo ? renderLogo() : [];

  // Le nom du produit reste visible en permanence : gros logo au démarrage, puis
  // bandeau compact « ▚ XOZHUB.GPT » une fois la conversation lancée.
  const tagline =
    c(theme.vivid.violet, '  ·  ', { bold: true }) +
    c(theme.hint, 'ton agent de dev : il travaille, exécute et vérifie', { italic: true });
  const title = truncate(
    '  ' +
      (logo.length
        ? paintGradient('XozHub', theme.logoGradient) +
          c(theme.vivid.cyan, '.GPT', { bold: true })
        : compactTitle()) +
      tagline,
    cols,
  );
  // Le dossier de travail ET le dossier d'où vient le code : ça permet de voir en un
  // coup d'œil si c'est bien cette version-là qui tourne (et pas une vieille copie).
  const dirLine = truncate(
    '  ' +
      c(theme.vivid.cyan, '▸ ', { bold: true }) +
      c(theme.faint, 'Directory ') +
      c(theme.text, displayPath(state.cwd)) +
      c(theme.faint, '   ·   ') +
      c(theme.vivid.violet, '▸ ', { bold: true }) +
      c(theme.faint, 'code ') +
      c(theme.muted, displayPath(PACKAGE_ROOT)),
    cols,
  );

  // Filet dégradé sous l'en-tête : il sépare l'identité de la conversation.
  const rule =
    '  ' +
    c(theme.vivid.violet, '◆', { bold: true }) +
    gradientRule(Math.min(64, Math.max(10, cols - 8)));

  // Bandeau de mise à jour : au-dessus de la conversation, visible tout de suite.
  const banner = state.banner ? bannerLines(state.banner, cols) : [];
  let header = logo.length
    ? ['', ...logo.map((l) => `  ${truncate(l, cols - 2)}`), '', title, dirLine, rule, ...banner]
    : [title, dirLine, rule, ...banner];

  const box = buildBox(state, cols, spinner);
  const boxHeight = box.lines.length + 2;
  const chrome = boxHeight + 2; // + 1 ligne vide + 1 barre de modèle

  let logHeight = rows - header.length - chrome;
  if (logHeight < 1 && logo.length) {
    header = [title, dirLine, ...banner];
    logHeight = rows - header.length - chrome;
  }
  if (logHeight < 1) {
    // Écran très court : on garde au minimum la ligne de marque.
    header = [title, ...banner];
    logHeight = rows - header.length - chrome;
  }
  if (logHeight < 1) logHeight = 1;

  const out = [];
  for (const l of header) out.push(l);
  for (const l of renderLog(state, cols, logHeight)) out.push(l);

  const barRow = out.length + 2; // index de la barre + 1 -> ligne terminal 1-based
  const bar = modelBar(state, cols);
  out.push('');
  out.push(bar.text);

  // Cadre de la zone de saisie : une carte au fond continu, avec des filets dégradés
  // en haut et en bas et des rails qui se fondent verticalement.
  const boxTop = out.length;
  const rails = ramp(theme.vivid.violet, theme.vivid.mint, Math.max(2, box.lines.length + 2));
  const card = (line) => withBg(theme.panelBg, line);
  out.push(
    card(
      c(theme.vivid.cyan, '╭', { bold: true }) +
        gradientRule(cols - 2, theme.frameGradient) +
        c(theme.vivid.lime, '╮', { bold: true }),
    ),
  );
  box.lines.forEach((l, i) => {
    const rail = rails[Math.min(rails.length - 1, i + 1)];
    out.push(card(c(rail, '│ ') + padEnd(l, cols - 4) + c(rail, ' │')));
  });
  out.push(
    card(
      c(theme.vivid.lime, '╰', { bold: true }) +
        gradientRule(cols - 2, theme.frameGradient) +
        c(theme.vivid.cyan, '╯', { bold: true }),
    ),
  );

  if (out.length > rows) out.length = rows;

  let cursor = '\x1b[?25l';
  if (box.hasCursor) {
    const target = Math.min(boxTop + 2 + box.cursorRow, out.length);
    const col = Math.min(Math.max(box.cursorCol, 1), Math.max(1, cols - 1));
    cursor = `\x1b[${target};${col}H\x1b[?25h`;
  }

  const layout = {
    barRow: Math.min(barRow, out.length),
    endSessionX0: cols - vlen(END_SESSION) + 1,
    logHeight,
    // Lignes cliquables du menu de fin de session.
    menu: box.menu
      ? {
          row0: Math.min(boxTop + 2 + box.menu.firstRow, out.length),
          count: box.menu.count,
        }
      : null,
    // La ligne de la croix ✕ : cliquable sur toute sa largeur.
    menuClose: box.menuClose
      ? {
          row: Math.min(boxTop + 2 + box.menuClose.row, out.length),
          x0: 2,
          x1: Math.max(3, cols - 2),
        }
      : null,
    // Zone cliquable du bouton « ■ STOP » pendant que l'agent travaille.
    stop: box.stop
      ? {
          row: Math.min(boxTop + 2 + box.stop.row, out.length),
          x0: 3 + box.stop.col0,
          x1: 3 + box.stop.col0 + (box.stop.len || vlen(STOP_LABEL)) - 1,
        }
      : null,
  };

  return { lines: out, cursor, layout };
}
