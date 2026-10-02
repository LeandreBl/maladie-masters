import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PageHeading = { crumb: ReactNode; title: ReactNode };

const PageHeadingContext = createContext<{
  heading: PageHeading | null;
  setHeading: (heading: PageHeading | null) => void;
} | null>(null);

/**
 * Lets a screen name itself in the shell's header.
 *
 * The route knows a default ("Users"), but the trainer drill-down's title is
 * the trainer's name — which only the screen below has loaded. Publishing it
 * upward beats fetching the same record twice for the header.
 */
export function PageHeadingProvider({ children }: { children: ReactNode }) {
  const [heading, setHeading] = useState<PageHeading | null>(null);
  const value = useMemo(() => ({ heading, setHeading }), [heading]);

  return (
    <PageHeadingContext.Provider value={value}>
      {children}
    </PageHeadingContext.Provider>
  );
}

/** Read by the shell. Null means "use the route's default". */
export function usePageHeading(): PageHeading | null {
  return useContext(PageHeadingContext)?.heading ?? null;
}

/**
 * Set by a screen. Cleared on unmount, so navigating away falls back to the
 * route's own default rather than leaving a stale name in the header.
 */
export function useSetPageHeading(heading: PageHeading | null): void {
  const context = useContext(PageHeadingContext);
  const crumb = heading?.crumb;
  const title = heading?.title;

  useEffect(() => {
    if (!context) return;
    context.setHeading(heading ? { crumb, title } : null);
    return () => context.setHeading(null);
    // Compared by content: a new object every render would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crumb, title]);
}
