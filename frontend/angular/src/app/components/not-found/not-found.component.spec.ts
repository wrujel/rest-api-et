import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { NotFoundComponent } from './not-found.component';
import { query, text } from '../../../testing/dom';

describe('NotFoundComponent', () => {
  it('explains the miss and offers a way back to the docs', () => {
    TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [provideRouter([]), provideNoopAnimations()],
    });

    const fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();

    expect(text(fixture)).toContain('404');
    expect(query(fixture, 'a[href]')?.getAttribute('href')).toBe('/docs');
  });
});
