import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonService } from '../../services/common.service';
import { IProduct, IProductForm } from '../../models/product';

export type ProductFormMode = 'create' | 'edit';

export interface ProductFormDialogData {
  mode: ProductFormMode;
  product?: IProduct;
}

@Component({
  selector: 'app-product-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './product-form-dialog.component.html',
  styleUrl: './product-form-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductFormDialogComponent {
  readonly data = inject<ProductFormDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ProductFormDialogComponent, IProduct | undefined>);
  private readonly service = inject(CommonService);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly isEdit = this.data.mode === 'edit';
  readonly title = this.isEdit ? 'Edit product' : 'New product';
  readonly subtitle = this.isEdit
    ? 'Tweak the details and save.'
    : 'Give it a name, a price, and a short description.';
  readonly submitLabel = computed(() => {
    if (this.submitting()) return this.isEdit ? 'Saving…' : 'Creating…';
    return this.isEdit ? 'Save changes' : 'Create product';
  });

  readonly form = new FormGroup({
    name: new FormControl(this.data.product?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    price: new FormControl(this.data.product ? String(this.data.product.price) : '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)],
    }),
    description: new FormControl(this.data.product?.description ?? '', { nonNullable: true }),
  });

  cancel() {
    this.ref.close();
  }

  nameError(): string | null {
    const c = this.form.controls.name;
    if (!c.touched && !c.dirty) return null;
    if (c.hasError('required')) return 'A name is required.';
    if (c.hasError('minlength')) return 'Use at least 2 characters.';
    return null;
  }

  priceError(): string | null {
    const c = this.form.controls.price;
    if (!c.touched && !c.dirty) return null;
    if (c.hasError('required')) return 'A price is required.';
    if (c.hasError('pattern')) return 'Use a number like 12 or 12.50.';
    return null;
  }

  submit() {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage.set(null);
    this.submitting.set(true);
    const payload = this.form.getRawValue() as IProductForm;

    const request$ = this.isEdit && this.data.product
      ? this.service.updateProduct(payload, this.data.product.id)
      : this.service.createProduct(payload);

    request$.subscribe({
      next: (response) => {
        this.submitting.set(false);
        const merged: IProduct = {
          ...(this.data.product ?? ({} as IProduct)),
          ...(response as Partial<IProduct>),
          name: payload.name,
          description: payload.description,
          price: Number(payload.price),
        };
        this.ref.close(merged);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        if (err.status === 400) this.errorMessage.set('Some fields look off. Please double-check.');
        else if (err.status === 403) this.errorMessage.set("You don't have permission to do that.");
        else this.errorMessage.set('Could not save the product. Please try again.');
      },
    });
  }
}
