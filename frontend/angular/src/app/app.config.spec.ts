import { ActivatedRouteSnapshot } from '@angular/router';

import { appConfig, routePathOf, skipSamePageTransition } from './app.config';

/** Builds a snapshot chain: `leafPath` is what `routePathOf` should resolve. */
const snapshot = (...paths: (string | undefined)[]): ActivatedRouteSnapshot => {
  const nodes = paths.map(
    (path) =>
      ({
        routeConfig: path === undefined ? null : { path },
        firstChild: null as unknown,
      }) as unknown as ActivatedRouteSnapshot,
  );
  nodes.forEach((node, index) => {
    (node as { firstChild: unknown }).firstChild = nodes[index + 1] ?? null;
  });
  return nodes[0];
};

describe('routePathOf', () => {
  it('reads the path off a leaf node', () => {
    expect(routePathOf(snapshot('docs'))).toBe('docs');
  });

  it('walks down to the deepest child', () => {
    expect(routePathOf(snapshot('', 'admin', 'home'))).toBe('home');
  });

  it('reports an empty path when the leaf has no route config', () => {
    expect(routePathOf(snapshot(undefined))).toBe('');
  });
});

describe('skipSamePageTransition', () => {
  const run = (fromPath: string, toPath: string) => {
    const skipTransition = vi.fn();
    skipSamePageTransition!({
      transition: { skipTransition } as unknown as ViewTransition,
      from: snapshot(fromPath),
      to: snapshot(toPath),
    });
    return skipTransition;
  };

  it('skips the morph when the route path has not changed', () => {
    expect(run('docs', 'docs')).toHaveBeenCalledOnce();
  });

  it('lets the morph run when moving between routes', () => {
    expect(run('docs', 'home')).not.toHaveBeenCalled();
  });
});

describe('appConfig', () => {
  it('registers the application-wide providers', () => {
    expect(appConfig.providers.length).toBeGreaterThan(0);
  });
});
