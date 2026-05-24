import { h, Component } from 'preact';

import * as style from './style.css';
import 'add-css:./style.css';
import { assertSignal, isAbortError } from '../util';
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
import { getDocumentTitle, type LoadingFileInfo } from './document-title';
import { getEditorUpdateEffects } from './editor-lifecycle';
import {
  copySideToOther,
  getCopySideAction,
  getOtherSideIndex,
} from './side-copy';
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
  SideSettings,
  getSavedSideSettingsImportAction,
  getSavedSideSettingsSaveAction,
  readInitialSavedSideSettings,
  readSavedSideSettingsForSide,
  writeSavedSideSettingsForSide,
} from './saved-settings';
import {
  applySavedSideSettings,
  getInitialSideStates,
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
  getDefaultResizeSides,
  getPreprocessorChangeState,
} from './source-state';
import { getImageProcessingErrorMessage } from './processing-errors';
import {
  getActiveImageJobsAfterStarts,
  getImageWorkAbortPlan,
  getSideJobCacheEntry,
  getSideJobEncodedResult,
  getSideJobExecutionPlan,
  getPlannedImageWork,
  type MainJobState,
  type SideJobState,
} from './work-plan';
import { getCompressionDisplayState } from './display-state';
import {
  getCompressionPanelLayout,
  type CompressionPanelSlot,
} from './layout-state';

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
    sides: getInitialSideStates(readInitialSavedSideSettings()),
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
    const updateEffects = getEditorUpdateEffects(
      prevProps,
      this.props,
      prevState,
      this.state,
    );

    if (updateEffects.sourceFile) {
      this.sourceFile = updateEffects.sourceFile;
    }

    if (updateEffects.loadingFileInfo) {
      updateDocumentTitle(updateEffects.loadingFileInfo);
    }

    if (updateEffects.queueUpdate === 'immediate') {
      this.queueUpdateImage({ immediate: true });
      return;
    }

    this.queueUpdateImage();
  }

  private onCopyToOtherClick = async (index: SideIndex) => {
    const result = copySideToOther(this.state.sides, index);
    this.setState({
      sides: result.sides,
    });

    const copyAction = getCopySideAction();
    const snackbarResult = await this.props.showSnack(copyAction.message, {
      timeout: copyAction.timeout,
      actions: copyAction.actions,
    });

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
    const saveAction = getSavedSideSettingsSaveAction(
      writeSavedSideSettingsForSide(index, this.state.sides[index]),
    );
    if (saveAction.kind !== 'saved') {
      await this.props.showSnack(saveAction.message, {
        timeout: saveAction.timeout,
        actions: saveAction.actions,
      });
      return;
    }

    // Fire an event when we save side settings in local storage.
    window.dispatchEvent(new CustomEvent(saveAction.eventKey));
    await this.props.showSnack(saveAction.message, {
      timeout: saveAction.timeout,
      actions: saveAction.actions,
    });
  };

  /**
   * This function sets the side state with cached local storage values for the provided side index.
   * @param index : (0|1)
   * @returns
   */
  private onImportSideSettingsClick = async (index: 0 | 1) => {
    const importAction = getSavedSideSettingsImportAction(
      readSavedSideSettingsForSide(index),
    );
    if (importAction.kind !== 'imported') {
      await this.props.showSnack(importAction.message, {
        timeout: importAction.timeout,
        actions: importAction.actions,
      });
      return;
    }

    const update = applySavedSideSettings(
      this.state.sides,
      index,
      importAction.settings,
    );
    this.setState({
      sides: update.sides,
    });
    const result = await this.props.showSnack(importAction.message, {
      timeout: importAction.timeout,
      actions: importAction.actions,
    });
    if (result === 'undo') {
      this.setState({
        sides: restoreSide(this.state.sides, index, update.oldSide),
      });
    }
  };

  private onPreprocessorChange = async (
    preprocessorState: PreprocessorState,
  ): Promise<void> => {
    this.setState((state) => {
      const nextState = getPreprocessorChangeState(state, preprocessorState);
      return nextState || {};
    });
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

    const { mainJobState, sideJobStates, workPlan, workStarts } =
      getPlannedImageWork(
        this.activeMainJob,
        this.activeSideJobs,
        this.sourceFile,
        currentState,
      );

    // Abort running tasks & cycle the controllers
    const abortPlan = getImageWorkAbortPlan(workStarts);
    const activeJobs = getActiveImageJobsAfterStarts(
      {
        mainJob: this.activeMainJob,
        sideJobs: this.activeSideJobs,
      },
      workStarts,
    );
    if (abortPlan.main) {
      this.mainAbortController.abort();
      this.mainAbortController = new AbortController();
    }
    this.activeMainJob = activeJobs.mainJob;
    for (const [i, shouldAbort] of abortPlan.sides.entries()) {
      if (shouldAbort) {
        this.sideAbortControllers[i].abort();
        this.sideAbortControllers[i] = new AbortController();
        this.activeSideJobs[i] = activeJobs.sideJobs[i];
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
        if (isAbortError(err)) return;
        this.props.showSnack(
          getImageProcessingErrorMessage('source-decoding', err),
        );
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
        if (isAbortError(err)) return;
        this.setState({ loading: false });
        this.props.showSnack(
          getImageProcessingErrorMessage('preprocessing', err),
        );
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
        const sidePlan = getSideJobExecutionPlan({
          currentProcessed: currentState.sides[sideIndex].processed,
          getCacheResult: (...args) => this.encodeCache.match(...args),
          jobState,
          sideWorkNeeded,
          sourceFile: source.file,
          sourcePreprocessed: source.preprocessed,
        });

        if (sidePlan.kind === 'skip') return;

        if (sidePlan.kind === 'original' || sidePlan.kind === 'cache') {
          ({ file, processed, data } = sidePlan.result);
        } else {
          // Set loading state for this side
          this.setState((currentState) => {
            if (signal.aborted) return {};
            return {
              sides: setSideLoading(currentState.sides, sideIndex, true),
            };
          });

          if (sidePlan.needsProcessing) {
            processed = await processImage(
              signal,
              source,
              sidePlan.processorState,
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
                  sidePlan.processorState,
                ),
              };
            });
          } else {
            processed = sidePlan.processed!;
          }

          file = await compressImage(
            signal,
            processed,
            sidePlan.encoderState,
            source.file.name,
            workerBridge,
          );
          data = await decodeImage(signal, file, workerBridge);

          const cacheEntry = getSideJobCacheEntry(
            sidePlan,
            { data, file, processed },
            source.preprocessed,
          );
          if (cacheEntry) this.encodeCache.add(cacheEntry);
        }

        const sideResult = getSideJobEncodedResult(jobState, {
          data,
          file,
          processed,
        });

        this.setState((currentState) => {
          if (signal.aborted) return {};
          return {
            sides: setSideEncodedResult(
              currentState.sides,
              sideIndex,
              sideResult,
            ),
          };
        });

        this.activeSideJobs[sideIndex] = undefined;
      } catch (err) {
        if (isAbortError(err)) return;
        this.setState((currentState) => {
          return {
            sides: setSideLoading(currentState.sides, sideIndex, false),
          };
        });
        this.props.showSnack(getImageProcessingErrorMessage('processing', err));
        throw err;
      }
    });
  }

  render(
    { onBack }: Props,
    { loading, sides, source, mobileView, preprocessorState }: State,
  ) {
    const displayState = getCompressionDisplayState(
      sides,
      loading,
      mobileView,
      (encoderState) => encoderMap[encoderState.type].meta.label,
    );
    const panelLayout = getCompressionPanelLayout(mobileView);

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

    const results = displayState.results.map((resultDisplay) => (
      <Results
        downloadUrl={resultDisplay.downloadUrl}
        imageFile={resultDisplay.imageFile}
        source={source}
        loading={resultDisplay.loading}
        flipSide={resultDisplay.flipSide}
        typeLabel={resultDisplay.typeLabel}
      />
    ));
    const renderPanelSlot = (slot: CompressionPanelSlot) =>
      slot.content === 'options' ? options[slot.side] : results[slot.side];

    return (
      <div class={style.compress}>
        <Output
          source={source}
          mobileView={mobileView}
          leftCompressed={displayState.output.leftCompressed}
          rightCompressed={displayState.output.rightCompressed}
          leftImgContain={displayState.output.leftImgContain}
          rightImgContain={displayState.output.rightImgContain}
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
        {panelLayout.mode === 'mobile' ? (
          <div class={style.options}>
            <multi-panel class={style.multiPanel} open-one-only>
              {panelLayout.mobileSlots.map((slot) => (
                <div
                  class={
                    slot.side === 0 ? style.options1Theme : style.options2Theme
                  }
                  key={slot.key}
                >
                  {renderPanelSlot(slot)}
                </div>
              ))}
            </multi-panel>
          </div>
        ) : (
          panelLayout.desktopColumns.map((column) => (
            <div
              class={column.side === 0 ? style.options1 : style.options2}
              key={column.key}
            >
              {column.slots.map(renderPanelSlot)}
            </div>
          ))
        )}
      </div>
    );
  }
}
