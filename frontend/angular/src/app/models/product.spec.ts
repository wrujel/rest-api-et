import { PRODUCT_FIELDS } from './product';

describe('PRODUCT_FIELDS', () => {
  it('lists the sortable table columns in display order', () => {
    expect(PRODUCT_FIELDS).toEqual(['name', 'price', 'description', 'owner']);
  });
});
