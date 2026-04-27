export interface IProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  username: string;
  email: string;
}

export interface IProductForm {
  name: string;
  description: string;
  price: string;
}

export const PRODUCT_FIELDS = ['name', 'price', 'description', 'owner'] as const;
