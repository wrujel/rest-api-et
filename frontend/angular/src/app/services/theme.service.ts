import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeChoice = 'auto' | 'light' | 'dark';
const STORAGE_KEY = 'app.themeChoice';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly mq =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  private readonly systemPrefersDark = signal(this.mq?.matches ?? false);
  readonly choice = signal<ThemeChoice>(this.readStoredChoice());
  readonly resolved = computed<'light' | 'dark'>(() => {
    const c = this.choice();
    if (c === 'auto') return this.systemPrefersDark() ? 'dark' : 'light';
    return c;
  });

  constructor() {
    this.mq?.addEventListener('change', (e) => this.systemPrefersDark.set(e.matches));
    effect(() => this.applyToDom(this.resolved()));
  }

  setChoice(next: ThemeChoice) {
    this.choice.set(next);
    this.writeStoredChoice(next);
  }

  cycle() {
    const order: ThemeChoice[] = ['auto', 'light', 'dark'];
    const i = order.indexOf(this.choice());
    this.setChoice(order[(i + 1) % order.length]);
  }

  private applyToDom(resolved: 'light' | 'dark') {
    const html = this.doc.documentElement;
    html.classList.toggle('theme-dark', resolved === 'dark');
    html.classList.toggle('theme-light', resolved === 'light');
    html.style.colorScheme = resolved;
  }

  private readStoredChoice(): ThemeChoice {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw;
    } catch {
      /* private mode or sandboxed */
    }
    return 'auto';
  }

  private writeStoredChoice(choice: ThemeChoice) {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* ignore */
    }
  }
}
