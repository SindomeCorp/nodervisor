import { ansiToHtml, stripAnsi } from '../client/src/utils/ansiToHtml.js';

describe('ansiToHtml', () => {
  it('returns plain text untouched when no escape codes are present', () => {
    expect(ansiToHtml('hello world')).toBe('hello world');
  });

  it('wraps colored segments with inline styles', () => {
    const result = ansiToHtml('\u001b[31mError\u001b[0m');
    expect(result).toBe('<span style="color:#aa0000">Error</span>');
  });

  it('handles combined bold and bright color codes', () => {
    const result = ansiToHtml('\u001b[1;94mStatus\u001b[0m');
    expect(result).toBe('<span style="color:#5555ff;font-weight:bold">Status</span>');
  });

  it('supports 256-color escape sequences', () => {
    const result = ansiToHtml('\u001b[38;5;196mHot\u001b[0m');
    expect(result).toBe('<span style="color:#ff0000">Hot</span>');
  });

  it('escapes HTML special characters within text segments', () => {
    const result = ansiToHtml('<script>');
    expect(result).toBe('&lt;script&gt;');
  });
});

describe('stripAnsi', () => {
  it('removes ANSI escape sequences from the string', () => {
    expect(stripAnsi('\u001b[31mAlert\u001b[0m')).toBe('Alert');
  });
});
