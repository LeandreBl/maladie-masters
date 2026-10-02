import { useEffect, useMemo, useState } from "react";
import type { PackWallet } from "../api/types";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The server clock minus the local one, measured when the wallet arrives: a
 * wrong local clock must not skew the countdown. Computing it on every render
 * would drift by the time elapsed since the response.
 */
export function useServerOffset(serverTime: string | undefined): number {
  // Only a new response moves the offset.
  return useMemo(() => (serverTime ? new Date(serverTime).getTime() - Date.now() : 0), [serverTime]);
}

/** Milliseconds until the next pack, ticking every second; null when the stock is full. */
export function useTimeToNextPack(wallet: PackWallet): number | null {
  const offset = useServerOffset(wallet.serverTime);
  const [now, setNow] = useState(() => Date.now() + offset);

  useEffect(() => {
    setNow(Date.now() + offset);
    if (!wallet.nextPackAt) return;
    const timer = window.setInterval(() => setNow(Date.now() + offset), 1000);
    return () => window.clearInterval(timer);
  }, [offset, wallet.nextPackAt]);

  if (!wallet.nextPackAt) return null;
  return Math.max(0, new Date(wallet.nextPackAt).getTime() - now);
}
