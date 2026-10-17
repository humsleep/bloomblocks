// A lazily loaded module (or any one-time async value) that is cached once it SUCCEEDS. A failed
// load (e.g. a dynamic import that hit a flaky moment) is forgotten, so the next call tries again
// instead of replaying the same rejection forever.
export function lazyRetry<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => {
    p ??= load().catch((e: unknown) => {
      p = null;
      throw e;
    });
    return p;
  };
}
