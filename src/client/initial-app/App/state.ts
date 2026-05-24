export const ROUTE_EDITOR = '/editor';

export interface InitialAppState<CompressComponent = unknown> {
  awaitingShareTarget: boolean;
  file?: File;
  isEditorOpen: boolean;
  Compress?: CompressComponent;
}

export interface InitialAppRenderState {
  showEditor: boolean;
  showIntro: boolean;
  showSpinner: boolean;
}

export function getInitialAppState<CompressComponent = unknown>(
  href: string,
): InitialAppState<CompressComponent> {
  return {
    awaitingShareTarget: new URL(href).searchParams.has('share-target'),
    isEditorOpen: false,
    file: undefined,
    Compress: undefined,
  };
}

export function getCompressLoadedState<CompressComponent>(
  Compress: CompressComponent,
): Pick<InitialAppState<CompressComponent>, 'Compress'> {
  return { Compress };
}

export function getShareTargetErrorState(): Pick<
  InitialAppState,
  'awaitingShareTarget'
> {
  return { awaitingShareTarget: false };
}

export function getFileEntryState(
  file: File,
): Pick<InitialAppState, 'file' | 'isEditorOpen'> {
  return { file, isEditorOpen: true };
}

export function getShareTargetImageState(
  file: File,
): Pick<InitialAppState, 'awaitingShareTarget' | 'file' | 'isEditorOpen'> {
  return { file, awaitingShareTarget: false, isEditorOpen: true };
}

export function getPopStateRouteState(
  pathname: string,
): Pick<InitialAppState, 'isEditorOpen'> {
  return { isEditorOpen: pathname === ROUTE_EDITOR };
}

export function getEditorOpenState(): Pick<InitialAppState, 'isEditorOpen'> {
  return { isEditorOpen: true };
}

export function getEditorUrl(href: string): string {
  const editorURL = new URL(href);
  editorURL.pathname = ROUTE_EDITOR;
  return editorURL.href;
}

export function getInitialAppRenderState({
  awaitingShareTarget,
  isEditorOpen,
  Compress,
}: Pick<
  InitialAppState,
  'awaitingShareTarget' | 'isEditorOpen' | 'Compress'
>): InitialAppRenderState {
  const showSpinner = awaitingShareTarget || (isEditorOpen && !Compress);
  return {
    showSpinner,
    showEditor: isEditorOpen && !showSpinner,
    showIntro: !isEditorOpen && !showSpinner,
  };
}
