import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { startWith } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { PRODUCT_ENDPOINTS, ApiEndpointDoc } from '../../models/api-docs';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { RevealDirective } from '../../directives/reveal.directive';
import { highlightJson, highlightShell } from '../../utils/highlight';
import { ApiTestDialogComponent } from '../api-test-dialog/api-test-dialog.component';

@Component({
  selector: 'app-api-docs',
  imports: [RouterLink, ReactiveFormsModule, MatButtonModule, MatIconModule, MatTooltipModule, RevealDirective],
  templateUrl: './api-docs.component.html',
  styleUrl: './api-docs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApiDocsComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  protected readonly auth = inject(AuthService);

  /** Selected endpoint id, deep-linkable via ?e=<id>. */
  readonly e = input<string>();

  protected readonly endpoints = PRODUCT_ENDPOINTS;

  protected readonly selected = computed<ApiEndpointDoc>(() => {
    const id = this.e();
    return this.endpoints.find((endpoint) => endpoint.id === id) ?? this.endpoints[0];
  });

  /* ── Sidebar search ─────────────────────────────────────── */

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(
    this.searchControl.valueChanges.pipe(startWith(''), takeUntilDestroyed()),
    { initialValue: '' },
  );

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.endpoints;
    return this.endpoints.filter((endpoint) =>
      `${endpoint.summary} ${endpoint.method} ${endpoint.path}`.toLowerCase().includes(q),
    );
  });

  /* ── Detail sections ────────────────────────────────────── */

  protected readonly queryParams = computed(() =>
    this.selected().params.filter((param) => param.in === 'query'),
  );
  protected readonly bodyParams = computed(() =>
    this.selected().params.filter((param) => param.in === 'body'),
  );

  /** Expanded response rows, keyed per endpoint; first row opens by default. */
  private readonly openResponses = signal<Record<string, boolean>>({});

  isResponseOpen(status: number, index: number): boolean {
    return this.openResponses()[this.selected().id + status] ?? index === 0;
  }

  toggleResponse(status: number, index: number) {
    const key = this.selected().id + status;
    const next = !this.isResponseOpen(status, index);
    this.openResponses.update((map) => ({ ...map, [key]: next }));
  }

  /* ── Side code panel ────────────────────────────────────── */

  protected readonly curlHtml = computed(() => highlightShell(this.selected().curl));

  protected readonly activeStatus = signal<number | null>(null);
  protected readonly activeResponse = computed(
    () =>
      this.selected().responses.find((r) => r.status === this.activeStatus()) ??
      this.selected().responses[0],
  );
  protected readonly activeResponseHtml = computed(() => {
    const example = this.activeResponse()?.example;
    return example ? highlightJson(example) : '';
  });

  protected jsonHtml(example: string): string {
    return highlightJson(example);
  }

  /* ── Actions ────────────────────────────────────────────── */

  select(id: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { e: id },
      replaceUrl: true,
    });
  }

  openTest() {
    this.dialog.open(ApiTestDialogComponent, {
      data: this.selected(),
      width: '96vw',
      maxWidth: '1100px',
      height: '84vh',
      panelClass: 'api-test-panel',
    });
  }

  async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.notify.success('Copied to clipboard');
    } catch {
      this.notify.error('Could not copy — select the text manually.');
    }
  }
}
