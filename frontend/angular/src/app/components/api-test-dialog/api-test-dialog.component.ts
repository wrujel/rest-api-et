import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiEndpointDoc } from '../../models/api-docs';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { environment } from '../../../environments/environment';
import { escapeHtml, highlightJson } from '../../utils/highlight';

interface TestResult {
  status: number;
  statusText: string;
  ms: number;
  body: string;
  headers: [string, string][];
}

interface KeyValueRow {
  key: string;
  value: string;
}

@Component({
  selector: 'app-api-test-dialog',
  imports: [MatIconModule, MatProgressSpinnerModule, ReactiveFormsModule],
  templateUrl: './api-test-dialog.component.html',
  styleUrl: './api-test-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiTestDialogComponent {
  readonly endpoint = inject<ApiEndpointDoc>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ApiTestDialogComponent>);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);

  protected readonly queryParams = this.endpoint.params.filter((param) => param.in === 'query');
  protected readonly hasBody = !!this.endpoint.bodyExample;

  protected readonly paramControls: Record<string, FormControl<string>> = Object.fromEntries(
    this.queryParams.map((param) => [
      param.name,
      new FormControl(param.example ?? '', { nonNullable: true }),
    ]),
  );
  protected readonly bodyControl = new FormControl(this.endpoint.bodyExample ?? '', {
    nonNullable: true,
  });
  protected readonly tokenControl = new FormControl('', { nonNullable: true });

  /** Session token (if signed in) is used automatically; otherwise paste one. */
  protected readonly sessionToken = this.auth.getToken();

  /** Reactive mirror of the pasted-token field, so the Headers preview updates. */
  private readonly tokenValue = toSignal(this.tokenControl.valueChanges.pipe(startWith('')), {
    initialValue: '',
  });

  /* ── URL bar ────────────────────────────────────────────── */

  protected readonly displayPath = this.endpoint.path.split('?')[0];
  protected readonly displayHost = environment.url
    ? new URL(environment.url).host
    : location.host;

  /* ── Request headers preview (read-only rows) ───────────── */

  protected readonly requestHeaders = computed<KeyValueRow[]>(() => {
    const rows: KeyValueRow[] = [{ key: 'Accept', value: '*/*' }];
    if (this.hasBody) rows.push({ key: 'Content-Type', value: 'application/json' });
    if (this.endpoint.auth) {
      rows.push({
        key: 'Authorization',
        value: this.token().length ? `Bearer ${'•'.repeat(12)}` : 'not set',
      });
    }
    return rows;
  });

  /* ── Collapsible sections ───────────────────────────────── */

  private readonly openSections = signal<Record<string, boolean>>({
    auth: true,
    headers: true,
    query: true,
    body: true,
    resHeaders: false,
    resBody: true,
  });

  isOpen(section: string): boolean {
    return this.openSections()[section] ?? true;
  }

  toggle(section: string) {
    this.openSections.update((map) => ({ ...map, [section]: !this.isOpen(section) }));
  }

  /* ── Body editor line numbers ───────────────────────────── */

  private readonly bodyValue = toSignal(this.bodyControl.valueChanges.pipe(startWith('')), {
    initialValue: this.bodyControl.value,
  });
  protected readonly bodyLines = computed(() => lineNumbers(this.bodyValue() ?? ''));

  private readonly bodyGutter = viewChild<ElementRef<HTMLElement>>('bodyGutter');

  syncGutter(target: EventTarget | null) {
    const gutter = this.bodyGutter()?.nativeElement;
    if (gutter && target instanceof HTMLTextAreaElement) gutter.scrollTop = target.scrollTop;
  }

  /* ── Send / result ──────────────────────────────────────── */

  protected readonly sending = signal(false);
  protected readonly sendError = signal<string | null>(null);
  protected readonly result = signal<TestResult | null>(null);

  protected readonly resultHtml = computed(() => {
    const body = this.result()?.body;
    if (!body) return '';
    return looksJson(body) ? highlightJson(body) : escapeHtml(body);
  });
  protected readonly resultLines = computed(() => lineNumbers(this.result()?.body ?? ''));

  close() {
    this.ref.close();
  }

  private token(): string {
    return this.sessionToken ?? this.tokenValue().trim();
  }

  async send() {
    if (this.sending()) return;

    const token = this.token();
    if (this.endpoint.auth && !token) {
      this.sendError.set('A Bearer token is required — sign in first, or paste one above.');
      return;
    }

    const query = new URLSearchParams();
    for (const param of this.queryParams) {
      const value = this.paramControls[param.name].value.trim();
      if (param.required && !value) {
        this.sendError.set(`Missing required query parameter "${param.name}".`);
        return;
      }
      if (value) query.set(param.name, value);
    }

    let body: string | undefined;
    if (this.hasBody) {
      try {
        JSON.parse(this.bodyControl.value);
        body = this.bodyControl.value;
      } catch {
        this.sendError.set('The request body is not valid JSON.');
        return;
      }
    }

    const url = `${environment.url}${this.displayPath}${query.size ? `?${query}` : ''}`;

    const headers: Record<string, string> = { Accept: '*/*' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';

    this.sending.set(true);
    this.sendError.set(null);
    this.result.set(null);
    const started = performance.now();
    try {
      const response = await fetch(url, { method: this.endpoint.method, headers, body });
      let text = await response.text();
      try {
        text = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* plain-text body — keep as-is */
      }
      const responseHeaders: [string, string][] = [];
      response.headers.forEach((value, key) => responseHeaders.push([key, value]));
      this.result.set({
        status: response.status,
        statusText: response.statusText,
        ms: Math.round(performance.now() - started),
        body: text,
        headers: responseHeaders,
      });
      this.openSections.update((map) => ({ ...map, resBody: true }));
    } catch {
      this.sendError.set('Network error — is the API server reachable?');
    } finally {
      this.sending.set(false);
    }
  }

  async copyResult() {
    const body = this.result()?.body;
    if (!body) return;
    try {
      await navigator.clipboard.writeText(body);
      this.notify.success('Response copied');
    } catch {
      this.notify.error('Could not copy — select the text manually.');
    }
  }
}

function lineNumbers(text: string): number[] {
  const count = Math.max(text.split('\n').length, 1);
  return Array.from({ length: count }, (_, i) => i + 1);
}

function looksJson(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}
