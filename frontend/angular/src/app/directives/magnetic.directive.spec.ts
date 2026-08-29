import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { gsap } from 'gsap';

import { MagneticDirective } from './magnetic.directive';
import { stubReducedMotion } from '../../testing/motion';

@Component({
  imports: [MagneticDirective],
  template: `<button appMagnetic>Go</button>`,
})
class HostComponent {}

describe('MagneticDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let to: ReturnType<typeof vi.spyOn>;
  let killTweensOf: ReturnType<typeof vi.spyOn>;

  const button = () =>
    fixture.nativeElement.querySelector('button') as HTMLElement;

  /** The host is 100×100 at the origin, so its centre sits at (50, 50). */
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

  const movePointerTo = (clientX: number, clientY: number) =>
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX, clientY }) as PointerEvent,
    );

  beforeEach(() => {
    to = vi.spyOn(gsap, 'to').mockReturnValue({} as never);
    killTweensOf = vi.spyOn(gsap, 'killTweensOf').mockReturnValue(undefined);
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
  });

  it('pulls the element toward a nearby cursor', () => {
    stubReducedMotion(false);
    measureAsSquare();
    fixture.detectChanges();

    movePointerTo(80, 50);

    expect(to).toHaveBeenCalledOnce();
    const [target, vars] = to.mock.calls[0] as [HTMLElement, gsap.TweenVars];
    expect(target).toBe(button());
    // 30px right of centre, damped to 30%.
    expect(vars['x']).toBeCloseTo(9);
    expect(vars['y']).toBeCloseTo(0);
  });

  it('springs back once the cursor leaves the radius', () => {
    stubReducedMotion(false);
    measureAsSquare();
    fixture.detectChanges();

    movePointerTo(80, 50);
    movePointerTo(900, 900);

    expect(to).toHaveBeenCalledTimes(2);
    expect(to.mock.calls[1][1]).toMatchObject({ x: 0, y: 0 });
  });

  it('ignores a far cursor that was never near', () => {
    stubReducedMotion(false);
    measureAsSquare();
    fixture.detectChanges();

    movePointerTo(900, 900);

    expect(to).not.toHaveBeenCalled();
  });

  it('never listens under reduced motion', () => {
    stubReducedMotion(true);
    measureAsSquare();
    fixture.detectChanges();

    movePointerTo(80, 50);

    expect(to).not.toHaveBeenCalled();
  });

  it('stops listening and clears its tweens on destroy', () => {
    stubReducedMotion(false);
    measureAsSquare();
    fixture.detectChanges();
    const host = button();

    fixture.destroy();
    movePointerTo(80, 50);

    expect(to).not.toHaveBeenCalled();
    expect(killTweensOf).toHaveBeenCalledWith(host);
  });

  it('destroys cleanly when reduced motion left no listener', () => {
    stubReducedMotion(true);
    fixture.detectChanges();

    expect(() => fixture.destroy()).not.toThrow();
  });
});
