export type ResultLoadingEffect = 'hide' | 'delay-show' | 'none';

export interface ResultLoadingState {
  showLoadingState: boolean;
}

export function getInitialResultLoadingState(loading: boolean): boolean {
  return loading;
}

export function getInitialResultLoadingVisibilityState(
  loading: boolean,
): ResultLoadingState {
  return getResultLoadingVisibilityState(getInitialResultLoadingState(loading));
}

export function getResultLoadingVisibilityState(
  showLoadingState: boolean,
): ResultLoadingState {
  return { showLoadingState };
}

export function getResultLoadingEffect(
  previousLoading: boolean,
  nextLoading: boolean,
): ResultLoadingEffect {
  if (previousLoading && !nextLoading) return 'hide';
  if (!previousLoading && nextLoading) return 'delay-show';
  return 'none';
}
