import { useMemo, useSyncExternalStore } from 'react';
import type { ExternalStore } from '../../contracts/session';

export function useJamSelector<State, Selection>(store: ExternalStore<State>, selector: (snapshot: State) => Selection,
  equal: (previous: Selection, next: Selection) => boolean = Object.is): Selection {
  const subscribe = useMemo(() => (listener: () => void) => store.subscribe(listener), [store]);
  const readSelection = useMemo(() => {
    let selection = selector(store.getSnapshot());
    return () => {
      const next = selector(store.getSnapshot());
      if (!equal(selection, next)) selection = next;
      return selection;
    };
  }, [store, selector, equal]);
  return useSyncExternalStore(subscribe, readSelection, readSelection);
}
