import type { ComponentChildren } from 'preact';

export interface ExpanderState {
  children: ComponentChildren;
  outgoingChildren: ComponentChildren;
}

export function getExpanderDerivedState(
  children: ComponentChildren,
  state: ExpanderState,
): Partial<ExpanderState> | null {
  if (!children && state.children) {
    return { children, outgoingChildren: state.children };
  }

  if (children !== state.children) {
    return { children, outgoingChildren: undefined };
  }

  return null;
}
