/**
 * Tiny syntax highlighters for the docs page. They return HTML strings meant
 * for [innerHTML] inside `.code-block` (Angular's sanitizer keeps the span
 * classes). Input is always escaped first, so markup injection is impossible.
 */

export function escapeHtml(source: string): string {
  return source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function highlightJson(source: string): string {
  return escapeHtml(source).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, str: string | undefined, colon: string | undefined, bool: string | undefined, num: string | undefined) => {
      if (str !== undefined) {
        return colon
          ? `<span class="tok-key">${str}</span>${colon}`
          : `<span class="tok-str">${str}</span>`;
      }
      if (bool !== undefined) return `<span class="tok-bool">${bool}</span>`;
      return `<span class="tok-num">${num}</span>`;
    },
  );
}

export function highlightShell(source: string): string {
  // Order matters: anything that injects span tags (with their attribute
  // quotes) must run after the quote-matching string highlighter.
  return escapeHtml(source)
    .replace(/('[^']*'|"[^"]*")/g, '<span class="tok-str">$1</span>')
    .replace(/(https?:\/\/[^\s'"]+)/g, '<span class="tok-url">$1</span>')
    .replace(/(\s)(--?[a-zA-Z][\w-]*)/g, '$1<span class="tok-flag">$2</span>')
    .replace(/^(curl)/, '<span class="tok-cmd">$1</span>');
}
