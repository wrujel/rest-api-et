import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import {
  ProductFormDialogComponent,
  ProductFormDialogData,
} from './product-form-dialog.component';
import { CommonService } from '../../services/common.service';
import { IProduct } from '../../models/product';
import { text } from '../../../testing/dom';

const EXISTING: IProduct = {
  id: 'p1',
  name: 'Widget',
  description: 'A widget',
  price: 9.5,
  username: 'ada',
  email: 'ada@example.com',
};

describe('ProductFormDialogComponent', () => {
  let fixture: ComponentFixture<ProductFormDialogComponent>;
  let component: ProductFormDialogComponent;

  const close = vi.fn();
  const service = {
    createProduct: vi.fn(() => of({ id: 'p9' })),
    updateProduct: vi.fn(() => of({})),
  };

  const build = (data: ProductFormDialogData) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProductFormDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: CommonService, useValue: service },
      ],
    });
    fixture = TestBed.createComponent(ProductFormDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const failWith = (status: number) =>
    throwError(() => new HttpErrorResponse({ status, statusText: 'Err' }));

  beforeEach(() => {
    vi.clearAllMocks();
    service.createProduct.mockReturnValue(of({ id: 'p9' }));
    service.updateProduct.mockReturnValue(of({}));
  });

  describe('in create mode', () => {
    beforeEach(() => build({ mode: 'create' }));

    it('opens empty with create-flavoured copy', () => {
      expect(component.isEdit).toBe(false);
      expect(component.title).toBe('New product');
      expect(component.submitLabel()).toBe('Create product');
      expect(component.form.getRawValue()).toEqual({
        name: '',
        price: '',
        description: '',
      });
      expect(text(fixture)).toContain('New product');
    });

    it('switches the button label while the request is in flight', () => {
      component.submitting.set(true);

      expect(component.submitLabel()).toBe('Creating…');
    });

    it('creates the product and closes with the merged result', () => {
      component.form.setValue({
        name: 'Gadget',
        price: '19.99',
        description: 'Shiny',
      });

      component.submit();

      expect(service.createProduct).toHaveBeenCalledWith({
        name: 'Gadget',
        price: '19.99',
        description: 'Shiny',
      });
      expect(close).toHaveBeenCalledWith({
        id: 'p9',
        name: 'Gadget',
        description: 'Shiny',
        price: 19.99,
      });
    });

    it('refuses to submit an invalid form', () => {
      component.submit();

      expect(service.createProduct).not.toHaveBeenCalled();
      expect(component.form.controls.name.touched).toBe(true);
    });

    it('ignores a second submit while one is in flight', () => {
      component.form.setValue({ name: 'Gadget', price: '1', description: '' });
      component.submitting.set(true);

      component.submit();

      expect(service.createProduct).not.toHaveBeenCalled();
    });

    it('closes with nothing when cancelled', () => {
      component.cancel();

      expect(close).toHaveBeenCalledWith();
    });
  });

  describe('in edit mode', () => {
    beforeEach(() => build({ mode: 'edit', product: EXISTING }));

    it('opens pre-filled with edit-flavoured copy', () => {
      expect(component.isEdit).toBe(true);
      expect(component.title).toBe('Edit product');
      expect(component.submitLabel()).toBe('Save changes');
      expect(component.form.getRawValue()).toEqual({
        name: 'Widget',
        price: '9.5',
        description: 'A widget',
      });
    });

    it('switches the button label while the request is in flight', () => {
      component.submitting.set(true);

      expect(component.submitLabel()).toBe('Saving…');
    });

    it('updates the product and closes with the merged result', () => {
      component.form.controls.price.setValue('12.00');

      component.submit();

      expect(service.updateProduct).toHaveBeenCalledWith(
        { name: 'Widget', price: '12.00', description: 'A widget' },
        'p1',
      );
      expect(close).toHaveBeenCalledWith({ ...EXISTING, price: 12 });
    });
  });

  it('falls back to creating when edit mode arrives without a product', () => {
    build({ mode: 'edit' });
    component.form.setValue({ name: 'Gadget', price: '1', description: '' });

    component.submit();

    expect(service.createProduct).toHaveBeenCalled();
    expect(service.updateProduct).not.toHaveBeenCalled();
  });

  describe('validation messages', () => {
    beforeEach(() => build({ mode: 'create' }));

    it('stays quiet until a field has been touched', () => {
      expect(component.nameError()).toBeNull();
      expect(component.priceError()).toBeNull();
    });

    it('asks for the missing name and price', () => {
      component.form.markAllAsTouched();

      expect(component.nameError()).toBe('A name is required.');
      expect(component.priceError()).toBe('A price is required.');
    });

    it('rejects a one-character name and a non-numeric price', () => {
      component.form.patchValue({ name: 'A', price: 'free' });
      component.form.markAllAsTouched();

      expect(component.nameError()).toMatch(/at least 2/);
      expect(component.priceError()).toMatch(/12 or 12.50/);
    });

    it('has nothing to say once both fields are good', () => {
      component.form.patchValue({ name: 'Gadget', price: '12.50' });
      component.form.markAllAsTouched();

      expect(component.nameError()).toBeNull();
      expect(component.priceError()).toBeNull();
    });
  });

  describe('when saving fails', () => {
    const cases: Array<[number, RegExp]> = [
      [400, /fields look off/],
      [403, /permission/],
      [500, /Could not save/],
    ];

    for (const [status, expected] of cases) {
      it(`explains a ${status}`, () => {
        build({ mode: 'create' });
        service.createProduct.mockReturnValue(failWith(status) as never);
        component.form.setValue({
          name: 'Gadget',
          price: '1',
          description: '',
        });

        component.submit();

        expect(component.errorMessage()).toMatch(expected);
        expect(component.submitting()).toBe(false);
        expect(close).not.toHaveBeenCalled();
      });
    }
  });
});
