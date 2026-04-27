import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type ThemeChoice = 'light' | 'dark';
const STORAGE_KEY = 'app.themeChoice';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);

  readonly choice = signal<ThemeChoice>(this.readInitialChoice());

  constructor() {
    effect(() => this.applyToDom(this.choice()));
  }

  setChoice(next: ThemeChoice) {
    this.choice.set(next);
    this.writeStoredChoice(next);
  }

  toggle() {
    this.setChoice(this.choice() === 'dark' ? 'light' : 'dark');
  }

  private applyToDom(resolved: ThemeChoice) {
    const html = this.doc.documentElement;
    html.classList.toggle('theme-dark', resolved === 'dark');
    html.classList.toggle('theme-light', resolved === 'light');
    html.style.colorScheme = resolved;
  }

  private readInitialChoice(): ThemeChoice {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'light' || raw === 'dark') return raw;
    } catch {
      /* private mode or sandboxed */
    }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  private writeStoredChoice(choice: ThemeChoice) {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* ignore */
    }
  }
}
