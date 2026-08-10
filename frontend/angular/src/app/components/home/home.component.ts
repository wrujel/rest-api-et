import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonService } from '../../services/common.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { IProduct } from '../../models/product';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import {
  ProductFormDialogComponent,
  ProductFormDialogData,
} from '../product-form-dialog/product-form-dialog.component';
import { listStagger } from '../../app.animations';
import { CountUpDirective } from '../../directives/count-up.directive';
import { RevealDirective } from '../../directives/reveal.directive';

type SortKey = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';

const SORT_LABELS: Record<SortKey, string> = {
  'name-asc': 'Name · A → Z',
  'name-desc': 'Name · Z → A',
  'price-asc': 'Price · Low → High',
  'price-desc': 'Price · High → Low',
};

@Component({
  selector: 'app-home',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
    CountUpDirective,
    RevealDirective,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  animations: [listStagger],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly service = inject(CommonService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  readonly products = signal<IProduct[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly sort = signal<SortKey>('name-asc');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);

  readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly searchValue = toSignal(this.searchControl.valueChanges, { initialValue: '' });

  readonly displayedColumns = ['name', 'price', 'description', 'owner', 'actions'];

  readonly filtered = computed(() => {
    const q = this.searchValue().trim().toLowerCase();
    const list = this.products();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.username ?? '').toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q),
    );
  });

  readonly sorted = computed(() => {
    const list = [...this.filtered()];
    switch (this.sort()) {
      case 'name-desc':
        return list.sort((a, b) => b.name.localeCompare(a.name));
      case 'price-asc':
        return list.sort((a, b) => Number(a.price) - Number(b.price));
      case 'price-desc':
        return list.sort((a, b) => Number(b.price) - Number(a.price));
      case 'name-asc':
      default:
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }
  });

  readonly visible = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sorted().slice(start, start + this.pageSize());
  });

  readonly totalCount = computed(() => this.filtered().length);
  readonly hasProducts = computed(() => this.products().length > 0);
  readonly currentSortLabel = computed(() => SORT_LABELS[this.sort()]);

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const period = hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    const email = this.auth.userEmail();
    const name = email ? email.split('@')[0] : 'there';
    return `Good ${period}, ${name}`;
  });

  constructor() {
    this.fetch();
  }

  fetch(showSuccess = false) {
    this.loading.set(true);
    this.loadError.set(null);
    this.service.getProducts().subscribe({
      next: (response) => {
        const list = (Array.isArray(response) ? response : []) as IProduct[];
        this.products.set(list);
        this.loading.set(false);
        if (showSuccess) this.notify.success('Refreshed');
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('We could not load your products. Please try again.');
      },
    });
  }

  setSort(next: SortKey) {
    this.sort.set(next);
    this.pageIndex.set(0);
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  clearSearch() {
    this.searchControl.setValue('');
    this.pageIndex.set(0);
  }

  openCreate() {
    const data: ProductFormDialogData = { mode: 'create' };
    this.dialog
      .open(ProductFormDialogComponent, { data, autoFocus: 'first-tabbable', restoreFocus: true })
      .afterClosed()
      .subscribe((result?: IProduct) => {
        if (!result) return;
        this.notify.success(`"${result.name}" was created`);
        this.fetch();
      });
  }

  openEdit(product: IProduct) {
    const data: ProductFormDialogData = { mode: 'edit', product };
    this.dialog
      .open(ProductFormDialogComponent, { data, autoFocus: 'first-tabbable', restoreFocus: true })
      .afterClosed()
      .subscribe((result?: IProduct) => {
        if (!result) return;
        this.notify.success(`"${result.name}" was updated`);
        this.fetch();
      });
  }

  confirmDelete(product: IProduct) {
    const data: ConfirmDialogData = {
      title: 'Delete this product?',
      message: `"${product.name}" will be removed for everyone. This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      icon: 'delete',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, autoFocus: 'first-tabbable' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.service.deleteProduct(product.id).subscribe({
          next: () => {
            this.notify.success(`"${product.name}" was deleted`);
            this.fetch();
          },
        });
      });
  }

  identifyRow(_index: number, item: IProduct) {
    return item.id ?? item.name;
  }

  protected readonly sortKeys: SortKey[] = ['name-asc', 'name-desc', 'price-asc', 'price-desc'];
  protected sortLabel(key: SortKey) {
    return SORT_LABELS[key];
  }
}
