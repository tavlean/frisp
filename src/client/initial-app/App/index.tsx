import type { FileDropEvent } from 'file-drop-element';
import type SnackBarElement from 'shared/custom-els/snack-bar';
import type { SnackOptions } from 'shared/custom-els/snack-bar';

import { h, Component } from 'preact';

import { linkRef } from 'shared/prerendered-app/util';
import * as style from './style.css';
import 'add-css:./style.css';
import 'file-drop-element';
import 'shared/custom-els/snack-bar';
import Intro from 'shared/prerendered-app/Intro';
import 'shared/custom-els/loading-spinner';
import {
  getCompressLoadedState,
  getEditorOpenState,
  getEditorUrl,
  getFileEntryState,
  getInitialAppRenderState,
  getInitialAppState,
  getPopStateRouteState,
  getShareTargetErrorState,
  getShareTargetImageState,
  type InitialAppState,
} from './state';

const compressPromise = import('client/lazy-app/Compress');
const swBridgePromise = import('client/lazy-app/sw-bridge');

function back() {
  window.history.back();
}

interface Props {}

type State = InitialAppState<typeof import('client/lazy-app/Compress').default>;

export default class App extends Component<Props, State> {
  state: State = getInitialAppState(location.href);

  snackbar?: SnackBarElement;

  constructor() {
    super();

    compressPromise
      .then((module) => {
        this.setState(getCompressLoadedState(module.default));
      })
      .catch(() => {
        this.showSnack('Failed to load app');
      });

    swBridgePromise.then(async ({ offliner, getSharedImage }) => {
      offliner(this.showSnack);
      if (!this.state.awaitingShareTarget) return;
      let file: File;
      try {
        file = await getSharedImage();
      } catch {
        this.showSnack('Failed to load shared image');
        this.setState(getShareTargetErrorState());
        return;
      }
      // Remove the ?share-target from the URL
      history.replaceState('', '', '/');
      this.openEditor();
      this.setState(getShareTargetImageState(file));
    });

    // Since iOS 10, Apple tries to prevent disabling pinch-zoom. This is great in theory, but
    // really breaks things on Sqush, as you can easily end up zooming the UI when you mean to
    // zoom the image. Once you've done this, it's really difficult to undo. Anyway, this seems to
    // prevent it.
    document.body.addEventListener('gesturestart', (event: Event) => {
      event.preventDefault();
    });

    window.addEventListener('popstate', this.onPopState);
  }

  private onFileDrop = ({ files }: FileDropEvent) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    this.openEditor();
    this.setState(getFileEntryState(file));
  };

  private onIntroPickFile = (file: File) => {
    this.openEditor();
    this.setState(getFileEntryState(file));
  };

  private showSnack = (
    message: string,
    options: SnackOptions = {},
  ): Promise<string> => {
    if (!this.snackbar) throw Error('Snackbar missing');
    return this.snackbar.showSnackbar(message, options);
  };

  private onPopState = () => {
    this.setState(getPopStateRouteState(location.pathname));
  };

  private openEditor = () => {
    if (this.state.isEditorOpen) return;
    // Change path, but preserve query string.
    history.pushState(null, '', getEditorUrl(location.href));
    this.setState(getEditorOpenState());
  };

  render(
    {}: Props,
    { file, isEditorOpen, Compress, awaitingShareTarget }: State,
  ) {
    const renderState = getInitialAppRenderState({
      awaitingShareTarget,
      isEditorOpen,
      Compress,
    });

    return (
      <div class={style.app}>
        <file-drop onfiledrop={this.onFileDrop} class={style.drop}>
          {renderState.showSpinner ? (
            <loading-spinner class={style.appLoader} />
          ) : renderState.showEditor ? (
            Compress && (
              <Compress file={file!} showSnack={this.showSnack} onBack={back} />
            )
          ) : (
            <Intro onFile={this.onIntroPickFile} showSnack={this.showSnack} />
          )}
          <snack-bar ref={linkRef(this, 'snackbar')} />
        </file-drop>
      </div>
    );
  }
}
