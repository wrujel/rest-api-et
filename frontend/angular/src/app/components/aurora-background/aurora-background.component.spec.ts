import { PLATFORM_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThemeService } from '../../services/theme.service';
import { stubReducedMotion } from '../../../testing/motion';

/**
 * jsdom has no WebGL, so `ogl` is replaced with the smallest set of objects the
 * component drives: a renderer that records `render`/`setSize`, and inert
 * geometry/program/mesh constructors. `glState` is what the specs assert on.
 */
const { glState } = vi.hoisted(() => ({
  glState: {
    constructed: 0,
    renders: 0,
    sizes: [] as [number, number][],
    lastOptions: null as Record<string, unknown> | null,
    loseContext: vi.fn(),
    failOnConstruct: false,
    canvasSize: { width: 800, height: 600 },
  },
}));

vi.mock('ogl', () => ({
  Renderer: class {
    gl: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      if (glState.failOnConstruct) throw new Error('no webgl');
      glState.constructed += 1;
      glState.lastOptions = options;
      this.gl = {
        canvas: glState.canvasSize,
        getExtension: (name: string) =>
          name === 'WEBGL_lose_context'
            ? { loseContext: glState.loseContext }
            : null,
      };
    }
    setSize(width: number, height: number) {
      glState.sizes.push([width, height]);
    }
    render() {
      glState.renders += 1;
    }
  },
  Program: class {},
  Mesh: class {},
  Triangle: class {},
}));

import { AuroraBackgroundComponent } from './aurora-background.component';

describe('AuroraBackgroundComponent', () => {
  let fixture: ComponentFixture<AuroraBackgroundComponent>;
  const choice = signal<'light' | 'dark'>('dark');

  /** Reaches the private render plumbing the rAF loop would otherwise drive. */
  const internals = () =>
    fixture.componentInstance as unknown as {
      uniforms: {
        uTime: { value: number };
        uIntensity: { value: number };
        uResolution: { value: [number, number] };
        uBase: { value: [number, number, number] };
        uColor1: { value: [number, number, number] };
      } | null;
      renderer: unknown;
      tick: (now: number) => void;
      resize: () => void;
      renderFrame: (time: number) => void;
      applyThemeColors: () => void;
      intensity: number;
    };

  const build = (platform: unknown = 'browser') => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AuroraBackgroundComponent],
      providers: [
        { provide: ThemeService, useValue: { choice } },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
    fixture = TestBed.createComponent(AuroraBackgroundComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    glState.constructed = 0;
    glState.renders = 0;
    glState.sizes = [];
    glState.lastOptions = null;
    glState.failOnConstruct = false;
    glState.canvasSize = { width: 800, height: 600 };
    choice.set('dark');
    stubReducedMotion(false);
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(window, 'cancelAnimationFrame').mockReturnValue(undefined);
  });

  // Every fixture must be torn down: an undestroyed one leaves its rAF loop
  // and window listeners attached for the next spec to trip over.
  afterEach(() => fixture?.destroy());

  it('renders a canvas for the shader to paint into', () => {
    build();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('canvas'),
    ).toBeTruthy();
  });

  it('does nothing at all off the browser platform', () => {
    build('server');

    expect(glState.constructed).toBe(0);
  });

  it('sets up the renderer against the host canvas and sizes it', () => {
    build();

    expect(glState.constructed).toBe(1);
    expect(glState.lastOptions).toMatchObject({
      antialias: false,
      depth: false,
      stencil: false,
    });
    expect(glState.sizes).toHaveLength(1);
    expect(internals().uniforms?.uResolution.value).toEqual([800, 600]);
  });

  it('caps the device pixel ratio so a retina screen cannot melt the GPU', () => {
    const original = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 3,
    });
    try {
      build();
      expect(glState.lastOptions?.['dpr']).toBe(1.5);
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        value: original,
      });
    }
  });

  it('falls back to a CSS gradient when the canvas is missing', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AuroraBackgroundComponent],
      providers: [
        { provide: ThemeService, useValue: { choice } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    TestBed.overrideTemplate(AuroraBackgroundComponent, '<span></span>');
    fixture = TestBed.createComponent(AuroraBackgroundComponent);

    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).classList.contains(
        'aurora--fallback',
      ),
    ).toBe(true);
    expect(glState.constructed).toBe(0);
  });

  it('treats a missing devicePixelRatio as 1', () => {
    const original = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 0,
    });
    try {
      build();
      expect(glState.lastOptions?.['dpr']).toBe(1);
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        value: original,
      });
    }
  });

  describe('before the renderer exists', () => {
    beforeEach(() => build('server'));

    it('skips a resize', () => {
      expect(() => internals().resize()).not.toThrow();
      expect(glState.sizes).toHaveLength(0);
    });

    it('skips a frame', () => {
      expect(() => internals().renderFrame(0)).not.toThrow();
      expect(glState.renders).toBe(0);
    });

    it('skips re-reading the theme colours', () => {
      const getComputedStyle = vi.spyOn(window, 'getComputedStyle');

      internals().applyThemeColors();

      expect(getComputedStyle).not.toHaveBeenCalled();
    });
  });

  it('falls back to a CSS gradient when WebGL is unavailable', () => {
    glState.failOnConstruct = true;

    build();

    expect(
      (fixture.nativeElement as HTMLElement).classList.contains(
        'aurora--fallback',
      ),
    ).toBe(true);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  describe('the animation loop', () => {
    it('schedules a frame once the renderer is ready', () => {
      build();

      // rAF is stubbed, so nothing has painted yet — the loop is merely armed.
      expect(window.requestAnimationFrame).toHaveBeenCalledWith(
        expect.any(Function),
      );
      expect(glState.renders).toBe(0);
    });

    it('advances the shader clock on each frame', () => {
      build();

      internals().tick(performance.now() + 1000);

      expect(glState.renders).toBe(1);
      expect(internals().uniforms?.uTime.value).toBeGreaterThan(0.9);
    });

    it('stops rendering once the host is destroyed', () => {
      build();
      fixture.destroy();
      const after = glState.renders;

      internals().tick(2000);

      expect(glState.renders).toBe(after);
    });

    it('pauses on a hidden tab and resumes when it comes back', () => {
      build();
      const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

      document.dispatchEvent(new Event('visibilitychange'));
      expect(window.cancelAnimationFrame).toHaveBeenCalled();

      hidden.mockReturnValue(false);
      const before = vi.mocked(window.requestAnimationFrame).mock.calls.length;
      document.dispatchEvent(new Event('visibilitychange'));
      expect(
        vi.mocked(window.requestAnimationFrame).mock.calls.length,
      ).toBeGreaterThan(before);
    });

    it('re-sizes on a window resize', () => {
      build();
      const before = glState.sizes.length;

      window.dispatchEvent(new Event('resize'));

      expect(glState.sizes.length).toBe(before + 1);
    });

    it('drops both window listeners on destroy', () => {
      build();
      fixture.destroy();
      const sizes = glState.sizes.length;

      window.dispatchEvent(new Event('resize'));
      document.dispatchEvent(new Event('visibilitychange'));

      expect(glState.sizes.length).toBe(sizes);
    });

    it('releases the GL context on destroy', () => {
      build();

      fixture.destroy();

      expect(glState.loseContext).toHaveBeenCalledOnce();
    });
  });

  describe('under reduced motion', () => {
    it('paints a single static frame and never starts the loop', () => {
      stubReducedMotion(true);

      build();

      expect(glState.renders).toBe(1);
      expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    });

    it('re-paints that frame when the theme changes', () => {
      stubReducedMotion(true);
      build();

      choice.set('light');
      TestBed.tick();

      expect(glState.renders).toBe(2);
    });
  });

  it('eases the intensity down when the theme turns light', () => {
    const start = performance.now();
    build();
    internals().tick(start);
    const dark = internals().uniforms!.uIntensity.value;

    choice.set('light');
    TestBed.tick();
    for (let frame = 1; frame <= 200; frame += 1) {
      internals().tick(start + frame * 16);
    }

    expect(internals().uniforms!.uIntensity.value).toBeLessThan(dark);
  });

  describe('theme colour probing', () => {
    /**
     * The probe is a hidden div carrying `color: var(--token)`. Only that
     * element gets the canned answer — everything else (Angular's own layout
     * reads included) still goes through the real implementation.
     */
    const withComputedColor = (color: string) => {
      const real = window.getComputedStyle.bind(window);
      vi.spyOn(window, 'getComputedStyle').mockImplementation(
        (element: Element, pseudo?: string | null) => {
          const probe = element as HTMLElement;
          if (
            probe.style?.display === 'none' &&
            probe.style.color.startsWith('var(')
          ) {
            return { color } as CSSStyleDeclaration;
          }
          return real(element, pseudo ?? undefined);
        },
      );
    };

    /** Colours are only re-read on a render, which the rAF stub suppresses. */
    const baseAfterProbe = (color: string) => {
      withComputedColor(color);
      build();
      internals().tick(0);
      return internals().uniforms!.uBase.value;
    };

    it('reads an rgb() token', () => {
      expect(baseAfterProbe('rgb(255, 128, 0)')).toEqual([1, 128 / 255, 0]);
    });

    it('reads an rgba() token', () => {
      expect(baseAfterProbe('rgba(0, 0, 255, 0.5)')).toEqual([0, 0, 1]);
    });

    it('reads a color(srgb ...) token', () => {
      expect(baseAfterProbe('color(srgb 0.25 0.5 0.75)')).toEqual([
        0.25, 0.5, 0.75,
      ]);
    });

    it('reads a six-digit hex token', () => {
      expect(baseAfterProbe('#ff8000')).toEqual([1, 128 / 255, 0]);
    });

    it('expands a three-digit hex token', () => {
      expect(baseAfterProbe('#f80')).toEqual([1, 136 / 255, 0]);
    });

    it('ignores the alpha channel of an eight-digit hex token', () => {
      expect(baseAfterProbe('#ff800080')).toEqual([1, 128 / 255, 0]);
    });

    it('keeps the fallback colour for anything it cannot parse', () => {
      expect(baseAfterProbe('rebeccapurple')).toEqual([0.06, 0.06, 0.1]);
    });

    it('re-reads the colours only once per theme change', () => {
      withComputedColor('rgb(255, 0, 0)');
      build();
      internals().tick(0);
      expect(internals().uniforms!.uColor1.value).toEqual([1, 0, 0]);

      withComputedColor('rgb(0, 255, 0)');
      internals().tick(16);
      expect(internals().uniforms!.uColor1.value).toEqual([1, 0, 0]);

      choice.set('light');
      TestBed.tick();
      internals().tick(32);
      expect(internals().uniforms!.uColor1.value).toEqual([0, 1, 0]);
    });

    it('leaves no probe elements behind in the document', () => {
      withComputedColor('rgb(1, 2, 3)');
      build();
      internals().tick(0);

      expect(
        document.querySelectorAll('div[style*="display: none"]'),
      ).toHaveLength(0);
    });
  });
});
