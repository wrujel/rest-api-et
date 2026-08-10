import { Directive, ElementRef, NgZone, OnDestroy, effect, inject, input } from '@angular/core';
import { gsap } from 'gsap';

/**
 * Animated counter: tweens the element's text content toward `[appCountUp]`
 * whenever the input changes. Jumps instantly under reduced motion.
 */
@Directive({ selector: '[appCountUp]' })
export class CountUpDirective implements OnDestroy {
  readonly value = input(0, { alias: 'appCountUp' });

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly state = { current: 0 };
  private tween: gsap.core.Tween | null = null;

  constructor() {
    effect(() => {
      const target = this.value();
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        this.state.current = target;
        this.render(target);
        return;
      }
      this.zone.runOutsideAngular(() => {
        this.tween?.kill();
        this.tween = gsap.to(this.state, {
          current: target,
          duration: 0.7,
          ease: 'power2.out',
          onUpdate: () => this.render(Math.round(this.state.current)),
        });
      });
    });
  }

  ngOnDestroy() {
    this.tween?.kill();
  }

  private render(n: number) {
    this.el.nativeElement.textContent = String(n);
  }
}
