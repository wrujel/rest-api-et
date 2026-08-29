import { vi } from "vitest";

/**
 * Stands in for a Mongoose query: the callers under test either `await` it
 * directly or chain `.select(...)` first, so the double has to support both.
 */
export const queryDouble = <T>(result: T) => {
  const query = Promise.resolve(result) as Promise<T> & {
    select: ReturnType<typeof vi.fn>;
  };
  query.select = vi.fn(() => Promise.resolve(result));
  return query;
};

/** A query whose `await` rejects — used to drive the `catch` arms. */
export const failingQuery = (error: Error) => {
  const query = Promise.reject(error) as Promise<never> & {
    select: ReturnType<typeof vi.fn>;
  };
  // Attaching a no-op handler keeps Node from flagging an unhandled rejection
  // in the specs that only reach this query through `.select()`.
  query.catch(() => undefined);
  query.select = vi.fn(() => {
    const selected = Promise.reject(error);
    selected.catch(() => undefined);
    return selected;
  });
  return query;
};
