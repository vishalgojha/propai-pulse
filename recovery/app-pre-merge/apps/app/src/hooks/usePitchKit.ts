import * as React from 'react';
import type { StreamItem } from '../services/streamAPI';

const STORAGE_KEY = 'propai_pitch_kit';
const MAX_PITCH_LISTINGS = 10;

type PitchKitState = {
  selected: StreamItem[];
  notice: string | null;
};

type Listener = () => void;

const listeners = new Set<Listener>();

let state: PitchKitState = {
  selected: readInitialSelected(),
  notice: null,
};

function readInitialSelected(): StreamItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as StreamItem[] : [];
  } catch {
    return [];
  }
}

function persistSelected(selected: StreamItem[]) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  } catch {
    // Ignore storage failures.
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: PitchKitState | ((current: PitchKitState) => PitchKitState)) {
  state = typeof next === 'function' ? next(state) : next;
  persistSelected(state.selected);
  emit();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dismissNoticeSoon() {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    if (state.notice) {
      setState((current) => ({ ...current, notice: null }));
    }
  }, 2400);
}

export function usePitchKit() {
  const snapshot = React.useSyncExternalStore(subscribe, () => state, () => state);

  const toggle = React.useCallback((listing: StreamItem) => {
    setState((current) => {
      const existing = current.selected.find((item) => item.id === listing.id);
      if (existing) {
        return {
          selected: current.selected.filter((item) => item.id !== listing.id),
          notice: null,
        };
      }

      if (current.selected.length >= MAX_PITCH_LISTINGS) {
        return {
          ...current,
          notice: `Pitch kit is limited to ${MAX_PITCH_LISTINGS} listings.`,
        };
      }

      return {
        selected: [...current.selected, listing],
        notice: null,
      };
    });

    if (state.notice) dismissNoticeSoon();
  }, []);

  const clear = React.useCallback(() => {
    setState({ selected: [], notice: null });
  }, []);

  const remove = React.useCallback((id: string) => {
    setState((current) => ({
      selected: current.selected.filter((item) => item.id !== id),
      notice: current.notice,
    }));
  }, []);

  const isSelected = React.useCallback((id: string) => {
    return state.selected.some((item) => item.id === id);
  }, []);

  const dismissNotice = React.useCallback(() => {
    setState((current) => ({ ...current, notice: null }));
  }, []);

  return {
    selected: snapshot.selected,
    count: snapshot.selected.length,
    max: MAX_PITCH_LISTINGS,
    notice: snapshot.notice,
    toggle,
    clear,
    remove,
    isSelected,
    dismissNotice,
  };
}
