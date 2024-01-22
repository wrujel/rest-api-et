import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IProductForm } from '../models/product';
import { environment } from '../../environments/environment';

const URL_PATH = environment.url;

@Injectable({
  providedIn: 'root',
})
export class CommonService {
  constructor(private http: HttpClient) {}

  createProduct(product: IProductForm) {
    return this.http.post(`${URL_PATH}/api/products`, product);
  }

  getProducts() {
    return this.http.get(`${URL_PATH}/api/products`);
  }

  updateProduct(product: IProductForm, id: string) {
    let params = new HttpParams();
    params = params.append('id', id);
    return this.http.put(`${URL_PATH}/api/products`, product, {
      params,
    });
  }

  deleteProduct(id: string) {
    let params = new HttpParams();
    params = params.append('id', id);
    return this.http.delete(`${URL_PATH}/api/products`, { params });
  }
}
