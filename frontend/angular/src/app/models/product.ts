import { FormControl, FormGroup, Validators } from '@angular/forms';

export interface IProduct {
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

export const createProductForm = new FormGroup({
  name: new FormControl('', [Validators.required]),
  description: new FormControl(''),
  price: new FormControl('', [
    Validators.pattern('^[0-9]*$'),
    Validators.required,
  ]),
});

export const updateProductForm = new FormGroup({
  name: new FormControl('', [Validators.required]),
  description: new FormControl(''),
  price: new FormControl('', [
    Validators.pattern('^[0-9]*$'),
    Validators.required,
  ]),
});

export const PRODUCT_FIELDS = [
  'name',
  'description',
  'price',
  'username',
  'email',
];
