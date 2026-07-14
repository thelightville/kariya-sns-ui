"use client";

import { useEffect, useState } from "react";
import { KsnsClientError } from "@/lib/ksnsPlatformClient";

type QueryState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "error"; data: null; error: string }
  | { status: "success"; data: T; error: null };

// Small shared helper so every page fetches K-SNS data the same
// fail-closed way: loading -> success | error. Never falls back to
// fabricated/mock data on failure — pages render EmptyState instead.
export function useKsnsQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<QueryState<T>>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    // Dependency changes intentionally re-enter the explicit loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading", data: null, error: null });

    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: "success", data, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof KsnsClientError
            ? err.message
            : "Unable to reach the K-SNS API.";
        setState({ status: "error", data: null, error: message });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
