import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { gsap } from 'gsap';

import { TiltDirective } from './tilt.directive';
import { stubReducedMotion } from '../../testing/motion';

@Component({
  imports: [TiltDirective],
  template: `<div [appTilt]="max">card</div>`,
})
class HostComponent {
  max = 6;
}

describe('TiltDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let to: ReturnType<typeof vi.spyOn>;
  let killTweensOf: ReturnType<typeof vi.spyOn>;

  const card = () => fixture.nativeElement.querySelector('div') as HTMLElement;

  const measureAsSquare = () =>
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

  const pointer = (type: string, clientX = 0, clientY = 0) =>
    card().dispatchEvent(
      new MouseEvent(type, { clientX, clientY }) as PointerEvent,
    );

  beforeEach(() => {
    to = vi.spyOn(gsap, 'to').mockReturnValue({} as never);
    killTweensOf = vi.spyOn(gsap, 'killTweensOf').mockReturnValue(undefined);
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
  });

  it('tilts toward the cursor and publishes the glare position', () => {
    stubReducedMotion(false);
    measureAsSquare();
    fixture.detectChanges();

    pointer('pointermove', 100, 100);

    expect(card().style.getPropertyValue('--glare-x')).toBe('100%');
    expect(card().style.getPropertyValue('--glare-y')).toBe('100%');
    const vars = to.mock.calls[0][1] as gsap.TweenVars;
    // Bottom-right corner: full positive yaw, full negative pitch.
    expect(vars['rotationY']).toBeCloseTo(6);
    expect(vars['rotationX']).toBeCloseTo(-6);
  });

  it('scales the tilt with the configured maximum', () => {
    stubReducedMotion(false);
    measureAsSquare();
    fixture.componentInstance.max = 12;
    fixture.detectChanges();

    pointer('pointermove', 100, 50);

    expect((to.mock.calls[0][1] as gsap.TweenVars)['rotationY']).toBeCloseTo(
      12,
    );
  });

  it('levels out when the cursor leaves', () => {
    stubReducedMotion(false);
    measureAsSquare();
    fixture.detectChanges();

    pointer('pointerleave');

    expect(to.mock.calls[0][1]).toMatchObject({ rotationX: 0, rotationY: 0 });
  });

  it('never listens under reduced motion', () => {
    stubReducedMotion(true);
    measureAsSquare();
    fixture.detectChanges();

    pointer('pointermove', 100, 0);
    pointer('pointerleave');

    expect(to).not.toHaveBeenCalled();
  });

  it('unbinds both listeners and clears its tweens on destroy', () => {
    stubReducedMotion(false);
    measureAsSquare();
    fixture.detectChanges();
    const host = card();

    fixture.destroy();
    host.dispatchEvent(new MouseEvent('pointermove') as PointerEvent);
    host.dispatchEvent(new MouseEvent('pointerleave') as PointerEvent);

    expect(to).not.toHaveBeenCalled();
    expect(killTweensOf).toHaveBeenCalledWith(host);
  });
});
