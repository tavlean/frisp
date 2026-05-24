import { h, Component, Fragment } from 'preact';

import * as style from './style.css';
import 'add-css:./style.css';
import 'shared/custom-els/loading-spinner';
import { SourceImage } from '../';
import {
  getInitialResultLoadingVisibilityState,
  getResultLoadingEffect,
  getResultLoadingVisibilityState,
  type ResultLoadingState,
} from './loading-state';
import { getResultDownloadState } from './download-state';
import { getResultSizeState } from './size-state';
import { Arrow, DownloadIcon } from 'client/lazy-app/icons';

interface Props {
  loading: boolean;
  source?: SourceImage;
  imageFile?: File;
  downloadUrl?: string;
  flipSide: boolean;
  typeLabel: string;
}

type State = ResultLoadingState;

const loadingReactionDelay = 500;

export default class Results extends Component<Props, State> {
  state: State = getInitialResultLoadingVisibilityState(this.props.loading);

  /** The timeout ID between entering the loading state, and changing UI */
  private loadingTimeoutId: number = 0;

  componentDidUpdate(prevProps: Props, prevState: State) {
    const loadingEffect = getResultLoadingEffect(
      prevProps.loading,
      this.props.loading,
    );

    if (loadingEffect === 'hide') {
      // Just stopped loading
      clearTimeout(this.loadingTimeoutId);
      this.setState(getResultLoadingVisibilityState(false));
    } else if (loadingEffect === 'delay-show') {
      // Just started loading
      this.loadingTimeoutId = self.setTimeout(
        () => this.setState(getResultLoadingVisibilityState(true)),
        loadingReactionDelay,
      );
    }
  }

  componentWillUnmount() {
    clearTimeout(this.loadingTimeoutId);
  }

  render(
    { source, imageFile, downloadUrl, flipSide, typeLabel }: Props,
    { showLoadingState }: State,
  ) {
    const sizeState = getResultSizeState(source, imageFile);
    const downloadState = getResultDownloadState(
      flipSide,
      sizeState.isOriginal,
      showLoadingState,
      downloadUrl,
      imageFile,
    );

    return (
      <div
        class={
          (downloadState.side === 'right'
            ? style.resultsRight
            : style.resultsLeft) +
          ' ' +
          (downloadState.isOriginal ? style.isOriginal : '')
        }
      >
        <div class={style.expandArrow}>
          <Arrow />
        </div>
        <div class={style.bubble}>
          <div class={style.bubbleInner}>
            <div class={style.sizeInfo}>
              <div class={style.fileSize}>
                {sizeState.prettySize ? (
                  <Fragment>
                    {sizeState.prettySize.value}{' '}
                    <span class={style.unit}>{sizeState.prettySize.unit}</span>
                    <span class={style.typeLabel}> {typeLabel}</span>
                  </Fragment>
                ) : (
                  '…'
                )}
              </div>
            </div>
            <div class={style.percentInfo}>
              <svg
                viewBox="0 0 1 2"
                class={style.bigArrow}
                preserveAspectRatio="none"
              >
                <path d="M1 0v2L0 1z" />
              </svg>
              <div class={style.percentOutput}>
                {sizeState.direction && (
                  <span class={style.sizeDirection}>
                    {sizeState.direction === 'down' ? '↓' : '↑'}
                  </span>
                )}
                <span class={style.sizeValue}>{sizeState.percent}</span>
                <span class={style.percentChar}>%</span>
              </div>
            </div>
          </div>
        </div>
        <a
          class={
            downloadState.disabled ? style.downloadDisable : style.download
          }
          href={downloadState.href}
          download={downloadState.downloadName}
          title="Download"
        >
          <svg class={style.downloadBlobs} viewBox="0 0 89.6 86.9">
            <title>Download</title>
            <path d="M27.3 72c-8-4-15.6-12.3-16.9-21-1.2-8.7 4-17.8 10.5-26s14.4-15.6 24-16 21.2 6 28.6 16.5c7.4 10.5 10.8 25 6.6 34S64.1 71.8 54 73.6c-10.2 2-18.7 2.3-26.7-1.6z" />
            <path d="M19.8 24.8c4.3-7.8 13-15 21.8-15.7 8.7-.8 17.5 4.8 25.4 11.8 7.8 6.9 14.8 15.2 14.7 24.9s-7.1 20.7-18 27.6c-10.8 6.8-25.5 9.5-34.2 4.8S18.1 61.6 16.7 51.4c-1.3-10.3-1.3-18.8 3-26.6z" />
          </svg>
          <div class={style.downloadIcon}>
            <DownloadIcon />
          </div>
          {showLoadingState && <loading-spinner />}
        </a>
      </div>
    );
  }
}
