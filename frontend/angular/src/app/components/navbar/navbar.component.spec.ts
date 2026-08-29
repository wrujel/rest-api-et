import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { NavbarComponent } from './navbar.component';
import { click, query, queryAll, text } from '../../../testing/dom';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let component: NavbarComponent;
  let navigate: ReturnType<typeof vi.spyOn>;

  const isLoggedIn = signal(false);
  const userEmail = signal<string | null>(null);
  const initial = signal('?');
  const choice = signal<'light' | 'dark'>('light');

  const auth = { isLoggedIn, userEmail, initial, logout: vi.fn() };
  const theme = { choice, toggle: vi.fn() };

  const links = () =>
    queryAll<HTMLAnchorElement>(fixture, '.nav-link').map((a) =>
      a.textContent?.trim(),
    );

  beforeEach(() => {
    vi.clearAllMocks();
    isLoggedIn.set(false);
    userEmail.set(null);
    initial.set('?');
    choice.set('light');

    TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        // The real router stays in place: `routerLinkActive` resolves the
        // activated route through it, and a stub breaks that wiring.
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: auth },
        { provide: ThemeService, useValue: theme },
      ],
    });
    navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('offers sign in and register while signed out', () => {
    expect(links()).toEqual(['API Docs', 'Sign in', 'Register']);
    expect(query(fixture, '.user-chip')).toBeNull();
  });

  it('swaps in the products link and the account chip once signed in', () => {
    isLoggedIn.set(true);
    userEmail.set('ada@example.com');
    initial.set('A');
    fixture.detectChanges();

    expect(links()).toEqual(['API Docs', 'Products']);
    expect(text(fixture)).toContain('ada@example.com');
    expect(query(fixture, '.user-avatar')?.textContent).toBe('A');
  });

  describe('the theme toggle', () => {
    it('offers dark mode while the light theme is active', () => {
      expect(component.themeIcon()).toBe('dark_mode');
      expect(component.themeLabel()).toBe('Switch to dark theme');
    });

    it('offers light mode while the dark theme is active', () => {
      choice.set('dark');

      expect(component.themeIcon()).toBe('light_mode');
      expect(component.themeLabel()).toBe('Switch to light theme');
    });

    it('flips the theme when clicked', () => {
      click(fixture, '.theme-toggle');

      expect(theme.toggle).toHaveBeenCalledOnce();
    });
  });

  it('signs out and returns to the login page', () => {
    component.logout();

    expect(auth.logout).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
