// Stand-in for next/dynamic in the standalone artifact bundle: the
// selector only uses it for client-side lazy loading.
import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

export default function dynamic<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
  options?: { loading?: () => ReactNode; ssr?: boolean },
) {
  const Lazy = lazy(load);
  return function Dynamic(props: P) {
    return (
      <Suspense fallback={options?.loading?.() ?? null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
