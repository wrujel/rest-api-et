import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { gsap } from 'gsap';

import { CountUpDirective } from './count-up.directive';
import { stubReducedMotion } from '../../testing/motion';

@Component({
  imports: [CountUpDirective],
  template: `<span [appCountUp]="value()">0</span>`,
})
class HostComponent {
  readonly value = signal(0);
}

describe('CountUpDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let to: ReturnType<typeof vi.spyOn>;
  const kill = vi.fn();

  const span = () => fixture.nativeElement.querySelector('span') as HTMLElement;

  beforeEach(() => {
    kill.mockClear();
    to = vi.spyOn(gsap, 'to').mockReturnValue({ kill } as never);
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
  });

  it('tweens toward the target and renders each rounded frame', () => {
    stubReducedMotion(false);
    fixture.componentInstance.value.set(42);
    fixture.detectChanges();

    expect(to).toHaveBeenCalledOnce();
    const [state, vars] = to.mock.calls[0] as [
      { current: number },
      gsap.TweenVars,
    ];
    expect(vars['current']).toBe(42);

    // Drive the tween by hand: gsap would call onUpdate on each frame.
    state.current = 20.6;
    (vars['onUpdate'] as () => void)();
    expect(span().textContent).toBe('21');
  });

  it('kills the previous tween when the target changes again', () => {
    stubReducedMotion(false);
    fixture.componentInstance.value.set(10);
    fixture.detectChanges();

    fixture.componentInstance.value.set(20);
    fixture.detectChanges();

    expect(kill).toHaveBeenCalled();
    expect(to).toHaveBeenCalledTimes(2);
  });

  it('jumps straight to the number under reduced motion', () => {
    stubReducedMotion(true);
    fixture.componentInstance.value.set(7);
    fixture.detectChanges();

    expect(to).not.toHaveBeenCalled();
    expect(span().textContent).toBe('7');
  });

  it('kills the running tween on destroy', () => {
    stubReducedMotion(false);
    fixture.componentInstance.value.set(5);
    fixture.detectChanges();
    kill.mockClear();

    fixture.destroy();

    expect(kill).toHaveBeenCalledOnce();
  });

  it('has nothing to kill when reduced motion skipped the tween', () => {
    stubReducedMotion(true);
    fixture.detectChanges();

    expect(() => fixture.destroy()).not.toThrow();
  });
});
