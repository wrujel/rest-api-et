import { Component, PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { AppComponent } from './app.component';
import { query } from '../testing/dom';
import { stubReducedMotion } from '../testing/motion';

@Component({ template: '' })
class BlankComponent {}

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let router: Router;

  const configure = (platform: unknown = 'browser') => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([
          { path: 'docs', component: BlankComponent },
          { path: 'home', component: BlankComponent },
          { path: 'login', component: BlankComponent },
          { path: 'register', component: BlankComponent },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
    router = TestBed.inject(Router);
  };

  /** Builds the root component with the router already sitting on `url`. */
  const build = async (url = '/docs', platform: unknown = 'browser') => {
    configure(platform);
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
  };

  const goTo = async (url: string) => {
    await router.navigateByUrl(url);
    fixture.detectChanges();
  };

  const aurora = () => query(fixture, 'app-aurora-background');

  beforeEach(() => {
    // The navbar and the aurora both mount for real here; reduced motion keeps
    // their animation work out of the way.
    stubReducedMotion(true);
    document.body.className = '';
  });

  afterEach(() => {
    fixture?.destroy();
    document.body.className = '';
  });

  it('renders the navbar and the routed outlet', async () => {
    await build();

    expect(query(fixture, 'app-navbar')).toBeTruthy();
    expect(query(fixture, 'router-outlet')).toBeTruthy();
  });

  it('hides the aurora on non-auth pages', async () => {
    await build('/docs');

    expect(aurora()).toBeNull();
  });

  it('shows the aurora when the app starts on an auth page', async () => {
    await build('/login');

    expect(aurora()).toBeTruthy();
  });

  it('brings the aurora in when navigation lands on register', async () => {
    await build('/docs');

    await goTo('/register');

    expect(aurora()).toBeTruthy();
  });

  it('takes the aurora away again when navigation leaves the auth pages', async () => {
    await build('/login');

    await goTo('/home');

    expect(aurora()).toBeNull();
  });

  it('marks the body while the docs page is showing', async () => {
    await build('/docs');
    expect(document.body.classList.contains('docs-page')).toBe(true);

    await goTo('/home');
    expect(document.body.classList.contains('docs-page')).toBe(false);
  });

  it('stops tracking navigation once it is destroyed', async () => {
    await build('/docs');
    fixture.destroy();

    await router.navigateByUrl('/login');

    expect(document.body.classList.contains('docs-page')).toBe(true);
  });

  it('leaves the document alone off the browser platform', async () => {
    await build('/docs', 'server');

    expect(document.body.classList.contains('docs-page')).toBe(false);
  });
});
