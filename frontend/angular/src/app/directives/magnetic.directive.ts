import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { gsap } from 'gsap';

/**
 * Magnetic hover: the element gravitates toward the cursor while it is near,
 * then springs back with an elastic ease. No-op under reduced motion.
 */
@Directive({ selector: '[appMagnetic]' })
export class MagneticDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private removeListener: (() => void) | null = null;

  ngOnInit() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.zone.runOutsideAngular(() => {
      const el = this.el.nativeElement;
      let inside = false;

      const onMove = (e: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        const relX = e.clientX - (rect.left + rect.width / 2);
        const relY = e.clientY - (rect.top + rect.height / 2);
        const radius = Math.max(rect.width, rect.height) * 1.2;
        const near = Math.hypot(relX, relY) < radius;

        if (near) {
          inside = true;
          gsap.to(el, {
            x: relX * 0.3,
            y: relY * 0.3,
            duration: 0.4,
            ease: 'power3.out',
            overwrite: 'auto',
          });
        } else if (inside) {
          inside = false;
          gsap.to(el, {
            x: 0,
            y: 0,
            duration: 0.8,
            ease: 'elastic.out(1, 0.45)',
            overwrite: 'auto',
          });
        }
      };

      window.addEventListener('pointermove', onMove, { passive: true });
      this.removeListener = () => window.removeEventListener('pointermove', onMove);
    });
  }

  ngOnDestroy() {
    this.removeListener?.();
    gsap.killTweensOf(this.el.nativeElement);
  }
}
