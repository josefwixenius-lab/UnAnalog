import { useCallback, useRef, useState } from 'react';

/**
 * Undo/redo-hook för en valfri tillståndstyp.
 *
 * Designval:
 * - Vi debouncar inte pushar här; i stället ansvarar kallaren för att inte
 *   pusha i onda-cirkel-loopar. För sliders debouncas själva statechangen
 *   i UI-komponenterna; vi sparar bara när bank uppdateras via `set()`.
 * - Max 60 steg historik räcker mer än väl för en session.
 * - `initial` används bara första renderingen (useRef).
 * - `canUndo` / `canRedo` härleds från stackarnas längd så UI kan grey:a
 *   knappar.
 */
export function useUndoable<T>(initial: T | (() => T), max = 60) {
  const [state, setState] = useState<T>(
    typeof initial === 'function' ? (initial as () => T) : initial,
  );
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  // Force-update trigger för canUndo/canRedo (kurerar osynliga ref-ändringar)
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((x) => x + 1), []);

  const set = useCallback(
    (next: T | ((cur: T) => T)) => {
      setState((cur) => {
        const n = typeof next === 'function' ? (next as (c: T) => T)(cur) : next;
        if (n === cur) return cur;
        pastRef.current.push(cur);
        if (pastRef.current.length > max) pastRef.current.shift();
        futureRef.current = [];
        return n;
      });
      bump();
    },
    [max, bump],
  );

  /** Byt ut state utan att röra undo-historiken (för migration, localStorage-load). */
  const replace = useCallback(
    (next: T) => {
      setState(next);
      pastRef.current = [];
      futureRef.current = [];
      bump();
    },
    [bump],
  );

  /**
   * Ändra state UTAN att röra historiken (varken clear eller push).
   * Användbart för händelser som ska grupperas till en enda undo-operation,
   * t.ex. loop-record som skriver många små uppdateringar men vi vill bara
   * kunna undo:a hela inspelningen som ett block. Använd tillsammans med
   * `pushSnapshot` för att manuellt lägga till en pre-change-snapshot i
   * undo-historiken när operationen är klar.
   */
  const silent = useCallback(
    (next: T | ((cur: T) => T)) => {
      setState((cur) => {
        const n = typeof next === 'function' ? (next as (c: T) => T)(cur) : next;
        return n === cur ? cur : n;
      });
      bump();
    },
    [bump],
  );

  /** Lägg manuellt till en snapshot i undo-historiken (utan att ändra state). */
  const pushSnapshot = useCallback(
    (snapshot: T) => {
      pastRef.current.push(snapshot);
      if (pastRef.current.length > max) pastRef.current.shift();
      futureRef.current = [];
      bump();
    },
    [max, bump],
  );

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    setState((cur) => {
      const prev = pastRef.current.pop()!;
      futureRef.current.push(cur);
      if (futureRef.current.length > max) futureRef.current.shift();
      return prev;
    });
    bump();
  }, [max, bump]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    setState((cur) => {
      const next = futureRef.current.pop()!;
      pastRef.current.push(cur);
      if (pastRef.current.length > max) pastRef.current.shift();
      return next;
    });
    bump();
  }, [max, bump]);

  return {
    state,
    set,
    replace,
    silent,
    pushSnapshot,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
