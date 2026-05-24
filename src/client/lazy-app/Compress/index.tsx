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
  defaultProcessorState,
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
import { cleanMerge, cleanSet } from '../util/clean-modify';
import {
  copySideToOther,
  getOtherSideIndex,
  type SideIndex,
} from './side-copy';
import './custom-els/MultiPanel';
import Results from './Results';
import WorkerBridge from '../worker-bridge';
import type SnackBarElement from 'shared/custom-els/snack-bar';
import { drawableToImageData } from '../util/canvas';
import {
  SourceImage,
  compressImage,
  decodeImage,
  preprocessImage,
  processImage,
  processSvg,
} from '../image-pipeline';
import {
  SavedSideSettings,
  SideSettings,
  readSavedSideSettings,
  writeSavedSideSettings,
} from './saved-settings';
import {
  applySavedSideSettings,
  resetSidesForNewSourceData,
} from './side-state';
import {
  didOrientationChange,
  getDefaultResizeState,
  getOrientationAdjustedResizeState,
} from './source-state';
import {
  getImageWorkPlan,
  type MainJobState,
  type SideJobState,
} from './work-plan';
import type { LocalStorageKey } from '../storage';

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

const savedSettingsKeys: readonly [LocalStorageKey, LocalStorageKey] = [
  'leftSideSettings',
  'rightSideSettings',
];

function defaultSide(index: 0 | 1): Side {
  return {
    latestSettings: {
      processorState: defaultProcessorState,
      encoderState:
        index === 0
          ? undefined
          : {
              type: 'mozJPEG',
              options: encoderMap.mozJPEG.meta.defaultOptions,
            },
    },
    loading: false,
  };
}

function initialSide(index: 0 | 1): Side {
  const savedSettings = readSavedSideSettings(savedSettingsKeys[index]);
  return {
    ...defaultSide(index),
    ...savedSettings,
    loading: false,
  };
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
    sides: [initialSide(0), initialSide(1)],
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
      sides: cleanSet(
        this.state.sides,
        `${index}.latestSettings.encoderState`,
        newType === 'identity'
          ? undefined
          : {
              type: newType,
              options: encoderMap[newType].meta.defaultOptions,
            },
      ),
    });
  };

  private onProcessorOptionsChange = (
    index: 0 | 1,
    options: ProcessorState,
  ): void => {
    this.setState({
      sides: cleanSet(
        this.state.sides,
        `${index}.latestSettings.processorState`,
        options,
      ),
    });
  };

  private onEncoderOptionsChange = (
    index: 0 | 1,
    options: EncoderOptions,
  ): void => {
    this.setState({
      sides: cleanSet(
        this.state.sides,
        `${index}.latestSettings.encoderState.options`,
        options,
      ),
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
    this.mainAbortController.abort();
    for (const controller of this.sideAbortControllers) {
      controller.abort();
    }
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
      sides: cleanSet(
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
    const key = savedSettingsKeys[index];
    const sideLabel = index === 0 ? 'Left' : 'Right';
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
    const key = savedSettingsKeys[index];
    const sideLabel = index === 0 ? 'Left' : 'Right';
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
        sides: cleanSet(this.state.sides, index, update.oldSide),
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
        : (state.sides.map((side) => {
            const currentResizeSettings =
              side.latestSettings.processorState.resize;
            return cleanMerge(
              side,
              'latestSettings.processorState.resize',
              getOrientationAdjustedResizeState(currentResizeSettings),
            );
          }) as [Side, Side]),
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
    const latestMainJobState: Partial<MainJobState> = this.activeMainJob || {
      file: currentState.source && currentState.source.file,
      preprocessorState: currentState.encodedPreprocessorState,
    };
    const latestSideJobStates: Partial<SideJobState>[] = currentState.sides.map(
      (side, index) =>
        this.activeSideJobs[index] || {
          processorState:
            side.encodedSettings && side.encodedSettings.processorState,
          encoderState:
            side.encodedSettings && side.encodedSettings.encoderState,
        },
    );

    // State for this job
    const mainJobState: MainJobState = {
      file: this.sourceFile,
      preprocessorState: currentState.preprocessorState,
    };
    const sideJobStates: SideJobState[] = currentState.sides.map((side) => ({
      // If there isn't an encoder selected, we don't process either
      processorState: side.latestSettings.encoderState
        ? side.latestSettings.processorState
        : defaultProcessorState,
      encoderState: side.latestSettings.encoderState,
    }));

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

        // Special-case SVG. We need to avoid createImageBitmap because of
        // https://bugs.chromium.org/p/chromium/issues/detail?id=606319.
        // Also, we cache the HTMLImageElement so we can perform vector resizing later.
        if (mainJobState.file.type.startsWith('image/svg+xml')) {
          vectorImage = await processSvg(mainSignal, mainJobState.file);
          decoded = drawableToImageData(vectorImage);
        } else {
          decoded = await decodeImage(
            mainSignal,
            mainJobState.file,
            // Either worker is good enough here.
            this.workerBridges[0],
          );
        }

        // Set default resize values
        this.setState((currentState) => {
          if (mainSignal.aborted) return {};
          const sides = currentState.sides.map((side) => {
            const resizeState = getDefaultResizeState(
              decoded,
              Boolean(vectorImage),
            );
            return cleanMerge(
              side,
              'latestSettings.processorState.resize',
              resizeState,
            );
          }) as [Side, Side];
          return { sides };
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
          let newState: State = {
            ...currentState,
            loading: false,
            source,
            encodedPreprocessorState: mainJobState.preprocessorState,
            sides: currentState.sides.map((side) => {
              if (side.downloadUrl) URL.revokeObjectURL(side.downloadUrl);

              const newSide: Side = {
                ...side,
                // Intermediate render
                data: preprocessed,
                processed: undefined,
                encodedSettings: undefined,
              };
              return newSide;
            }) as [Side, Side],
          };
          newState = resetSidesForNewSourceData(newState);
          return newState;
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
    workPlan.sideWorksNeeded.forEach(async (sideWorkNeeded, sideIndex) => {
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
              const sides = cleanMerge(currentState.sides, sideIndex, {
                loading: true,
              });
              return { sides };
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
                const currentSide = currentState.sides[sideIndex];
                const side: Side = {
                  ...currentSide,
                  processed,
                  // Intermediate render
                  data: processed,
                  encodedSettings: {
                    ...currentSide.encodedSettings,
                    processorState: jobState.processorState,
                  },
                };
                const sides = cleanSet(currentState.sides, sideIndex, side);
                return { sides };
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
          const currentSide = currentState.sides[sideIndex];

          if (currentSide.downloadUrl) {
            URL.revokeObjectURL(currentSide.downloadUrl);
          }

          const side: Side = {
            ...currentSide,
            data,
            file,
            downloadUrl: URL.createObjectURL(file),
            loading: false,
            processed,
            encodedSettings: {
              processorState: jobState.processorState,
              encoderState: jobState.encoderState,
            },
          };
          const sides = cleanSet(currentState.sides, sideIndex, side);
          return { sides };
        });

        this.activeSideJobs[sideIndex] = undefined;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        this.setState((currentState) => {
          const sides = cleanMerge(currentState.sides, sideIndex, {
            loading: false,
          });
          return { sides };
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
        typeLabel={
          side.latestSettings.encoderState
            ? encoderMap[side.latestSettings.encoderState.type].meta.label
            : `${side.file ? `${side.file.name}` : 'Original Image'}`
        }
      />
    ));

    // For rendering, we ideally want the settings that were used to create the
    // data, not the latest settings.
    const leftDisplaySettings =
      leftSide.encodedSettings || leftSide.latestSettings;
    const rightDisplaySettings =
      rightSide.encodedSettings || rightSide.latestSettings;
    const leftImgContain =
      leftDisplaySettings.processorState.resize.enabled &&
      leftDisplaySettings.processorState.resize.fitMethod === 'contain';
    const rightImgContain =
      rightDisplaySettings.processorState.resize.enabled &&
      rightDisplaySettings.processorState.resize.fitMethod === 'contain';

    return (
      <div class={style.compress}>
        <Output
          source={source}
          mobileView={mobileView}
          leftCompressed={leftImageData}
          rightCompressed={rightImageData}
          leftImgContain={leftImgContain}
          rightImgContain={rightImgContain}
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
