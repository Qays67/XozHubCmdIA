// XozHub.GPT — contrôle brut du terminal (écran alternatif, mode raw, souris).

export function write(s) {
  process.stdout.write(s);
}

/** Titre de la fenêtre du terminal (OSC 0) — pratique pour voir l'état d'un coup d'œil. */
export function setTitle(text) {
  try {
    write(`\x1b]0;${String(text).replace(/[\x07\x1b]/g, '')}\x07`);
  } catch {
    /* ignore */
  }
}

export function getSize() {
  return {
    cols: Math.max(40, process.stdout.columns || 80),
    rows: Math.max(10, process.stdout.rows || 24),
  };
}

export function enterFullscreen() {
  write('\x1b[?1049h'); // écran alternatif
  write('\x1b[?25l'); // curseur caché
  write('\x1b[?1000h\x1b[?1006h'); // souris (clics + molette)
  write('\x1b[2J\x1b[H');
}

export function leaveFullscreen() {
  setTitle('XozHub.GPT');
  write('\x1b[?1006l\x1b[?1000l');
  write('\x1b[?25h');
  write('\x1b[0m');
  write('\x1b[?1049l');
}

export function setRawMode(enabled) {
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
    try {
      process.stdin.setRawMode(enabled);
    } catch {
      /* ignore */
    }
  }
}
