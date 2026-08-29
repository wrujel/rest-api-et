import { escapeHtml, highlightJson, highlightShell } from './highlight';

describe('escapeHtml', () => {
  it('escapes the three characters that could open a tag', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe(
      '&lt;a href="x"&gt;&amp;&lt;/a&gt;',
    );
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeHtml('plain text')).toBe('plain text');
  });
});

describe('highlightJson', () => {
  it('marks object keys apart from string values', () => {
    const html = highlightJson('{"name":"Widget"}');
    expect(html).toContain('<span class="tok-key">"name"</span>:');
    expect(html).toContain('<span class="tok-str">"Widget"</span>');
  });

  it('marks booleans and null', () => {
    const html = highlightJson('[true, false, null]');
    expect(html).toContain('<span class="tok-bool">true</span>');
    expect(html).toContain('<span class="tok-bool">false</span>');
    expect(html).toContain('<span class="tok-bool">null</span>');
  });

  it('marks integers, decimals and exponents', () => {
    const html = highlightJson('[1, -2.5, 1e10]');
    expect(html).toContain('<span class="tok-num">1</span>');
    expect(html).toContain('<span class="tok-num">-2.5</span>');
    expect(html).toContain('<span class="tok-num">1e10</span>');
  });

  it('escapes before highlighting so markup cannot be injected', () => {
    expect(highlightJson('{"x":"<script>"}')).not.toContain('<script>');
  });

  it('handles escaped quotes inside a string', () => {
    expect(highlightJson('{"x":"a\\"b"}')).toContain('tok-str');
  });
});

describe('highlightShell', () => {
  it('marks the leading curl command', () => {
    expect(highlightShell('curl https://api.example.com')).toContain(
      '<span class="tok-cmd">curl</span>',
    );
  });

  it('marks urls, flags and quoted strings', () => {
    const html = highlightShell(
      `curl -X POST https://api.example.com -d '{"a":1}'`,
    );
    expect(html).toContain('tok-url');
    expect(html).toContain('<span class="tok-flag">-X</span>');
    expect(html).toContain('tok-str');
  });

  it('marks double-quoted strings too', () => {
    expect(highlightShell('curl -H "Accept: */*"')).toContain('tok-str');
  });

  it('leaves a non-curl line without a command token', () => {
    expect(highlightShell('echo hi')).not.toContain('tok-cmd');
  });
});
