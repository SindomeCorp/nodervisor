const SGR_PATTERN = /\u001b\[([0-9;]*)m/g;

const ANSI_COLOR_MAP = [
  '#000000', // black
  '#aa0000', // red
  '#00aa00', // green
  '#aa5500', // yellow/brown
  '#0000aa', // blue
  '#aa00aa', // magenta
  '#00aaaa', // cyan
  '#aaaaaa' // white
];

const ANSI_BRIGHT_COLOR_MAP = [
  '#555555', // bright black / gray
  '#ff5555', // bright red
  '#55ff55', // bright green
  '#ffff55', // bright yellow
  '#5555ff', // bright blue
  '#ff55ff', // bright magenta
  '#55ffff', // bright cyan
  '#ffffff' // bright white
];

const COLOR_LEVELS = [0, 95, 135, 175, 215, 255];

function createDefaultState() {
  return {
    color: null,
    backgroundColor: null,
    bold: false,
    italic: false,
    underline: false
  };
}

function resetState(state) {
  state.color = null;
  state.backgroundColor = null;
  state.bold = false;
  state.italic = false;
  state.underline = false;
}

function applySgrCodes(state, codes) {
  for (let i = 0; i < codes.length; i += 1) {
    const code = codes[i];

    if (!Number.isFinite(code)) {
      continue;
    }

    if (code === 0) {
      resetState(state);
      continue;
    }

    if (code === 1) {
      state.bold = true;
      continue;
    }

    if (code === 22) {
      state.bold = false;
      continue;
    }

    if (code === 3) {
      state.italic = true;
      continue;
    }

    if (code === 23) {
      state.italic = false;
      continue;
    }

    if (code === 4) {
      state.underline = true;
      continue;
    }

    if (code === 24) {
      state.underline = false;
      continue;
    }

    if (code === 39) {
      state.color = null;
      continue;
    }

    if (code === 49) {
      state.backgroundColor = null;
      continue;
    }

    if (code >= 30 && code <= 37) {
      state.color = ANSI_COLOR_MAP[code - 30] ?? state.color;
      continue;
    }

    if (code >= 90 && code <= 97) {
      state.color = ANSI_BRIGHT_COLOR_MAP[code - 90] ?? state.color;
      continue;
    }

    if (code >= 40 && code <= 47) {
      state.backgroundColor = ANSI_COLOR_MAP[code - 40] ?? state.backgroundColor;
      continue;
    }

    if (code >= 100 && code <= 107) {
      state.backgroundColor =
        ANSI_BRIGHT_COLOR_MAP[code - 100] ?? state.backgroundColor;
      continue;
    }

    if (code === 38 || code === 48) {
      const isForeground = code === 38;
      const mode = codes[i + 1];

      if (mode === 5 && Number.isFinite(codes[i + 2])) {
        const colorIndex = codes[i + 2];
        const hex = ansi256ToHex(colorIndex);
        if (hex) {
          if (isForeground) {
            state.color = hex;
          } else {
            state.backgroundColor = hex;
          }
        }
        i += 2;
        continue;
      }

      if (
        mode === 2 &&
        Number.isFinite(codes[i + 2]) &&
        Number.isFinite(codes[i + 3]) &&
        Number.isFinite(codes[i + 4])
      ) {
        const r = clampRgb(codes[i + 2]);
        const g = clampRgb(codes[i + 3]);
        const b = clampRgb(codes[i + 4]);
        const hex = rgbToHex(r, g, b);
        if (isForeground) {
          state.color = hex;
        } else {
          state.backgroundColor = hex;
        }
        i += 4;
        continue;
      }

      continue;
    }

    if (code === 7) {
      const foreground = state.color;
      const background = state.backgroundColor;
      state.color = background ?? '#000000';
      state.backgroundColor = foreground ?? '#ffffff';
      continue;
    }
  }
}

function clampRgb(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(255, Math.max(0, Math.round(value)));
}

function ansi256ToHex(index) {
  if (!Number.isFinite(index)) {
    return null;
  }

  const value = Math.max(0, Math.min(255, Math.round(index)));

  if (value < 8) {
    return ANSI_COLOR_MAP[value] ?? null;
  }

  if (value < 16) {
    return ANSI_BRIGHT_COLOR_MAP[value - 8] ?? null;
  }

  if (value >= 16 && value <= 231) {
    const base = value - 16;
    const r = COLOR_LEVELS[Math.floor(base / 36) % 6];
    const g = COLOR_LEVELS[Math.floor(base / 6) % 6];
    const b = COLOR_LEVELS[base % 6];
    return rgbToHex(r, g, b);
  }

  if (value >= 232 && value <= 255) {
    const gray = 8 + 10 * (value - 232);
    return rgbToHex(gray, gray, gray);
  }

  return null;
}

function rgbToHex(r, g, b) {
  const red = clampRgb(r);
  const green = clampRgb(g);
  const blue = clampRgb(b);

  return `#${componentToHex(red)}${componentToHex(green)}${componentToHex(blue)}`;
}

function componentToHex(value) {
  const hex = value.toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return match;
    }
  });
}

function styleFromState(state) {
  const styles = [];
  if (state.color) {
    styles.push(`color:${state.color}`);
  }
  if (state.backgroundColor) {
    styles.push(`background-color:${state.backgroundColor}`);
  }
  if (state.bold) {
    styles.push('font-weight:bold');
  }
  if (state.italic) {
    styles.push('font-style:italic');
  }
  if (state.underline) {
    styles.push('text-decoration:underline');
  }
  return styles.join(';');
}

function wrapText(text, styleString) {
  if (!text) {
    return '';
  }

  const escaped = escapeHtml(text);

  if (!styleString) {
    return escaped;
  }

  return `<span style="${styleString}">${escaped}</span>`;
}

export function ansiToHtml(input) {
  if (input == null || input === '') {
    return '';
  }

  const state = createDefaultState();
  let result = '';
  let lastIndex = 0;

  const normalized = String(input);

  normalized.replace(SGR_PATTERN, (match, codesString, offset) => {
    if (offset > lastIndex) {
      const textChunk = normalized.slice(lastIndex, offset);
      if (textChunk) {
        result += wrapText(textChunk, styleFromState(state));
      }
    }

    const codes = codesString
      .split(';')
      .filter((item) => item.length > 0)
      .map((item) => Number(item));

    if (codes.length === 0) {
      codes.push(0);
    }

    applySgrCodes(state, codes);
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < normalized.length) {
    const textChunk = normalized.slice(lastIndex);
    result += wrapText(textChunk, styleFromState(state));
  }

  return result;
}

export function stripAnsi(input) {
  if (input == null) {
    return '';
  }
  return String(input).replace(/\u001b\[[0-9;?]*[ -\/]*[0-~]/g, '');
}
