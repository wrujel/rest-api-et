import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

const STORAGE_KEY = 'app.themeChoice';

describe('ThemeService', () => {
  const build = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ThemeService);
    // The constructor's effect only runs once change detection is flushed.
    TestBed.tick();
    return service;
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => localStorage.clear());

  describe('the initial choice', () => {
    it('comes from storage when a valid value is stored', () => {
      localStorage.setItem(STORAGE_KEY, 'dark');

      expect(build().choice()).toBe('dark');
    });

    it('ignores a stored value that is not a theme name', () => {
      localStorage.setItem(STORAGE_KEY, 'chartreuse');

      expect(build().choice()).toBe('light');
    });

    it('follows the OS preference when nothing is stored', () => {
      const matchMedia = vi
        .spyOn(window, 'matchMedia')
        .mockReturnValue({ matches: true } as MediaQueryList);

      expect(build().choice()).toBe('dark');
      expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    });

    it('falls back to light when the OS expresses no preference', () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: false,
      } as MediaQueryList);

      expect(build().choice()).toBe('light');
    });

    it('falls back to light when storage is unreadable', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
      vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: false,
      } as MediaQueryList);

      expect(build().choice()).toBe('light');
    });
  });

  it('paints the document element and persists the choice', () => {
    const service = build();

    service.setChoice('dark');
    TestBed.tick();

    const html = document.documentElement;
    expect(html.classList.contains('theme-dark')).toBe(true);
    expect(html.classList.contains('theme-light')).toBe(false);
    expect(html.style.colorScheme).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('toggles back and forth', () => {
    const service = build();
    expect(service.choice()).toBe('light');

    service.toggle();
    expect(service.choice()).toBe('dark');

    service.toggle();
    expect(service.choice()).toBe('light');

    TestBed.tick();
    expect(document.documentElement.classList.contains('theme-light')).toBe(
      true,
    );
  });

  it('still switches theme when the choice cannot be persisted', () => {
    const service = build();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(() => service.setChoice('dark')).not.toThrow();
    expect(service.choice()).toBe('dark');
  });
});
