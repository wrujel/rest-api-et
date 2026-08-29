/**
 * Forces `window.matchMedia('(prefers-reduced-motion: reduce)')` to a known
 * answer. jsdom always reports `matches: false`, so the motion-off branch of
 * every animation directive is unreachable without this.
 *
 * The spy is undone by the global `afterEach` in `src/test-setup.ts`.
 */
export function stubReducedMotion(reduced: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion') ? reduced : false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}
