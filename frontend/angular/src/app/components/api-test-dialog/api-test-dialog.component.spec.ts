import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ApiTestDialogComponent } from './api-test-dialog.component';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { ApiEndpointDoc } from '../../models/api-docs';
import { environment } from '../../../environments/environment';
import { AuthStub, createAuthStub } from '../../../testing/auth';

const listEndpoint: ApiEndpointDoc = {
  id: 'products-list',
  method: 'GET',
  path: '/api/products',
  summary: 'List all products',
  description: 'Everything in the catalog.',
  auth: true,
  params: [],
  responses: [{ status: 200, description: 'OK' }],
  curl: 'curl http://localhost:8080/api/products',
};

const deleteEndpoint: ApiEndpointDoc = {
  id: 'products-delete',
  method: 'DELETE',
  path: '/api/products?id={productId}',
  summary: 'Delete a product',
  description: 'Removes a product.',
  auth: true,
  params: [
    {
      name: 'id',
      in: 'query',
      type: 'string',
      required: true,
      description: 'Product id.',
      example: 'p1',
    },
    {
      name: 'dryRun',
      in: 'query',
      type: 'boolean',
      required: false,
      description: 'Preview only.',
    },
  ],
  responses: [{ status: 204, description: 'Deleted.' }],
  curl: 'curl -X DELETE ...',
};

const createEndpoint: ApiEndpointDoc = {
  id: 'products-create',
  method: 'POST',
  path: '/api/products',
  summary: 'Create a product',
  description: 'Adds a product.',
  auth: true,
  params: [],
  bodyExample: '{\n  "name": "Widget"\n}',
  responses: [{ status: 201, description: 'Created.' }],
  curl: 'curl -X POST ...',
};

const publicEndpoint: ApiEndpointDoc = {
  ...listEndpoint,
  id: 'public',
  auth: false,
};

describe('ApiTestDialogComponent', () => {
  let fixture: ComponentFixture<ApiTestDialogComponent>;
  let component: ApiTestDialogComponent;
  let auth: AuthStub;

  const close = vi.fn();
  const notify = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  /** The template reads these through protected members. */
  const internals = () =>
    component as unknown as {
      queryParams: { name: string }[];
      hasBody: boolean;
      paramControls: Record<string, { setValue: (v: string) => void }>;
      bodyControl: { setValue: (v: string) => void; value: string };
      tokenControl: { setValue: (v: string) => void };
      sessionToken: string | null;
      displayPath: string;
      displayHost: string;
      requestHeaders: () => { key: string; value: string }[];
      bodyLines: () => number[];
      sending: () => boolean;
      sendError: () => string | null;
      result: () => { status: number; body: string } | null;
      resultHtml: () => string;
      resultLines: () => number[];
    };

  const build = (endpoint: ApiEndpointDoc, token: string | null = null) => {
    TestBed.resetTestingModule();
    auth = createAuthStub();
    auth.getToken.mockReturnValue(token);
    TestBed.configureTestingModule({
      imports: [ApiTestDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: endpoint },
        { provide: MatDialogRef, useValue: { close } },
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(ApiTestDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  /** Stands in for `fetch`, returning a response with the given body. */
  const respondWith = (
    body: string,
    init: { status?: number; statusText?: string } = {},
  ) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: init.status ?? 200,
      statusText: init.statusText ?? 'OK',
      text: () => Promise.resolve(body),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as Response);

  beforeEach(() => {
    vi.clearAllMocks();
    build(listEndpoint, 'session-token');
  });

  describe('the URL bar', () => {
    it('strips the query template off the displayed path', () => {
      build(deleteEndpoint);

      expect(internals().displayPath).toBe('/api/products');
    });

    it("uses the page's host when the API is served from the same origin", () => {
      expect(internals().displayHost).toBe(location.host);
    });

    it('uses the configured API host when one is set', () => {
      const original = environment.url;
      environment.url = 'https://api.example.com:8443';
      try {
        build(listEndpoint);
        expect(internals().displayHost).toBe('api.example.com:8443');
      } finally {
        environment.url = original;
      }
    });
  });

  describe('the request-headers preview', () => {
    it('shows Accept and a filled Authorization for a signed-in visitor', () => {
      expect(internals().requestHeaders()).toEqual([
        { key: 'Accept', value: '*/*' },
        { key: 'Authorization', value: `Bearer ${'•'.repeat(12)}` },
      ]);
    });

    it('reports Authorization as not set until a token is pasted', () => {
      build(listEndpoint);
      expect(internals().requestHeaders()[1].value).toBe('not set');

      internals().tokenControl.setValue('pasted-token');
      expect(internals().requestHeaders()[1].value).toContain('Bearer');
    });

    it('adds Content-Type for an endpoint that takes a body', () => {
      build(createEndpoint, 'session-token');

      expect(
        internals()
          .requestHeaders()
          .map((row) => row.key),
      ).toEqual(['Accept', 'Content-Type', 'Authorization']);
    });

    it('omits Authorization for a public endpoint', () => {
      build(publicEndpoint);

      expect(
        internals()
          .requestHeaders()
          .map((row) => row.key),
      ).toEqual(['Accept']);
    });
  });

  describe('collapsible sections', () => {
    it('starts with the request sections open and response headers closed', () => {
      expect(component.isOpen('query')).toBe(true);
      expect(component.isOpen('resHeaders')).toBe(false);
    });

    it('treats an unknown section as open', () => {
      expect(component.isOpen('nope')).toBe(true);
    });

    it('toggles a section shut and open again', () => {
      component.toggle('query');
      expect(component.isOpen('query')).toBe(false);

      component.toggle('query');
      expect(component.isOpen('query')).toBe(true);
    });
  });

  describe('the body editor gutter', () => {
    it('starts at a single line until the editor first emits', () => {
      build(createEndpoint);

      expect(internals().bodyLines()).toEqual([1]);
    });

    it('falls back to one line if the control is emptied to null', () => {
      build(createEndpoint);
      internals().bodyControl.setValue(null as never);

      expect(internals().bodyLines()).toEqual([1]);
    });

    it('re-numbers as lines are added', () => {
      build(createEndpoint);
      internals().bodyControl.setValue('a\nb\nc\nd');

      expect(internals().bodyLines()).toEqual([1, 2, 3, 4]);
    });

    it('scrolls the gutter in step with the textarea', () => {
      build(createEndpoint);
      const gutter = fixture.nativeElement.querySelector(
        '.body-gutter',
      ) as HTMLElement | null;
      const textarea = document.createElement('textarea');
      textarea.scrollTop = 42;

      component.syncGutter(textarea);

      if (gutter) expect(gutter.scrollTop).toBe(42);
    });

    it('ignores a scroll from anything that is not the textarea', () => {
      build(createEndpoint);

      expect(() => component.syncGutter(null)).not.toThrow();
      expect(() =>
        component.syncGutter(document.createElement('div')),
      ).not.toThrow();
    });
  });

  describe('sending', () => {
    it('calls the endpoint and records the response', async () => {
      const fetchSpy = respondWith('{"ok":true}');

      await component.send();

      expect(fetchSpy).toHaveBeenCalledWith(
        `${environment.url}/api/products`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            Accept: '*/*',
            Authorization: 'Bearer session-token',
          },
        }),
      );
      expect(internals().result()).toMatchObject({ status: 200 });
      expect(internals().result()?.body).toBe('{\n  "ok": true\n}');
      expect(internals().sending()).toBe(false);
      expect(component.isOpen('resBody')).toBe(true);
    });

    it('keeps a non-JSON body verbatim', async () => {
      respondWith('plain text');

      await component.send();

      expect(internals().result()?.body).toBe('plain text');
      expect(internals().resultHtml()).toBe('plain text');
    });

    it('highlights a JSON body and numbers its lines', async () => {
      respondWith('{"ok":true}');

      await component.send();

      expect(internals().resultHtml()).toContain('tok-key');
      expect(internals().resultLines()).toEqual([1, 2, 3]);
    });

    it('renders nothing before the first response', () => {
      expect(internals().resultHtml()).toBe('');
      expect(internals().resultLines()).toEqual([1]);
    });

    it('refuses to send a protected endpoint with no token', async () => {
      build(listEndpoint);
      const fetchSpy = respondWith('{}');

      await component.send();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(internals().sendError()).toMatch(/Bearer token is required/);
    });

    it('sends a public endpoint without a token', async () => {
      build(publicEndpoint);
      const fetchSpy = respondWith('{}');

      await component.send();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: { Accept: '*/*' } }),
      );
    });

    it('uses a pasted token when there is no session', async () => {
      build(listEndpoint);
      internals().tokenControl.setValue('  pasted-token  ');
      const fetchSpy = respondWith('{}');

      await component.send();

      expect((fetchSpy.mock.calls[0][1] as RequestInit).headers).toMatchObject({
        Authorization: 'Bearer pasted-token',
      });
    });

    it('refuses to send with a required query parameter left blank', async () => {
      build(deleteEndpoint, 'session-token');
      internals().paramControls['id'].setValue('   ');
      const fetchSpy = respondWith('{}');

      await component.send();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(internals().sendError()).toMatch(
        /Missing required query parameter/,
      );
    });

    it('appends only the filled query parameters', async () => {
      build(deleteEndpoint, 'session-token');
      const fetchSpy = respondWith('');

      await component.send();

      expect(fetchSpy.mock.calls[0][0]).toBe(
        `${environment.url}/api/products?id=p1`,
      );
    });

    it('sends a JSON body with its content type', async () => {
      build(createEndpoint, 'session-token');
      const fetchSpy = respondWith('{}');

      await component.send();

      const init = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(init.body).toBe(createEndpoint.bodyExample);
      expect(init.headers).toMatchObject({
        'Content-Type': 'application/json',
      });
    });

    it('refuses to send a malformed body', async () => {
      build(createEndpoint, 'session-token');
      internals().bodyControl.setValue('{ not json');
      const fetchSpy = respondWith('{}');

      await component.send();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(internals().sendError()).toMatch(/not valid JSON/);
    });

    it('reports a network failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

      await component.send();

      expect(internals().sendError()).toMatch(/Network error/);
      expect(internals().sending()).toBe(false);
    });

    it('ignores a second send while one is in flight', async () => {
      const fetchSpy = respondWith('{}');
      component['sending'].set(true);

      await component.send();

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('copying the response', () => {
    it('does nothing before there is a response', async () => {
      const writeText = vi.spyOn(navigator.clipboard, 'writeText');

      await component.copyResult();

      expect(writeText).not.toHaveBeenCalled();
    });

    it('confirms a successful copy', async () => {
      respondWith('plain text');
      await component.send();
      const writeText = vi
        .spyOn(navigator.clipboard, 'writeText')
        .mockResolvedValue();

      await component.copyResult();

      expect(writeText).toHaveBeenCalledWith('plain text');
      expect(notify.success).toHaveBeenCalledWith('Response copied');
    });

    it('explains a refused copy', async () => {
      respondWith('plain text');
      await component.send();
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
        new Error('denied'),
      );

      await component.copyResult();

      expect(notify.error).toHaveBeenCalledWith(
        expect.stringMatching(/select the text manually/),
      );
    });
  });

  it('closes the dialog on request', () => {
    component.close();

    expect(close).toHaveBeenCalledOnce();
  });
});
