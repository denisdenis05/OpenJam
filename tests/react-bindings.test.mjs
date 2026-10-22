import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire, Module } from 'node:module';
import { Values } from './fixtures.mjs';

const ReactModule = 'react';
const ReactEntryPoint = '../.build/src/react/index.js';
const requireBindings = createRequire(import.meta.url);
const Names = Object.freeze({
  selectedIdentity: 'React selector retains selected identity when unrelated snapshot data changes',
  changedSelection: 'React selector publishes changes to selected state',
  methodBinding: 'React selector preserves the receiver of store subscription methods',
});

function fixture() {
  const originalLoad = Module._load;
  const entryPoint = requireBindings.resolve(ReactEntryPoint);
  let readSelection;
  let stop;
  Module._load = function load(moduleIdentifier, parent, isMain) {
    if (moduleIdentifier !== ReactModule) return originalLoad.call(this, moduleIdentifier, parent, isMain);
    return { useMemo: callback => callback(), useSyncExternalStore(subscribe, getSnapshot) {
      readSelection = getSnapshot; stop = subscribe(() => undefined); return getSnapshot();
    } };
  };
  delete requireBindings.cache[entryPoint];
  let bindings;
  try { bindings = requireBindings(ReactEntryPoint); } finally { Module._load = originalLoad; }
  const store = { state: { selected: Values.title, unrelated: Values.initialUnrelatedValue }, listeners: new Set(),
    getSnapshot() { return this.state; }, subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); } };
  return { bindings, store, read: () => readSelection(), stop: () => stop() };
}

test(Names.selectedIdentity, () => {
  const state = fixture();
  const selected = state.bindings.useJamSelector(state.store, snapshot => ({ title: snapshot.selected }),
    (previous, next) => previous.title === next.title);
  state.store.state = { ...state.store.state, unrelated: Values.changedUnrelatedValue };
  assert.equal(state.read(), selected); state.stop();
});

test(Names.changedSelection, () => {
  const state = fixture(); state.bindings.useJamSelector(state.store, snapshot => snapshot.selected);
  state.store.state = { ...state.store.state, selected: Values.unrelatedTitle };
  assert.equal(state.read(), Values.unrelatedTitle); state.stop();
});

test(Names.methodBinding, () => {
  const state = fixture(); state.bindings.useJamSelector(state.store, snapshot => snapshot.selected);
  assert.equal(state.store.listeners.size, Values.singleResultCount); state.stop(); assert.equal(state.store.listeners.size, Values.noInvocations);
});
