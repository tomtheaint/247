/**
 * What is running, and how long it has been, in the bottom corner.
 *
 * One question, asked constantly while working on a deployed app: *is my last
 * push live yet?* The deployed answer used to be "reload and squint at whether
 * the thing you changed changed", which is no answer when the change is subtle
 * and a plain wrong one when the browser is holding an old page.
 *
 * So: what the server is serving, and how long ago it was built. "2m ago" means
 * everything pushed before then is live. "3d ago" means the deploy has not
 * landed and there is no point testing.
 *
 * It also watches. Left open while a build runs, the stamp flips to the new
 * commit on its own and says the page in front of you is now the old one —
 * which is the moment you actually want to know, rather than after testing a
 * stale bundle for five minutes.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api/client";

interface Version {
  sha: string;
  builtAt: string | null;
}

/** Relative time, coarse on purpose: nobody needs the seconds. */
function since(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function VersionStamp() {
  const [current, setCurrent] = useState<Version | null>(null);
  const [stale, setStale] = useState(false);
  /** What the server said when this page loaded. Anything else is a new deploy. */
  const loaded = useRef<Version | null>(null);
  /** Re-render on a timer so the clock moves without refetching for it. */
  const [, tick] = useState(0);

  const check = useCallback(async () => {
    try {
      const { data } = await client.get<Version>("/version");
      if (!data || typeof data.sha !== "string") return;
      setCurrent(data);
      if (!loaded.current) loaded.current = data;
      // A different commit than the one this page was served by. The page is
      // now behind the server, whatever it looks like.
      else if (data.sha !== loaded.current.sha) setStale(true);
    } catch {
      /* offline, or the server is mid-restart — the last known stamp stands */
    }
  }, []);

  useEffect(() => {
    void check();
    // Two jobs on one timer: move the clock on, and notice a deploy. Half a
    // minute is often enough to catch a build landing and rare enough to be free.
    const timer = setInterval(() => {
      tick((n) => n + 1);
      void check();
    }, 30_000);
    // And whenever you come back to the tab. Pushing a build then switching
    // back is the exact sequence this is for, and waiting out the timer in that
    // moment is waiting for the one answer you came back to read.
    const onFocus = () => void check();
    const onVisible = () => { if (!document.hidden) void check(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  if (!current) return null;
  // A build with no timestamp is a dev server, and "dev dev" says nothing twice.
  const age = current.builtAt ? since(current.builtAt) : "";

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-1 right-2 z-40 flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-mono tabular-nums select-none ${
        stale
          ? "bg-amber-500/90 text-gray-900"
          : "text-gray-400/50 dark:text-gray-500/50 hover:text-gray-500 dark:hover:text-gray-300"
      }`}
    >
      <span>{current.sha}</span>
      {age && <span>{age}</span>}
      {stale && (
        <button
          type="button"
          onClick={() => location.reload()}
          title="A newer build is live — reload to get it"
          className="rounded bg-gray-900/20 px-1 font-semibold hover:bg-gray-900/30"
        >
          reload
        </button>
      )}
    </div>
  );
}
