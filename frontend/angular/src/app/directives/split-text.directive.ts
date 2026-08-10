import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { gsap } from 'gsap';

/**
 * Splits the host's text into per-character spans and staggers them in
 * with a 3D flip. Original text is preserved for screen readers via
 * `aria-label`. No-op under reduced motion.
 */
@Directive({ selector: '[appSplitText]' })
export class SplitTextDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private tween: gsap.core.Tween | null = null;

  ngOnInit() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.zone.runOutsideAngular(() => {
      const el = this.el.nativeElement;
      const text = el.textContent ?? '';
      if (!text.trim()) return;

      el.setAttribute('aria-label', text);
      el.textContent = '';

      const frag = document.createDocumentFragment();
      for (const char of text) {
        const span = document.createElement('span');
        span.className = 'split-char';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = char === ' ' ? ' ' : char;
        frag.appendChild(span);
      }
      el.appendChild(frag);

      this.tween = gsap.fromTo(
        el.querySelectorAll('.split-char'),
        { opacity: 0, y: '0.65em', rotationX: -80 },
        {
          opacity: 1,
          y: 0,
          rotationX: 0,
          duration: 0.65,
          stagger: 0.032,
          ease: 'back.out(1.9)',
          clearProps: 'all',
        },
      );
    });
  }

  ngOnDestroy() {
    this.tween?.kill();
  }
}
