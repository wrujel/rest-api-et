import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input, numberAttribute } from '@angular/core';
import { gsap } from 'gsap';

/**
 * Mount reveal: fade + rise + de-blur, with optional stagger delay
 * (`[appRevealDelay]` in ms). No-op under reduced motion.
 */
@Directive({ selector: '[appReveal]' })
export class RevealDirective implements OnInit, OnDestroy {
  readonly delay = input(0, { alias: 'appRevealDelay', transform: numberAttribute });

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private tween: gsap.core.Tween | null = null;

  ngOnInit() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.zone.runOutsideAngular(() => {
      this.tween = gsap.fromTo(
        this.el.nativeElement,
        { opacity: 0, y: 26, filter: 'blur(10px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.9,
          delay: this.delay() / 1000,
          ease: 'power3.out',
          clearProps: 'opacity,transform,filter',
        },
      );
    });
  }

  ngOnDestroy() {
    this.tween?.kill();
  }
}
