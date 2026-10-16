import { useCallback, useEffect, useState } from "react";

/** Loads data once and again on `reload()`; `{ data, error, loading }`. */
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then(
      (data) => live && setState({ data, error: "", loading: false }),
      (e) => live && setState({ data: null, error: e.message, loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  const reload = useCallback(() => setN((v) => v + 1), []);
  return { ...state, reload };
}
