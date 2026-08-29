import { listStagger } from './app.animations';

describe('listStagger', () => {
  it('is a trigger the table can reference by name', () => {
    expect(listStagger.name).toBe('listStagger');
    expect(listStagger.definitions.length).toBeGreaterThan(0);
  });
});
