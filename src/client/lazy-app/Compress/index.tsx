import { h, Component } from 'preact';

import * as style from './style.css';
import 'add-css:./style.css';
import { assertSignal } from '../util';
import {
  PreprocessorState,
  ProcessorState,
  EncoderState,
  encoderMap,
  defaultPreprocessorState,
  EncoderType,
  EncoderOptions,
} from '../feature-meta';
import Output from './Output';
import Options from './Options';
import ResultCache from './result-cache';
import {
  getDocumentTitle,
  getLoadingFileInfo,
  shouldUpdateDocumentTitle,
  type LoadingFileInfo,
} from './document-title';
import { copySideToOther, getOtherSideIndex } from './side-copy';
import './custom-els/MultiPanel';
import Results from './Results';
import WorkerBridge from '../worker-bridge';
import type SnackBarElement from 'shared/custom-els/snack-bar';
import {
  SourceImage,
  compressImage,
  decodeSourceImage,
  decodeImage,
  preprocessImage,
  processImage,
} from '../image-pipeline';
import {
  SavedSideSettings,
  SideSettings,
  getSavedSideSettingsKey,
  getSideLabel,
  readSavedSideSettings,
  writeSavedSideSettings,
} from './saved-settings';
import {
  applySavedSideSettings,
  getInitialSideState,
  restoreSide,
  resetSidesForNewSourceData,
  revokeSideDownloadUrls,
  setPreprocessedSourceState,
  setSideEncoderOptions,
  setSideEncoderType,
  setSideEncodedResult,
  setSideLoading,
  setSideProcessedResult,
  setSideProcessorState,
  type SideIndex,
} from './side-state';
import {
  didOrientationChange,
  getDefaultResizeSides,
  getOrientationAdjustedSides,
} from './source-state';
import {
  getImageWorkPlan,
  getLatestMainJobState,
  getLatestSideJobStates,
  getMainJobState,
  getSideJobStates,
  type MainJobState,
  type SideJobState,
} from './work-plan';
import { getSideTypeLabel, shouldContainImage } from './display-state';

export type OutputType = EncoderType | 'identity';
export type { SourceImage } from '../image-pipeline';

interface Side {
  processed?: ImageData;
  file?: File;
  downloadUrl?: string;
  data?: ImageData;
  latestSettings: SideSettings;
  encodedSettings?: SideSettings;
  loading: boolean;
}

interface Props {
  file: File;
  showSnack: SnackBarElement['showSnackbar'];
  onBack: () => void;
}

interface State {
  source?: SourceImage;
  sides: [Side, Side];
  /** Source image load */
  loading: boolean;
  mobileView: boolean;
  preprocessorState: PreprocessorState;
  encodedPreprocessorState?: PreprocessorState;
}

const originalDocumentTitle = document.title;

function updateDocumentTitle(loadingFileInfo: LoadingFileInfo): void {
  document.title = getDocumentTitle(originalDocumentTitle, loadingFileInfo);
}

export default class Compress extends Component<Props, State> {
  widthQuery = window.matchMedia('(max-width: 599px)');

  state: State = {
    source: undefined,
    loading: false,
    preprocessorState: defaultPreprocessorState,
    sides: [
      getInitialSideState(0, readSavedSideSettings(getSavedSideSettingsKey(0))),
      getInitialSideState(1, readSavedSideSettings(getSavedSideSettingsKey(1))),
    ],
    mobileView: this.widthQuery.matches,
  };

  private readonly encodeCache = new ResultCache();
  // One for each side
  private readonly workerBridges = [new WorkerBridge(), new WorkerBridge()];
  /** Abort controller for actions that impact both sites, like source image decoding and preprocessing */
  private mainAbortController = new AbortController();
  // And again one for each side
  private sideAbortControllers = [new AbortController(), new AbortController()];
  /** For debouncing calls to updateImage for each side. */
  private updateImageTimeout?: number;

  constructor(props: Props) {
    super(props);
    this.widthQuery.addEventListener('change', this.onMobileWidthChange);
    this.sourceFile = props.file;
    this.queueUpdateImage({ immediate: true });

    import('../sw-bridge').then(({ mainAppLoaded }) => mainAppLoaded());
  }

  private onMobileWidthChange = () => {
    this.setState({ mobileView: this.widthQuery.matches });
  };

  private onEncoderTypeChange = (index: 0 | 1, newType: OutputType): void => {
    this.setState({
      sides: setSideEncoderType(this.state.sides, index, newType),
    });
  };

  private onProcessorOptionsChange = (
    index: 0 | 1,
    options: ProcessorState,
  ): void => {
    this.setState({
      sides: setSideProcessorState(this.state.sides, index, options),
    });
  };

  private onEncoderOptionsChange = (
    index: 0 | 1,
    options: EncoderOptions,
  ): void => {
    this.setState({
      sides: setSideEncoderOptions(this.state.sides, index, options),
    });
  };

  componentWillReceiveProps(nextProps: Props): void {
    if (nextProps.file !== this.props.file) {
      this.sourceFile = nextProps.file;
      this.queueUpdateImage({ immediate: true });
    }
  }

  componentWillUnmount(): void {
    updateDocumentTitle({ loading: false });
    this.widthQuery.removeEventListener('change', this.onMobileWidthChange);
    clearTimeout(this.updateImageTimeout);
    this.mainAbortController.abort();
    for (const controller of this.sideAbortControllers) {
      controller.abort();
    }
    revokeSideDownloadUrls(this.state.sides);
  }

  componentDidUpdate(prevProps: Props, prevState: State): void {
    if (shouldUpdateDocumentTitle(prevState, this.state)) {
      updateDocumentTitle(getLoadingFileInfo(this.state));
    }
    this.queueUpdateImage();
  }

  private onCopyToOtherClick = async (index: SideIndex) => {
    const result = copySideToOther(this.state.sides, index);
    this.setState({
      sides: result.sides,
    });

    const snackbarResult = await this.props.showSnack(
      'Settings copied across',
      {
        timeout: 5000,
        actions: ['undo', 'dismiss'],
      },
    );

    if (snackbarResult !== 'undo') return;

    this.setState({
      sides: restoreSide(
        this.state.sides,
        getOtherSideIndex(index),
        result.oldSide,
      ),
    });
  };
  /**
   * This function saves encodedSettings and latestSettings of a particular side in browser local storage.
   * @param index : (0|1)
   * @returns
   */
  private onSaveSideSettingsClick = async (index: 0 | 1) => {
    const key = getSavedSideSettingsKey(index);
    const sideLabel = getSideLabel(index);
    const settingsSaved = writeSavedSideSettings(key, {
      encodedSettings: this.state.sides[index].encodedSettings,
      latestSettings: this.state.sides[index].latestSettings,
    });
    if (!settingsSaved) {
      await this.props.showSnack(
        `${sideLabel} side settings could not be saved`,
        {
          timeout: 3000,
          actions: ['dismiss'],
        },
      );
      return;
    }

    // Fire an event when we save side settings in local storage.
    window.dispatchEvent(new CustomEvent(key));
    await this.props.showSnack(`${sideLabel} side settings saved`, {
      timeout: 1500,
      actions: ['dismiss'],
    });
  };

  /**
   * This function sets the side state with cached local storage values for the provided side index.
   * @param index : (0|1)
   * @returns
   */
  private onImportSideSettingsClick = async (index: 0 | 1) => {
    const key = getSavedSideSettingsKey(index);
    const sideLabel = getSideLabel(index);
    const savedSettings = readSavedSideSettings(key);
    if (!savedSettings) {
      await this.props.showSnack(
        `Saved ${sideLabel.toLowerCase()} side settings are invalid`,
        {
          timeout: 3000,
          actions: ['dismiss'],
        },
      );
      return;
    }

    const update = applySavedSideSettings(
      this.state.sides,
      index,
      savedSettings,
    );
    this.setState({
      sides: update.sides,
    });
    const result = await this.props.showSnack(
      `${sideLabel} side settings imported`,
      {
        timeout: 3000,
        actions: ['undo', 'dismiss'],
      },
    );
    if (result === 'undo') {
      this.setState({
        sides: restoreSide(this.state.sides, index, update.oldSide),
      });
    }
  };

  private onPreprocessorChange = async (
    preprocessorState: PreprocessorState,
  ): Promise<void> => {
    const source = this.state.source;
    if (!source) return;

    const oldRotate = this.state.preprocessorState.rotate.rotate;
    const newRotate = preprocessorState.rotate.rotate;
    const orientationChanged = didOrientationChange(oldRotate, newRotate);

    this.setState((state) => ({
      loading: true,
      preprocessorState,
      // Flip resize values if orientation has changed
      sides: !orientationChanged
        ? state.sides
        : getOrientationAdjustedSides(state.sides),
    }));
  };

  /**
   * Debounce the heavy lifting of updateImage.
   * Otherwise, the thrashing causes jank, and sometimes crashes iOS Safari.
   */
  private queueUpdateImage({ immediate }: { immediate?: boolean } = {}): void {
    // Call updateImage after this delay, unless queueUpdateImage is called
    // again, in which case the timeout is reset.
    const delay = 100;

    clearTimeout(this.updateImageTimeout);
    if (immediate) {
      this.updateImage();
    } else {
      this.updateImageTimeout = setTimeout(() => this.updateImage(), delay);
    }
  }

  private sourceFile: File;
  /** The in-progress job for decoding and preprocessing */
  private activeMainJob?: MainJobState;
  /** The in-progress job for each side (processing and encoding) */
  private activeSideJobs: [SideJobState?, SideJobState?] = [
    undefined,
    undefined,
  ];

  /**
   * Perform image processing.
   *
   * This function is a monster, but I didn't want to break it up, because it
   * never gets partially called. Instead, it looks at the current state, and
   * decides which steps can be skipped, and which can be cached.
   */
  private async updateImage() {
    const currentState = this.state;

    // State of the last completed job, or ongoing job
    const latestMainJobState = getLatestMainJobState(
      this.activeMainJob,
      currentState.source && currentState.source.file,
      currentState.encodedPreprocessorState,
    );
    const latestSideJobStates = getLatestSideJobStates(
      this.activeSideJobs,
      currentState.sides,
    );

    // State for this job
    const mainJobState = getMainJobState(
      this.sourceFile,
      currentState.preprocessorState,
    );
    const sideJobStates = getSideJobStates(currentState.sides);

    const workPlan = getImageWorkPlan(
      latestMainJobState,
      mainJobState,
      latestSideJobStates,
      sideJobStates,
    );

    // Abort running tasks & cycle the controllers
    if (workPlan.needsDecoding || workPlan.needsPreprocessing) {
      this.mainAbortController.abort();
      this.mainAbortController = new AbortController();
      this.activeMainJob = mainJobState;
    }
    for (const [i, sideWorkNeeded] of workPlan.sideWorksNeeded.entries()) {
      if (sideWorkNeeded.processing || sideWorkNeeded.encoding) {
        this.sideAbortControllers[i].abort();
        this.sideAbortControllers[i] = new AbortController();
        this.activeSideJobs[i] = sideJobStates[i];
      }
    }

    if (!workPlan.jobNeeded) return;

    const mainSignal = this.mainAbortController.signal;
    const sideSignals = this.sideAbortControllers.map((ac) => ac.signal);

    let decoded: ImageData;
    let vectorImage: HTMLImageElement | undefined;

    // Handle decoding
    if (workPlan.needsDecoding) {
      try {
        assertSignal(mainSignal);
        this.setState({
          source: undefined,
          loading: true,
        });

        const decodedSource = await decodeSourceImage(
          mainSignal,
          mainJobState.file,
          // Either worker is good enough here.
          this.workerBridges[0],
        );
        ({ decoded, vectorImage } = decodedSource);

        // Set default resize values
        this.setState((currentState) => {
          if (mainSignal.aborted) return {};
          return {
            sides: getDefaultResizeSides(
              currentState.sides,
              decoded,
              Boolean(vectorImage),
            ),
          };
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        this.props.showSnack(`Source decoding error: ${err}`);
        throw err;
      }
    } else {
      ({ decoded, vectorImage } = currentState.source!);
    }

    let source: SourceImage;

    // Handle preprocessing
    if (workPlan.needsPreprocessing) {
      try {
        assertSignal(mainSignal);
        this.setState({
          loading: true,
        });

        const preprocessed = await preprocessImage(
          mainSignal,
          decoded,
          mainJobState.preprocessorState,
          // Either worker is good enough here.
          this.workerBridges[0],
        );

        source = {
          decoded,
          vectorImage,
          preprocessed,
          file: mainJobState.file,
        };

        // Update state for process completion, including intermediate render
        this.setState((currentState) => {
          if (mainSignal.aborted) return {};
          return setPreprocessedSourceState(
            currentState,
            source,
            mainJobState.preprocessorState,
            preprocessed,
          );
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        this.setState({ loading: false });
        this.props.showSnack(`Preprocessing error: ${err}`);
        throw err;
      }
    } else {
      source = currentState.source!;
    }

    // That's the main part of the job done.
    this.activeMainJob = undefined;

    // Allow side jobs to happen in parallel
    workPlan.sideWorksNeeded.forEach(async (sideWorkNeeded, index) => {
      const sideIndex = index as SideIndex;
      try {
        // If processing is true, encoding is always true.
        if (!sideWorkNeeded.encoding) return;

        const signal = sideSignals[sideIndex];
        const jobState = sideJobStates[sideIndex];
        const workerBridge = this.workerBridges[sideIndex];
        let file: File;
        let data: ImageData;
        let processed: ImageData | undefined = undefined;

        // If there's no encoder state, this is "original image", which also
        // doesn't allow processing.
        if (!jobState.encoderState) {
          file = source.file;
          data = source.preprocessed;
        } else {
          const cacheResult = this.encodeCache.match(
            source.preprocessed,
            jobState.processorState,
            jobState.encoderState,
          );

          if (cacheResult) {
            ({ file, processed, data } = cacheResult);
          } else {
            // Set loading state for this side
            this.setState((currentState) => {
              if (signal.aborted) return {};
              return {
                sides: setSideLoading(currentState.sides, sideIndex, true),
              };
            });

            if (sideWorkNeeded.processing) {
              processed = await processImage(
                signal,
                source,
                jobState.processorState,
                workerBridge,
              );

              // Update state for process completion, including intermediate render
              this.setState((currentState) => {
                if (signal.aborted) return {};
                return {
                  sides: setSideProcessedResult(
                    currentState.sides,
                    sideIndex,
                    processed,
                    jobState.processorState,
                  ),
                };
              });
            } else {
              processed = currentState.sides[sideIndex].processed!;
            }

            file = await compressImage(
              signal,
              processed,
              jobState.encoderState,
              source.file.name,
              workerBridge,
            );
            data = await decodeImage(signal, file, workerBridge);

            this.encodeCache.add({
              data,
              processed,
              file,
              preprocessed: source.preprocessed,
              encoderState: jobState.encoderState,
              processorState: jobState.processorState,
            });
          }
        }

        this.setState((currentState) => {
          if (signal.aborted) return {};
          return {
            sides: setSideEncodedResult(currentState.sides, sideIndex, {
              data,
              file,
              processed,
              processorState: jobState.processorState,
              encoderState: jobState.encoderState,
            }),
          };
        });

        this.activeSideJobs[sideIndex] = undefined;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        this.setState((currentState) => {
          return {
            sides: setSideLoading(currentState.sides, sideIndex, false),
          };
        });
        this.props.showSnack(`Processing error: ${err}`);
        throw err;
      }
    });
  }

  render(
    { onBack }: Props,
    { loading, sides, source, mobileView, preprocessorState }: State,
  ) {
    const [leftSide, rightSide] = sides;
    const [leftImageData, rightImageData] = sides.map((i) => i.data);

    const options = sides.map((side, index) => (
      <Options
        index={index as 0 | 1}
        source={source}
        mobileView={mobileView}
        processorState={side.latestSettings.processorState}
        encoderState={side.latestSettings.encoderState}
        onEncoderTypeChange={this.onEncoderTypeChange}
        onEncoderOptionsChange={this.onEncoderOptionsChange}
        onProcessorOptionsChange={this.onProcessorOptionsChange}
        onCopyToOtherSideClick={this.onCopyToOtherClick}
        onSaveSideSettingsClick={this.onSaveSideSettingsClick}
        onImportSideSettingsClick={this.onImportSideSettingsClick}
      />
    ));

    const results = sides.map((side, index) => (
      <Results
        downloadUrl={side.downloadUrl}
        imageFile={side.file}
        source={source}
        loading={loading || side.loading}
        flipSide={mobileView || index === 1}
        typeLabel={getSideTypeLabel(
          side,
          (encoderState) => encoderMap[encoderState.type].meta.label,
        )}
      />
    ));

    return (
      <div class={style.compress}>
        <Output
          source={source}
          mobileView={mobileView}
          leftCompressed={leftImageData}
          rightCompressed={rightImageData}
          leftImgContain={shouldContainImage(leftSide)}
          rightImgContain={shouldContainImage(rightSide)}
          preprocessorState={preprocessorState}
          onPreprocessorChange={this.onPreprocessorChange}
        />
        <button class={style.back} onClick={onBack}>
          <svg viewBox="0 0 61 53.3">
            <title>Back</title>
            <path
              class={style.backBlob}
              d="M0 25.6c-.5-7.1 4.1-14.5 10-19.1S23.4.1 32.2 0c8.8 0 19 1.6 24.4 8s5.6 17.8 1.7 27a29.7 29.7 0 01-20.5 18c-8.4 1.5-17.3-2.6-24.5-8S.5 32.6.1 25.6z"
            />
            <path
              class={style.backX}
              d="M41.6 17.1l-2-2.1-8.3 8.2-8.2-8.2-2 2 8.2 8.3-8.3 8.2 2.1 2 8.2-8.1 8.3 8.2 2-2-8.2-8.3z"
            />
          </svg>
        </button>
        {mobileView ? (
          <div class={style.options}>
            <multi-panel class={style.multiPanel} open-one-only>
              <div class={style.options1Theme}>{results[0]}</div>
              <div class={style.options1Theme}>{options[0]}</div>
              <div class={style.options2Theme}>{results[1]}</div>
              <div class={style.options2Theme}>{options[1]}</div>
            </multi-panel>
          </div>
        ) : (
          [
            <div class={style.options1} key="options1">
              {options[0]}
              {results[0]}
            </div>,
            <div class={style.options2} key="options2">
              {options[1]}
              {results[1]}
            </div>,
          ]
        )}
      </div>
    );
  }
}
