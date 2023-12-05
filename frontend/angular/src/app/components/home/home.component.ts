import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommonService } from '../../services/common.service';
import { ApiCardComponent } from '../api-card/api-card.component';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import {
  MatSnackBar,
  MatSnackBarHorizontalPosition,
  MatSnackBarVerticalPosition,
} from '@angular/material/snack-bar';
import {
  IProduct,
  IProductForm,
  PRODUCT_FIELDS,
  createProductForm,
  updateProductForm,
} from '../../models/product';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    ApiCardComponent,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    MatTableModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  createForm = createProductForm;
  updateForm = updateProductForm;
  updateItem: any | undefined;
  deleteItem: any | undefined;
  products: IProduct[] = [];
  createLabel: string = 'New';
  getLabel: string = 'Get';
  updateLabel: string = '';
  deleteLabel: string = '';
  displayedColumns: string[] = PRODUCT_FIELDS;
  isLoading: boolean = false;
  isDisabled: boolean = true;
  showChooser: boolean = false;
  horizontalPosition: MatSnackBarHorizontalPosition = 'end';
  verticalPosition: MatSnackBarVerticalPosition = 'top';

  constructor(private service: CommonService, private _snackBar: MatSnackBar) {}

  createProduct() {
    if (this.createLabel === 'New') this.createLabel = 'Create';
    if (this.createLabel === 'Create') {
      if (this.createForm.value.name && this.createForm.value.price) {
        this.service
          .createProduct(this.createForm.value as IProductForm)
          .subscribe({
            next: () => {
              this.createForm.reset();
              if (this.getLabel === 'Refresh') this.getProducts();
            },
            error: (error: any) => {
              const errorMessage = this.getErrorMessage(error);
              if (errorMessage) this.openSnackBar(errorMessage);
            },
            complete: () => {
              this.openSnackBar('Created');
            },
          });
      }
    }
  }

  clearProduct() {
    this.createLabel = 'New';
    this.updateLabel = '';
  }

  async getProducts(message?: string) {
    this.isLoading = true;
    this.service.getProducts().subscribe({
      next: (response: any) => {
        this.products = response;
      },
      error: (error: any) => {
        const errorMessage = this.getErrorMessage(error);
        if (errorMessage) this.openSnackBar(errorMessage);
      },
      complete: () => {
        this.getLabel = 'Refresh';
        this.isLoading = false;
        this.isDisabled = false;
        this.showChooser = true;
        if (message) this.openSnackBar(message);
      },
    });
  }

  updateProduct() {
    if (
      this.updateForm.value.name &&
      this.updateForm.value.price &&
      this.updateItem
    ) {
      this.isLoading = true;
      this.service
        .updateProduct(
          this.updateForm.value as IProductForm,
          this.updateItem.id
        )
        .subscribe({
          next: async () => {
            this.updateForm.reset();
            this.getProducts('Updated');
          },
          error: (error: any) => {
            this.isLoading = false;
            const errorMessage = this.getErrorMessage(error);
            if (errorMessage) this.openSnackBar(errorMessage);
          },
        });
    }
  }

  updateSelect(event: any) {
    this.updateItem = event;
    this.updateLabel = 'Update';
    this.updateForm.patchValue({
      name: event.name,
      price: event.price,
      description: event.description,
    });
  }

  deleteProduct() {
    if (this.deleteItem) {
      this.isLoading = true;
      this.service.deleteProduct(this.deleteItem.id).subscribe({
        next: async () => {
          this.deleteLabel = '';
          this.getProducts('Deleted');
        },
        error: (error: any) => {
          this.isLoading = false;
          const errorMessage = this.getErrorMessage(error);
          if (errorMessage) this.openSnackBar(errorMessage);
        },
      });
    }
  }

  deleteSelect(event: any) {
    this.deleteItem = event;
    this.deleteLabel = 'Delete';
  }

  clearProducts() {
    this.products = [];
    this.updateForm.reset();
    this.getLabel = 'Get';
    this.updateLabel = '';
    this.isDisabled = true;
    this.showChooser = false;
  }

  openSnackBar(message: string) {
    this._snackBar.open(message, 'X', {
      horizontalPosition: this.horizontalPosition,
      verticalPosition: this.verticalPosition,
      duration: 4000,
    });
  }

  getErrorMessage(error: any) {
    if (error.status === 403) return 'Forbidden';
    else if (error.status === 404) return 'Not Found';
    else if (error.status === 400) return 'Bad Request';
    else if (error.status === 500) return 'Internal Server Error';
    else return 'Error';
  }
}
