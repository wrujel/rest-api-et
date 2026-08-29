import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ApiDocsComponent } from './api-docs.component';
import { ApiTestDialogComponent } from '../api-test-dialog/api-test-dialog.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { PRODUCT_ENDPOINTS } from '../../models/api-docs';
import { createAuthStub } from '../../../testing/auth';
import { stubReducedMotion } from '../../../testing/motion';

describe('ApiDocsComponent', () => {
  let fixture: ComponentFixture<ApiDocsComponent>;
  let component: ApiDocsComponent;
  let navigate: ReturnType<typeof vi.spyOn>;

  const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const dialog = { open: vi.fn() };
  const route = {};

  /** Reaches the component's protected surface, which is what the template uses. */
  const internals = () =>
    component as unknown as {
      endpoints: typeof PRODUCT_ENDPOINTS;
      selected: () => (typeof PRODUCT_ENDPOINTS)[number];
      filtered: () => typeof PRODUCT_ENDPOINTS;
      searchControl: { setValue: (value: string) => void };
      queryParams: () => { name: string }[];
      bodyParams: () => { name: string }[];
      curlHtml: () => string;
      activeStatus: { set: (value: number | null) => void };
      activeResponse: () => { status: number } | undefined;
      activeResponseHtml: () => string;
      jsonHtml: (example: string) => string;
    };

  const build = (endpointId?: string) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ApiDocsComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: route },
        { provide: NotificationService, useValue: notify },
        { provide: AuthService, useValue: createAuthStub() },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: dialog });
    navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    fixture = TestBed.createComponent(ApiDocsComponent);
    component = fixture.componentInstance;
    if (endpointId) fixture.componentRef.setInput('e', endpointId);
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stubReducedMotion(true);
    build();
  });

  describe('endpoint selection', () => {
    it('opens on the first endpoint when the deep link is absent', () => {
      expect(internals().selected()).toBe(PRODUCT_ENDPOINTS[0]);
    });

    it('honours a deep link', () => {
      build(PRODUCT_ENDPOINTS[2].id);

      expect(internals().selected()).toBe(PRODUCT_ENDPOINTS[2]);
    });

    it('falls back to the first endpoint for an unknown id', () => {
      build('no-such-endpoint');

      expect(internals().selected()).toBe(PRODUCT_ENDPOINTS[0]);
    });

    it('deep-links the selection into the query string without a history entry', () => {
      component.select('products-create');

      expect(navigate).toHaveBeenCalledWith([], {
        relativeTo: route,
        queryParams: { e: 'products-create' },
        replaceUrl: true,
      });
    });
  });

  describe('sidebar search', () => {
    it('lists every endpoint for an empty query', () => {
      expect(internals().filtered()).toEqual(PRODUCT_ENDPOINTS);
    });

    it('matches on the HTTP method', () => {
      internals().searchControl.setValue('delete');

      expect(
        internals()
          .filtered()
          .map((e) => e.method),
      ).toEqual(['DELETE']);
    });

    it('matches on the summary and on the path', () => {
      internals().searchControl.setValue('List all');
      expect(internals().filtered()).toHaveLength(1);

      internals().searchControl.setValue('/api/products');
      expect(internals().filtered()).toEqual(PRODUCT_ENDPOINTS);
    });

    it('returns nothing for a query that matches no endpoint', () => {
      internals().searchControl.setValue('graphql');

      expect(internals().filtered()).toHaveLength(0);
    });
  });

  describe('parameter tables', () => {
    it('splits query parameters from body parameters', () => {
      const withBoth = PRODUCT_ENDPOINTS.find(
        (endpoint) =>
          endpoint.params.some((p) => p.in === 'query') &&
          endpoint.params.some((p) => p.in === 'body'),
      )!;
      build(withBoth.id);

      expect(
        internals()
          .queryParams()
          .every((p) => !!p.name),
      ).toBe(true);
      expect(internals().queryParams().length).toBeGreaterThan(0);
      expect(internals().bodyParams().length).toBeGreaterThan(0);
    });

    it('shows no parameters at all for the list endpoint', () => {
      expect(internals().queryParams()).toHaveLength(0);
      expect(internals().bodyParams()).toHaveLength(0);
    });
  });

  describe('response rows', () => {
    it('opens the first row and leaves the rest closed', () => {
      expect(component.isResponseOpen(200, 0)).toBe(true);
      expect(component.isResponseOpen(401, 1)).toBe(false);
    });

    it('toggles a row closed and open again', () => {
      component.toggleResponse(200, 0);
      expect(component.isResponseOpen(200, 0)).toBe(false);

      component.toggleResponse(200, 0);
      expect(component.isResponseOpen(200, 0)).toBe(true);
    });

    it('keeps the open rows separate per endpoint', () => {
      component.toggleResponse(200, 0);
      expect(component.isResponseOpen(200, 0)).toBe(false);

      build(PRODUCT_ENDPOINTS[1].id);
      expect(component.isResponseOpen(201, 0)).toBe(true);
    });
  });

  describe('the code panel', () => {
    it('highlights the curl snippet', () => {
      expect(internals().curlHtml()).toContain('tok-cmd');
    });

    it('previews the first response until another status is picked', () => {
      expect(internals().activeResponse()?.status).toBe(
        PRODUCT_ENDPOINTS[0].responses[0].status,
      );

      internals().activeStatus.set(401);
      expect(internals().activeResponse()?.status).toBe(401);
    });

    it('falls back to the first response for an unknown status', () => {
      internals().activeStatus.set(999);

      expect(internals().activeResponse()?.status).toBe(
        PRODUCT_ENDPOINTS[0].responses[0].status,
      );
    });

    it('highlights an example body and renders nothing without one', () => {
      expect(internals().activeResponseHtml()).toContain('tok-key');

      internals().activeStatus.set(401);
      expect(internals().activeResponseHtml()).toBe('');
    });

    it('highlights an arbitrary JSON example on request', () => {
      expect(internals().jsonHtml('{"a":1}')).toContain('tok-num');
    });
  });

  describe('the try-it dialog', () => {
    it('opens with the selected endpoint', () => {
      component.openTest();

      expect(dialog.open).toHaveBeenCalledWith(
        ApiTestDialogComponent,
        expect.objectContaining({ data: PRODUCT_ENDPOINTS[0] }),
      );
    });
  });

  describe('copy', () => {
    it('confirms a successful copy', async () => {
      const writeText = vi
        .spyOn(navigator.clipboard, 'writeText')
        .mockResolvedValue();

      await component.copy('curl ...');

      expect(writeText).toHaveBeenCalledWith('curl ...');
      expect(notify.success).toHaveBeenCalledWith('Copied to clipboard');
    });

    it('explains a refused copy', async () => {
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
        new Error('denied'),
      );

      await component.copy('curl ...');

      expect(notify.error).toHaveBeenCalledWith(
        expect.stringMatching(/select the text manually/),
      );
    });
  });
});
