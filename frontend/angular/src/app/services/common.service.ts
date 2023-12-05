import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IProductForm } from '../models/product';

@Injectable({
  providedIn: 'root',
})
export class CommonService {
  constructor(private http: HttpClient) {}

  createProduct(product: IProductForm) {
    return this.http.post('http://localhost:8080/api/products', product);
  }

  getProducts() {
    return this.http.get('http://localhost:8080/api/products');
  }

  updateProduct(product: IProductForm, id: string) {
    let params = new HttpParams();
    params = params.append('id', id);
    return this.http.put('http://localhost:8080/api/products', product, {
      params,
    });
  }

  deleteProduct(id: string) {
    let params = new HttpParams();
    params = params.append('id', id);
    return this.http.delete('http://localhost:8080/api/products', { params });
  }
}
