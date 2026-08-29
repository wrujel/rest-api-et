import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { gsap } from 'gsap';

import { RevealDirective } from './reveal.directive';
import { stubReducedMotion } from '../../testing/motion';

@Component({
  imports: [RevealDirective],
  template: `<p appReveal [appRevealDelay]="delay">Hello</p>`,
})
class HostComponent {
  delay = 0;
}

describe('RevealDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let fromTo: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fromTo = vi.spyOn(gsap, 'fromTo').mockReturnValue({
      kill: vi.fn(),
    } as never);
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
  });

  it('fades, rises and de-blurs the element on mount', () => {
    stubReducedMotion(false);
    fixture.detectChanges();

    expect(fromTo).toHaveBeenCalledOnce();
    const [target, from, to] = fromTo.mock.calls[0] as [
      HTMLElement,
      gsap.TweenVars,
      gsap.TweenVars,
    ];
    expect(target.textContent).toBe('Hello');
    expect(from).toMatchObject({ opacity: 0, y: 26 });
    expect(to).toMatchObject({ opacity: 1, y: 0, delay: 0 });
  });

  it('converts the delay input from milliseconds to seconds', () => {
    stubReducedMotion(false);
    fixture.componentInstance.delay = 250;
    fixture.detectChanges();

    expect((fromTo.mock.calls[0][2] as gsap.TweenVars).delay).toBe(0.25);
  });

  it('does nothing under reduced motion', () => {
    stubReducedMotion(true);
    fixture.detectChanges();

    expect(fromTo).not.toHaveBeenCalled();
  });

  it('kills the tween when the host goes away', () => {
    stubReducedMotion(false);
    fixture.detectChanges();
    const kill = (fromTo.mock.results[0].value as { kill: () => void }).kill;

    fixture.destroy();

    expect(kill).toHaveBeenCalledOnce();
  });

  it('has no tween to kill when reduced motion skipped the animation', () => {
    stubReducedMotion(true);
    fixture.detectChanges();

    expect(() => fixture.destroy()).not.toThrow();
  });
});
