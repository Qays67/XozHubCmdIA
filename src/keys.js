// XozHub.GPT — découpage des touches envoyées par le terminal.

const MOUSE = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])/;
const CSI = /^\x1b\[([0-9;?]*)([A-Za-z~])/;
const INCOMPLETE = /^\x1b(\[[0-9;?<]*)?$/;

const CSI_NAMES = {
  A: 'up',
  B: 'down',
  C: 'right',
  D: 'left',
  H: 'home',
  F: 'end',
};

const TILDE_NAMES = {
  1: 'home',
  2: 'insert',
  3: 'delete',
  4: 'end',
  5: 'pageup',
  6: 'pagedown',
  7: 'home',
  8: 'end',
};

const CTRL_NAMES = {
  3: 'ctrl-c',
  4: 'ctrl-d',
  12: 'ctrl-l',
  17: 'ctrl-q',
  21: 'ctrl-u',
  23: 'ctrl-w',
};

function parseOne(s) {
  const first = s[0];

  if (first === '\x1b') {
    const mouse = MOUSE.exec(s);
    if (mouse) {
      return {
        length: mouse[0].length,
        key: {
          name: 'mouse',
          button: Number(mouse[1]),
          x: Number(mouse[2]),
          y: Number(mouse[3]),
          release: mouse[4] === 'm',
        },
      };
    }
    const csi = CSI.exec(s);
    if (csi) {
      const [, params, final] = csi;
      if (CSI_NAMES[final]) return { length: csi[0].length, key: { name: CSI_NAMES[final] } };
      if (final === '~') {
        const code = Number(params.split(';')[0]);
        return { length: csi[0].length, key: { name: TILDE_NAMES[code] || 'unknown' } };
      }
      return { length: csi[0].length, key: { name: 'unknown' } };
    }
    if (INCOMPLETE.test(s)) return null; // séquence peut-être incomplète
    return { length: 1, key: { name: 'escape' } };
  }

  if (first === '\r' || first === '\n') return { length: 1, key: { name: 'enter' } };
  if (first === '\x7f' || first === '\b') return { length: 1, key: { name: 'backspace' } };
  if (first === '\t') return { length: 1, key: { name: 'tab' } };

  const code = s.charCodeAt(0);
  if (code < 32) {
    return { length: 1, key: { name: CTRL_NAMES[code] || `ctrl-${String.fromCharCode(code + 96)}` } };
  }

  const size = code >= 0xd800 && code <= 0xdbff ? 2 : 1;
  return { length: size, key: { name: 'char', char: s.slice(0, size) } };
}

/**
 * Crée un analyseur de touches. `onKey` reçoit { name, char? }.
 * Un Échap isolé est émis après un court délai (sinon il serait confondu
 * avec le début d'une séquence flèche/fonction).
 */
export function createKeyParser(onKey) {
  let buffer = '';
  let timer = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    push(chunk) {
      buffer += chunk;
      clearTimer();
      while (buffer.length > 0) {
        const parsed = parseOne(buffer);
        if (!parsed) break;
        buffer = buffer.slice(parsed.length);
        onKey(parsed.key);
      }
      if (buffer.length > 0) {
        timer = setTimeout(() => {
          timer = null;
          if (buffer.length > 0) {
            buffer = '';
            onKey({ name: 'escape' });
          }
        }, 60);
        if (typeof timer.unref === 'function') timer.unref();
      }
    },
    flush() {
      clearTimer();
      if (buffer.length > 0) {
        buffer = '';
        onKey({ name: 'escape' });
      }
    },
  };
}
