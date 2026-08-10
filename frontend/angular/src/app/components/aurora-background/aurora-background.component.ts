import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { ThemeService } from '../../services/theme.service';

const VERTEX = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec3 uBase;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uIntensity;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
    float t = uTime * 0.05;

    // Slow domain-warped fbm — a calm, ambient gradient drift.
    vec2 q = vec2(
      fbm(p * 1.3 + t),
      fbm(p * 1.3 + vec2(5.2, 1.3) - t)
    );
    vec2 r = vec2(
      fbm(p * 1.3 + 2.0 * q + vec2(1.7, 9.2) + 0.12 * t),
      fbm(p * 1.3 + 2.0 * q + vec2(8.3, 2.8) - 0.08 * t)
    );
    float f = fbm(p * 1.3 + 2.2 * r);

    // Muted color washes keep the surface professional and readable.
    float band = smoothstep(0.3, 0.75, f);
    vec3 col = uBase;
    col = mix(col, uColor1, band * 0.38 * uIntensity);
    col = mix(col, uColor2, smoothstep(0.4, 0.9, q.x) * 0.22 * uIntensity);
    col = mix(col, uColor3, smoothstep(0.35, 0.85, r.y) * 0.18 * uIntensity);

    // Vignette keeps the edges quiet so foreground content stays readable.
    float vig = smoothstep(1.25, 0.4, length(p));
    col = mix(uBase, col, vig);

    gl_FragColor = vec4(col, 1.0);
  }
`;

type Vec3 = [number, number, number];
type Uniforms = {
  uTime: { value: number };
  uResolution: { value: [number, number] };
  uBase: { value: Vec3 };
  uColor1: { value: Vec3 };
  uColor2: { value: Vec3 };
  uColor3: { value: Vec3 };
  uIntensity: { value: number };
};

const FALLBACK_COLORS: Record<'base' | 'c1' | 'c2' | 'c3', Vec3> = {
  base: [0.06, 0.06, 0.1],
  c1: [0.36, 0.42, 0.95],
  c2: [0.1, 0.75, 0.85],
  c3: [0.25, 0.85, 0.6],
};

@Component({
  selector: 'app-aurora-background',
  templateUrl: './aurora-background.component.html',
  styleUrl: './aurora-background.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuroraBackgroundComponent implements AfterViewInit {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly theme = inject(ThemeService);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  private renderer: Renderer | null = null;
  private uniforms: Uniforms | null = null;
  private mesh: Mesh | null = null;
  private rafId = 0;
  private start = 0;
  private intensity = 0.65;
  private colorsDirty = true;
  private reducedMotion = false;
  private disposed = false;

  constructor() {
    // Re-tint the shader whenever the theme flips; the rAF loop picks it up
    // on the next frame (or the static fallback re-renders once).
    effect(() => {
      this.theme.choice();
      this.colorsDirty = true;
      if (this.reducedMotion) this.renderFrame(12);
    });
  }

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    try {
      this.initGl();
    } catch {
      this.host.nativeElement.classList.add('aurora--fallback');
      return;
    }

    if (this.reducedMotion) {
      this.renderFrame(12);
      return;
    }

    this.zone.runOutsideAngular(() => {
      const onResize = () => this.resize();
      const onVisibility = () => {
        if (document.hidden) {
          cancelAnimationFrame(this.rafId);
        } else {
          this.rafId = requestAnimationFrame(this.tick);
        }
      };

      window.addEventListener('resize', onResize, { passive: true });
      document.addEventListener('visibilitychange', onVisibility);

      this.destroyRef.onDestroy(() => {
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibility);
      });

      this.start = performance.now();
      this.rafId = requestAnimationFrame(this.tick);
    });

    this.destroyRef.onDestroy(() => {
      this.disposed = true;
      cancelAnimationFrame(this.rafId);
      const gl = this.renderer?.gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    });
  }

  private initGl() {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) throw new Error('canvas missing');

    this.renderer = new Renderer({
      canvas,
      dpr: Math.min(window.devicePixelRatio || 1, 1.5),
      antialias: false,
      depth: false,
      stencil: false,
    });
    const gl = this.renderer.gl;

    this.uniforms = {
      uTime: { value: 0 },
      uResolution: { value: [1, 1] },
      uBase: { value: [...FALLBACK_COLORS.base] },
      uColor1: { value: [...FALLBACK_COLORS.c1] },
      uColor2: { value: [...FALLBACK_COLORS.c2] },
      uColor3: { value: [...FALLBACK_COLORS.c3] },
      uIntensity: { value: 0.65 },
    };

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms: this.uniforms,
    });
    this.mesh = new Mesh(gl, { geometry, program });
    this.resize();
  }

  private readonly tick = (now: number) => {
    if (this.disposed) return;
    const t = (now - this.start) / 1000;

    this.intensity += (this.effectiveIntensityTarget() - this.intensity) * 0.04;

    this.renderFrame(t);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private renderFrame(time: number) {
    if (!this.renderer || !this.uniforms || !this.mesh) return;
    if (this.colorsDirty) {
      this.applyThemeColors();
      this.colorsDirty = false;
    }
    this.uniforms.uTime.value = time;
    this.uniforms.uIntensity.value = this.reducedMotion
      ? this.effectiveIntensityTarget()
      : this.intensity;
    this.renderer.render({ scene: this.mesh });
  }

  private resize() {
    if (!this.renderer || !this.uniforms) return;
    const el = this.host.nativeElement;
    this.renderer.setSize(el.clientWidth, el.clientHeight);
    const gl = this.renderer.gl;
    this.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height];
  }

  /** Light themes wash colors out fast, so they run dimmer. */
  private effectiveIntensityTarget(): number {
    return 0.65 * (this.theme.choice() === 'light' ? 0.65 : 1);
  }

  private applyThemeColors() {
    if (!this.uniforms) return;
    this.uniforms.uBase.value = probeTokenColor('--mat-sys-surface', FALLBACK_COLORS.base);
    this.uniforms.uColor1.value = probeTokenColor('--mat-sys-primary', FALLBACK_COLORS.c1);
    this.uniforms.uColor2.value = probeTokenColor('--mat-sys-tertiary', FALLBACK_COLORS.c2);
    this.uniforms.uColor3.value = probeTokenColor('--mat-sys-secondary', FALLBACK_COLORS.c3);
  }
}

/**
 * Reads a CSS custom property as a *used* color. `getComputedStyle` on the
 * custom property itself returns the raw token stream (`light-dark(...)`,
 * `color-mix(...)`), so we probe through a real element's `color` instead.
 */
function probeTokenColor(token: string, fallback: Vec3): Vec3 {
  const probe = document.createElement('div');
  probe.style.display = 'none';
  probe.style.color = `var(${token})`;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return cssColor(resolved, fallback);
}

function cssColor(raw: string, fallback: Vec3): Vec3 {
  const value = raw.trim();

  // rgb() / rgba()
  const rgb = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgb) return [+rgb[1] / 255, +rgb[2] / 255, +rgb[3] / 255];

  // color(srgb r g b) — resolved oklch/light-dark() values land here.
  const fn = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (fn) return [+fn[1], +fn[2], +fn[3]];

  // #rgb / #rrggbb / #rrggbbaa
  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) {
      h = h.split('').map((c) => c + c).join('');
    }
    const n = parseInt(h.slice(0, 6), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  return [...fallback];
}
