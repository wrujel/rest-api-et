import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input, numberAttribute } from '@angular/core';
import { gsap } from 'gsap';

/**
 * Perspective tilt following the cursor, with a CSS-var glare position
 * (`--glare-x` / `--glare-y`) the host stylesheet can use for a highlight.
 * No-op under reduced motion.
 */
@Directive({ selector: '[appTilt]' })
export class TiltDirective implements OnInit, OnDestroy {
  readonly maxTilt = input(6, { alias: 'appTilt', transform: numberAttribute });

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private removers: (() => void)[] = [];

  ngOnInit() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.zone.runOutsideAngular(() => {
      const el = this.el.nativeElement;
      const max = this.maxTilt();

      const onMove = (e: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        el.style.setProperty('--glare-x', `${px * 100}%`);
        el.style.setProperty('--glare-y', `${py * 100}%`);
        gsap.to(el, {
          rotationY: (px - 0.5) * 2 * max,
          rotationX: (0.5 - py) * 2 * max,
          transformPerspective: 900,
          duration: 0.5,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      };

      const onLeave = () => {
        gsap.to(el, {
          rotationX: 0,
          rotationY: 0,
          duration: 0.9,
          ease: 'elastic.out(1, 0.5)',
          overwrite: 'auto',
        });
      };

      el.addEventListener('pointermove', onMove, { passive: true });
      el.addEventListener('pointerleave', onLeave, { passive: true });
      this.removers = [
        () => el.removeEventListener('pointermove', onMove),
        () => el.removeEventListener('pointerleave', onLeave),
      ];
    });
  }

  ngOnDestroy() {
    this.removers.forEach((fn) => fn());
    gsap.killTweensOf(this.el.nativeElement);
  }
}
