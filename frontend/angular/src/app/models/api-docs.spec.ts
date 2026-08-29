import { PRODUCT_ENDPOINTS } from './api-docs';

describe('PRODUCT_ENDPOINTS', () => {
  it('documents the four product endpoints', () => {
    expect(PRODUCT_ENDPOINTS.map((endpoint) => endpoint.method)).toEqual([
      'GET',
      'POST',
      'PUT',
      'DELETE',
    ]);
  });

  it('gives every endpoint a unique id the deep link can address', () => {
    const ids = PRODUCT_ENDPOINTS.map((endpoint) => endpoint.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('describes every endpoint well enough for the docs page to render it', () => {
    for (const endpoint of PRODUCT_ENDPOINTS) {
      expect(endpoint.path.startsWith('/api/')).toBe(true);
      expect(endpoint.summary).toBeTruthy();
      expect(endpoint.description).toBeTruthy();
      expect(endpoint.curl).toContain('curl');
      expect(endpoint.responses.length).toBeGreaterThan(0);
    }
  });

  it('marks every endpoint as requiring a bearer token', () => {
    expect(PRODUCT_ENDPOINTS.every((endpoint) => endpoint.auth)).toBe(true);
  });

  it('gives each required query parameter an example the tester can send', () => {
    const required = PRODUCT_ENDPOINTS.flatMap((endpoint) =>
      endpoint.params.filter((param) => param.in === 'query' && param.required),
    );
    expect(required.length).toBeGreaterThan(0);
    expect(required.every((param) => !!param.example)).toBe(true);
  });

  it('ships valid JSON in every response and body example', () => {
    for (const endpoint of PRODUCT_ENDPOINTS) {
      if (endpoint.bodyExample) {
        expect(() => JSON.parse(endpoint.bodyExample!)).not.toThrow();
      }
      for (const response of endpoint.responses) {
        if (response.example) {
          expect(() => JSON.parse(response.example!)).not.toThrow();
        }
      }
    }
  });
});
