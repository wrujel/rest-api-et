/**
 * Global test environment shims.
 *
 * The unit-test builder runs specs under jsdom, which stops short of several
 * browser APIs this app leans on: the motion query every animation directive
 * consults, the observers Angular Material wires up on layout, the async
 * clipboard the docs page copies through, and the Web Animations entry points
 * its ripples call. Each is filled in with the smallest stand-in that keeps
 * behaviour observable from a spec.
 *
 * The `matchMedia` stand-in answers "no" to every query, which is the quiet
 * default. Specs that need a particular answer re-spy on it — see
 * `src/testing/motion.ts`.
 */

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): [] {
    return [];
  }
}

globalThis.ResizeObserver ??= ObserverStub as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??=
  ObserverStub as unknown as typeof IntersectionObserver;

if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: { writeText: () => Promise.resolve() },
  });
}

Element.prototype.animate ??= (() =>
  ({
    cancel: () => undefined,
    finish: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }) as unknown as Animation) as typeof Element.prototype.animate;

Element.prototype.scrollIntoView ??= () => undefined;

// jsdom logs a loud "Not implemented" for every getContext call. The aurora
// background asks for WebGL and already handles a refusal, so answer null
// directly rather than filling the log with notices.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;

// NOTE: the test target sets `isolate: true` in angular.json, which the
// builder leaves off by default. Several directive specs spy on the shared
// `gsap` singleton; without a module registry per file those spies chain onto
// each other and their call counts merge across specs. Turning isolation off
// again will make those suites fail in whatever order CI happens to schedule.
//
// Specs reach for `vi.spyOn` on shared globals (localStorage, matchMedia, gsap).
// Restoring after every test keeps one spec's stub from leaking into the next;
// the unit-test builder does not enable `restoreMocks` on its own.
afterEach(() => {
  vi.restoreAllMocks();
});
