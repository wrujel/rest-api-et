import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Observable, of, throwError } from 'rxjs';

import { HomeComponent } from './home.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { ProductFormDialogComponent } from '../product-form-dialog/product-form-dialog.component';
import { AuthService } from '../../services/auth.service';
import { CommonService } from '../../services/common.service';
import { NotificationService } from '../../services/notification.service';
import { IProduct } from '../../models/product';
import { createAuthStub } from '../../../testing/auth';
import { stubReducedMotion } from '../../../testing/motion';

const product = (over: Partial<IProduct>): IProduct => ({
  id: 'p1',
  name: 'Widget',
  description: 'A widget',
  price: 10,
  username: 'ada',
  email: 'ada@example.com',
  ...over,
});

const CATALOG = [
  product({ id: 'p1', name: 'Bravo', price: 30 }),
  product({
    id: 'p2',
    name: 'alpha',
    price: 10,
    username: 'grace',
    email: 'grace@example.com',
  }),
  product({ id: 'p3', name: 'Charlie', price: 20, description: 'rare gizmo' }),
];

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  let auth: ReturnType<typeof createAuthStub>;

  // `CommonService` returns `Observable<unknown>`, so the doubles are typed
  // loosely enough to hand back the odd shapes the component has to survive.
  const service = {
    getProducts: vi.fn<() => Observable<unknown>>(() => of(CATALOG)),
    deleteProduct: vi.fn<(id: string) => Observable<unknown>>(() => of(null)),
  };
  const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const afterClosed = vi.fn(() => of(undefined as unknown));
  const dialog = { open: vi.fn(() => ({ afterClosed })) };

  const build = () => {
    TestBed.resetTestingModule();
    auth = createAuthStub();
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideNoopAnimations(),
        { provide: CommonService, useValue: service },
        { provide: NotificationService, useValue: notify },
        { provide: AuthService, useValue: auth },
      ],
    });
    // The component imports `MatDialogModule`, whose own `MatDialog` provider
    // would otherwise win over a plain testing-module provider.
    TestBed.overrideProvider(MatDialog, { useValue: dialog });
    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stubReducedMotion(true);
    service.getProducts.mockReturnValue(of(CATALOG));
    service.deleteProduct.mockReturnValue(of(null));
    afterClosed.mockReturnValue(of(undefined));
    build();
  });

  describe('loading', () => {
    it('fetches the catalog on construction', () => {
      expect(service.getProducts).toHaveBeenCalledOnce();
      expect(component.products()).toEqual(CATALOG);
      expect(component.loading()).toBe(false);
      expect(component.hasProducts()).toBe(true);
    });

    it('treats a non-array response as an empty catalog', () => {
      service.getProducts.mockReturnValue(of({ oops: true }));
      build();

      expect(component.products()).toEqual([]);
      expect(component.hasProducts()).toBe(false);
    });

    it('reports a load failure without a toast', () => {
      service.getProducts.mockReturnValue(
        throwError(() => new Error('offline')),
      );
      build();

      expect(component.loadError()).toMatch(/could not load/);
      expect(component.loading()).toBe(false);
    });

    it('confirms an explicit refresh', () => {
      component.fetch(true);

      expect(notify.success).toHaveBeenCalledWith('Refreshed');
    });

    it('stays quiet on the implicit refresh', () => {
      component.fetch();

      expect(notify.success).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('returns everything for an empty query', () => {
      expect(component.filtered()).toHaveLength(3);
    });

    it('matches on name, case-insensitively', () => {
      component.searchControl.setValue('ALPHA');

      expect(component.filtered().map((p) => p.id)).toEqual(['p2']);
    });

    it('matches on description, owner name and email', () => {
      component.searchControl.setValue('gizmo');
      expect(component.filtered().map((p) => p.id)).toEqual(['p3']);

      component.searchControl.setValue('grace');
      expect(component.filtered().map((p) => p.id)).toEqual(['p2']);

      component.searchControl.setValue('ada@example.com');
      expect(component.filtered()).toHaveLength(2);
    });

    it('copes with products missing their optional fields', () => {
      service.getProducts.mockReturnValue(
        of([{ id: 'p9', name: 'Bare', price: 1 }]),
      );
      build();

      component.searchControl.setValue('bare');
      expect(component.filtered()).toHaveLength(1);

      component.searchControl.setValue('nothing');
      expect(component.filtered()).toHaveLength(0);
    });

    it('clears the query and returns to the first page', () => {
      component.searchControl.setValue('alpha');
      component.pageIndex.set(3);

      component.clearSearch();

      expect(component.searchControl.value).toBe('');
      expect(component.pageIndex()).toBe(0);
    });
  });

  describe('sorting', () => {
    const names = () => component.sorted().map((p) => p.name);

    it('defaults to name ascending', () => {
      expect(component.sort()).toBe('name-asc');
      expect(names()).toEqual(['alpha', 'Bravo', 'Charlie']);
      expect(component.currentSortLabel()).toBe('Name · A → Z');
    });

    it('sorts by name descending', () => {
      component.setSort('name-desc');

      expect(names()).toEqual(['Charlie', 'Bravo', 'alpha']);
    });

    it('sorts by price in both directions', () => {
      component.setSort('price-asc');
      expect(component.sorted().map((p) => p.price)).toEqual([10, 20, 30]);

      component.setSort('price-desc');
      expect(component.sorted().map((p) => p.price)).toEqual([30, 20, 10]);
    });

    it('returns to the first page when the order changes', () => {
      component.pageIndex.set(2);

      component.setSort('price-asc');

      expect(component.pageIndex()).toBe(0);
    });

    it('labels every option it offers in the menu', () => {
      expect(
        component['sortKeys'].map((key) => component['sortLabel'](key)),
      ).toEqual([
        'Name · A → Z',
        'Name · Z → A',
        'Price · Low → High',
        'Price · High → Low',
      ]);
    });
  });

  describe('paging', () => {
    it('shows the whole catalog on one page by default', () => {
      expect(component.visible()).toHaveLength(3);
      expect(component.totalCount()).toBe(3);
    });

    it('slices to the requested page', () => {
      component.onPage({ pageIndex: 1, pageSize: 2 } as PageEvent);

      expect(component.visible().map((p) => p.name)).toEqual(['Charlie']);
      expect(component.pageSize()).toBe(2);
    });
  });

  describe('the greeting', () => {
    // `greeting` is a computed over a non-reactive clock, so each case needs a
    // fresh component built at the hour under test.
    const greetingAt = (hour: number) => {
      vi.setSystemTime(new Date(2026, 0, 1, hour, 0, 0));
      build();
      return component.greeting();
    };

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('addresses the signed-in visitor by the local part of their email', () => {
      vi.setSystemTime(new Date(2026, 0, 1, 9, 0, 0));
      build();
      auth.userEmail.set('ada@example.com');

      expect(component.greeting()).toBe('Good morning, ada');
    });

    it('falls back to a generic address with no email', () => {
      expect(greetingAt(9)).toBe('Good morning, there');
    });

    it('matches the greeting to the time of day', () => {
      expect([2, 9, 15, 21].map(greetingAt)).toEqual([
        'Good night, there',
        'Good morning, there',
        'Good afternoon, there',
        'Good evening, there',
      ]);
    });
  });

  describe('creating', () => {
    it('opens the form dialog in create mode', () => {
      component.openCreate();

      expect(dialog.open).toHaveBeenCalledWith(
        ProductFormDialogComponent,
        expect.objectContaining({ data: { mode: 'create' } }),
      );
    });

    it('confirms and reloads once the dialog returns a product', () => {
      afterClosed.mockReturnValue(of(product({ name: 'Gadget' })));

      component.openCreate();

      expect(notify.success).toHaveBeenCalledWith('"Gadget" was created');
      expect(service.getProducts).toHaveBeenCalledTimes(2);
    });

    it('does nothing when the dialog is dismissed', () => {
      component.openCreate();

      expect(notify.success).not.toHaveBeenCalled();
      expect(service.getProducts).toHaveBeenCalledOnce();
    });
  });

  describe('editing', () => {
    it('opens the form dialog with the product to edit', () => {
      component.openEdit(CATALOG[0]);

      expect(dialog.open).toHaveBeenCalledWith(
        ProductFormDialogComponent,
        expect.objectContaining({
          data: { mode: 'edit', product: CATALOG[0] },
        }),
      );
    });

    it('confirms and reloads once the dialog returns a product', () => {
      afterClosed.mockReturnValue(of(product({ name: 'Bravo' })));

      component.openEdit(CATALOG[0]);

      expect(notify.success).toHaveBeenCalledWith('"Bravo" was updated');
      expect(service.getProducts).toHaveBeenCalledTimes(2);
    });

    it('does nothing when the dialog is dismissed', () => {
      component.openEdit(CATALOG[0]);

      expect(notify.success).not.toHaveBeenCalled();
    });
  });

  describe('deleting', () => {
    it('asks for confirmation naming the product', () => {
      component.confirmDelete(CATALOG[0]);

      expect(dialog.open).toHaveBeenCalledWith(
        ConfirmDialogComponent,
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Delete this product?',
            message: expect.stringContaining('Bravo'),
            danger: true,
          }),
        }),
      );
    });

    it('leaves the product alone when the prompt is declined', () => {
      afterClosed.mockReturnValue(of(false));

      component.confirmDelete(CATALOG[0]);

      expect(service.deleteProduct).not.toHaveBeenCalled();
    });

    it('deletes, confirms and reloads when the prompt is accepted', () => {
      afterClosed.mockReturnValue(of(true));

      component.confirmDelete(CATALOG[0]);

      expect(service.deleteProduct).toHaveBeenCalledWith('p1');
      expect(notify.success).toHaveBeenCalledWith('"Bravo" was deleted');
      expect(service.getProducts).toHaveBeenCalledTimes(2);
    });
  });

  describe('identifyRow', () => {
    it('tracks a row by its id', () => {
      expect(component.identifyRow(0, CATALOG[0])).toBe('p1');
    });

    it('falls back to the name for a row with no id yet', () => {
      expect(
        component.identifyRow(0, product({ id: undefined as never })),
      ).toBe('Widget');
    });
  });
});
