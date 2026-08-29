import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { gsap } from 'gsap';

import { SplitTextDirective } from './split-text.directive';
import { stubReducedMotion } from '../../testing/motion';

// The directive reads `textContent` in `ngOnInit`, so the host templates keep
// the text static rather than interpolated — an interpolation has not been
// written into the DOM yet at that point.
@Component({
  imports: [SplitTextDirective],
  template: `<h1 appSplitText>Hi there</h1>`,
})
class HostComponent {}

@Component({
  imports: [SplitTextDirective],
  template: `<h1 appSplitText>&nbsp;</h1>`,
})
class BlankHostComponent {}

describe('SplitTextDirective', () => {
  let fromTo: ReturnType<typeof vi.spyOn>;
  const kill = vi.fn();

  const heading = (fixture: ComponentFixture<unknown>) =>
    fixture.nativeElement.querySelector('h1') as HTMLElement;

  const render = <T>(type: new () => T) => {
    const fixture = TestBed.createComponent(type);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    kill.mockClear();
    fromTo = vi.spyOn(gsap, 'fromTo').mockReturnValue({ kill } as never);
    TestBed.configureTestingModule({
      imports: [HostComponent, BlankHostComponent],
    });
  });

  it('replaces the text with one span per character and staggers them in', () => {
    stubReducedMotion(false);
    const fixture = render(HostComponent);

    const chars = heading(fixture).querySelectorAll('.split-char');
    expect(chars).toHaveLength('Hi there'.length);
    expect(chars[0].textContent).toBe('H');
    expect(fromTo).toHaveBeenCalledOnce();
    expect((fromTo.mock.calls[0][2] as gsap.TweenVars)['stagger']).toBe(0.032);
  });

  it('keeps the original text available to screen readers', () => {
    stubReducedMotion(false);
    const fixture = render(HostComponent);

    expect(heading(fixture).getAttribute('aria-label')).toBe('Hi there');
    expect(
      heading(fixture)
        .querySelector('.split-char')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('renders a space as a non-breaking space so it keeps its box', () => {
    stubReducedMotion(false);
    const fixture = render(HostComponent);

    const chars = Array.from(heading(fixture).querySelectorAll('.split-char'));
    expect(chars[2].textContent).toBe(' ');
  });

  it('leaves an element with no text content alone', () => {
    stubReducedMotion(false);
    const fixture = TestBed.createComponent(HostComponent);
    // `Node.textContent` is typed nullable; stub it before `ngOnInit` reads it.
    Object.defineProperty(heading(fixture), 'textContent', {
      configurable: true,
      get: () => null,
    });

    fixture.detectChanges();

    expect(fromTo).not.toHaveBeenCalled();
  });

  it('leaves whitespace-only content alone', () => {
    stubReducedMotion(false);
    const fixture = render(BlankHostComponent);

    expect(heading(fixture).querySelectorAll('.split-char')).toHaveLength(0);
    expect(fromTo).not.toHaveBeenCalled();
  });

  it('leaves the text untouched under reduced motion', () => {
    stubReducedMotion(true);
    const fixture = render(HostComponent);

    expect(heading(fixture).textContent).toBe('Hi there');
    expect(fromTo).not.toHaveBeenCalled();
  });

  it('kills the tween on destroy', () => {
    stubReducedMotion(false);
    const fixture = render(HostComponent);

    fixture.destroy();

    expect(kill).toHaveBeenCalledOnce();
  });
});
