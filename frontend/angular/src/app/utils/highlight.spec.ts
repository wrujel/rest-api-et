import { escapeHtml, highlightJson, highlightShell } from './highlight';

describe('highlight utils', () => {
  it('escapes HTML entities', () => {
    expect(escapeHtml('<b>&"x"</b>')).toBe('&lt;b&gt;&amp;"x"&lt;/b&gt;');
  });

  it('highlights JSON keys, strings, numbers and booleans', () => {
    const html = highlightJson('{"a": 1, "b": "x", "c": true}');
    expect(html).toContain('<span class="tok-key">"a"</span>:');
    expect(html).toContain('<span class="tok-num">1</span>');
    expect(html).toContain('<span class="tok-str">"x"</span>');
    expect(html).toContain('<span class="tok-bool">true</span>');
  });

  it('highlights curl commands, flags and urls', () => {
    const html = highlightShell('curl -X GET http://localhost:8080/api/products');
    expect(html).toContain('<span class="tok-cmd">curl</span>');
    expect(html).toContain('<span class="tok-flag">-X</span>');
    expect(html).toContain('tok-url');
  });
});
