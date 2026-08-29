import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { CommonService } from './common.service';
import { environment } from '../../environments/environment';

const PRODUCTS = `${environment.url}/api/products`;

describe('CommonService', () => {
  let service: CommonService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CommonService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts a new product', () => {
    const payload = { name: 'Widget', description: 'A widget', price: '9.50' };
    service.createProduct(payload).subscribe();

    const request = http.expectOne(PRODUCTS);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ id: 'p1' });
  });

  it('lists products', () => {
    service.getProducts().subscribe();

    const request = http.expectOne(PRODUCTS);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('sends the id as a query parameter on update', () => {
    const payload = { name: 'Widget', description: '', price: '12' };
    service.updateProduct(payload, 'p1').subscribe();

    const request = http.expectOne(`${PRODUCTS}?id=p1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(payload);
    request.flush({});
  });

  it('sends the id as a query parameter on delete', () => {
    service.deleteProduct('p1').subscribe();

    const request = http.expectOne(`${PRODUCTS}?id=p1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
});
