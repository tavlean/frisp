import { describe, expect, it } from 'vitest';
import { EditorHistory } from '../../src/lib/editor/editor-history.svelte';

function seeded(limit?: number) {
  const history = new EditorHistory<string>(limit);
  history.reset('a', 'a');
  return history;
}

describe('EditorHistory', () => {
  it('starts empty with nothing to undo or redo', () => {
    const history = new EditorHistory<string>();
    expect(history.size).toBe(0);
    expect(history.position).toBe(-1);
    expect(history.current).toBeNull();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });

  it('reset seeds a single baseline that cannot be undone', () => {
    const history = seeded();
    expect(history.size).toBe(1);
    expect(history.position).toBe(0);
    expect(history.current).toBe('a');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it('commit appends, advances the pointer, and enables undo', () => {
    const history = seeded();
    expect(history.commit('b', 'b')).toBe(true);
    expect(history.commit('c', 'c')).toBe(true);
    expect(history.size).toBe(3);
    expect(history.position).toBe(2);
    expect(history.current).toBe('c');
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  it('undo and redo step the pointer and return the snapshot to apply', () => {
    const history = seeded();
    history.commit('b', 'b');
    history.commit('c', 'c');

    expect(history.undo()).toBe('b');
    expect(history.position).toBe(1);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(true);

    expect(history.undo()).toBe('a');
    expect(history.position).toBe(0);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
    expect(history.undo()).toBeNull();
    expect(history.position).toBe(0);

    expect(history.redo()).toBe('b');
    expect(history.redo()).toBe('c');
    expect(history.position).toBe(2);
    expect(history.canRedo).toBe(false);
    expect(history.redo()).toBeNull();
    expect(history.position).toBe(2);
    expect(history.size).toBe(3);
  });

  it('a commit with the current signature is a no-op', () => {
    const history = seeded();
    history.commit('b', 'b');
    expect(history.commit('b again', 'b')).toBe(false);
    expect(history.size).toBe(2);
    expect(history.current).toBe('b');
  });

  it('dedups against the entry the pointer is on, not the newest entry', () => {
    const history = seeded();
    history.commit('b', 'b');
    history.undo();
    // The restore write after an undo re-enters commit with the restored sig.
    expect(history.commit('a', 'a')).toBe(false);
    expect(history.size).toBe(2);
    expect(history.canRedo).toBe(true);
    // Matching the newest entry while pointing elsewhere is a real commit.
    expect(history.commit('b', 'b')).toBe(true);
    expect(history.size).toBe(2);
    expect(history.position).toBe(1);
  });

  it('a new commit after undo truncates the redo tail', () => {
    const history = seeded();
    history.commit('b', 'b');
    history.commit('c', 'c');
    history.undo();
    history.undo();

    expect(history.commit('d', 'd')).toBe(true);
    expect(history.size).toBe(2);
    expect(history.position).toBe(1);
    expect(history.canRedo).toBe(false);
    expect(history.redo()).toBeNull();
    expect(history.undo()).toBe('a');
  });

  it('the limit trims the oldest entries from the front', () => {
    const history = seeded(3);
    history.commit('b', 'b');
    history.commit('c', 'c');
    history.commit('d', 'd');

    expect(history.size).toBe(3);
    expect(history.position).toBe(2);
    expect(history.undo()).toBe('c');
    expect(history.undo()).toBe('b');
    expect(history.canUndo).toBe(false);
    expect(history.undo()).toBeNull();
  });

  it('a limit of one keeps only the latest snapshot', () => {
    const history = seeded(1);
    expect(history.commit('b', 'b')).toBe(true);
    expect(history.size).toBe(1);
    expect(history.position).toBe(0);
    expect(history.current).toBe('b');
    expect(history.canUndo).toBe(false);
  });

  it('commit on an empty history starts the stack', () => {
    const history = new EditorHistory<string>();
    expect(history.commit('a', 'a')).toBe(true);
    expect(history.size).toBe(1);
    expect(history.position).toBe(0);
    expect(history.canUndo).toBe(false);
  });

  it('reset discards history and the redo tail', () => {
    const history = seeded();
    history.commit('b', 'b');
    history.commit('c', 'c');
    history.undo();

    history.reset('x', 'x');
    expect(history.size).toBe(1);
    expect(history.position).toBe(0);
    expect(history.current).toBe('x');
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it('clear empties the stack', () => {
    const history = seeded();
    history.commit('b', 'b');

    history.clear();
    expect(history.size).toBe(0);
    expect(history.position).toBe(-1);
    expect(history.current).toBeNull();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBeNull();
  });
});
