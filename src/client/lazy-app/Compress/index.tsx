import { h, Component } from 'preact';

import * as style from './style.css';
import 'add-css:./style.css';
import { isAbortError } from '../util';
import {
  PreprocessorState,
  ProcessorState,
  EncoderState,
  encoderMap,
  EncoderType,
  EncoderOptions,
} from '../feature-meta';
import Output from './Output';
import Options from './Options';
import ResultCache from './result-cache';
import { getDocumentTitle, type LoadingFileInfo } from './document-title';
import {
  getEditorUpdateEffects,
  getEditorUpdateScheduleOptions,
} from './editor-lifecycle';
import { getInitialCompressionState } from './editor-state';
import {
  getImageUpdateSchedule,
  type ImageUpdateScheduleOptions,
} from './update-scheduler';
import { getViewportState, mobileWidthMediaQuery } from './viewport-state';
import { runCopySideToOther } from './side-copy-workflow';
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
import { SideSettings, readInitialSavedSideSettings } from './saved-settings';
import {
  runImportSideSettings,
  runSaveSideSettings,
} from './saved-settings-workflow';
import {
  getSideEncoderOptionsChangeState,
  getSideEncoderTypeChangeState,
  getSideEncodedResultState,
  getSideLoadingState,
  getSideProcessedResultState,
  getSideProcessorOptionsChangeState,
  getRestoreSideState,
  resetSidesForNewSourceData,
  revokeSideDownloadUrls,
  setPreprocessedSourceState,
  type SideIndex,
} from './side-state';
import {
  getSourceDecodeSuccessState,
  getPreprocessorChangeState,
  getSourceDecodeStartState,
  getSourcePreprocessErrorState,
  getSourcePreprocessStartState,
} from './source-state';
import { getImageProcessingErrorMessage } from './processing-errors';
import { runSourceImageWorkflow } from './source-workflow';
import { runRunnableSideJobs } from './side-job-runner';
import {
  getActiveImageJobsAfterMainCompletion,
  getActiveImageJobsAfterSideCompletion,
  getPlannedImageWork,
  getRunnableSideJobs,
  type MainJobState,
  type SideJobState,
} from './work-plan';
import { startImageWork } from './work-start-runner';
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
  widthQuery = window.matchMedia(mobileWidthMediaQuery);

  state: State = {
    ...getInitialCompressionState(
      readInitialSavedSideSettings(),
      this.widthQuery.matches,
    ),
  };

  private readonly encodeCache = new ResultCache();
  // One for each side
  private readonly workerBridges = [new WorkerBridge(), new WorkerBridge()];
  /** Abort controller for actions that impact both sites, like source image decoding and preprocessing */
  private mainAbortController = new AbortController();
  // And again one for each side
  private sideAbortControllers: [AbortController, AbortController] = [
    new AbortController(),
    new AbortController(),
  ];
  /** For debouncing calls to updateImage for each side. */
  private updateImageTimeout?: number;
  private isUnmounted = false;

  constructor(props: Props) {
    super(props);
    this.widthQuery.addEventListener('change', this.onMobileWidthChange);
    this.sourceFile = props.file;
    this.queueUpdateImage({ immediate: true });

    import('../sw-bridge').then(({ mainAppLoaded }) => mainAppLoaded());
  }

  private onMobileWidthChange = () => {
    this.setState(getViewportState(this.widthQuery.matches));
  };

  private onEncoderTypeChange = (index: 0 | 1, newType: OutputType): void => {
    this.setState((state) =>
      getSideEncoderTypeChangeState(state, index, newType),
    );
  };

  private onProcessorOptionsChange = (
    index: 0 | 1,
    options: ProcessorState,
  ): void => {
    this.setState((state) =>
      getSideProcessorOptionsChangeState(state, index, options),
    );
  };

  private onEncoderOptionsChange = (
    index: 0 | 1,
    options: EncoderOptions,
  ): void => {
    this.setState((state) =>
      getSideEncoderOptionsChangeState(state, index, options),
    );
  };

  componentWillUnmount(): void {
    this.isUnmounted = true;
    updateDocumentTitle({ loading: false });
    this.widthQuery.removeEventListener('change', this.onMobileWidthChange);
    clearTimeout(this.updateImageTimeout);
    this.mainAbortController.abort();
    for (const controller of this.sideAbortControllers) {
      controller.abort();
    }
    for (const workerBridge of this.workerBridges) {
      workerBridge.dispose();
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

    this.queueUpdateImage(getEditorUpdateScheduleOptions(updateEffects));
  }

  private onCopyToOtherClick = async (index: SideIndex) => {
    await runCopySideToOther({
      index,
      state: this.state,
      showSnack: this.props.showSnack,
      isUnmounted: () => this.isUnmounted,
      onApply: (sides) => {
        this.setState({ sides });
      },
      onRestore: (sideIndex, oldSide) => {
        this.setState({
          ...getRestoreSideState(this.state, sideIndex, oldSide),
        });
      },
    });
  };
  private onSaveSideSettingsClick = async (index: 0 | 1) => {
    await runSaveSideSettings({
      index,
      side: this.state.sides[index],
      showSnack: this.props.showSnack,
      dispatchSavedSettingsEvent: (eventKey) => {
        window.dispatchEvent(new CustomEvent(eventKey));
      },
    });
  };

  private onImportSideSettingsClick = async (index: 0 | 1) => {
    await runImportSideSettings({
      index,
      state: this.state,
      showSnack: this.props.showSnack,
      isUnmounted: () => this.isUnmounted,
      onApply: (sides) => {
        this.setState({ sides });
      },
      onRestore: (oldSide) => {
        this.setState({
          ...getRestoreSideState(this.state, index, oldSide),
        });
      },
    });
  };

  private showSnackIfMounted = (message: string): Promise<string> => {
    if (this.isUnmounted) return Promise.resolve('dismiss');
    return this.props.showSnack(message);
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
  private queueUpdateImage(options: ImageUpdateScheduleOptions = {}): void {
    // Call updateImage after this delay, unless queueUpdateImage is called
    // again, in which case the timeout is reset.
    const schedule = getImageUpdateSchedule(options);

    clearTimeout(this.updateImageTimeout);
    if (schedule.kind === 'immediate') {
      this.updateImage();
    } else {
      this.updateImageTimeout = setTimeout(
        () => this.updateImage(),
        schedule.delay,
      );
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

    const workRuntime = startImageWork(
      {
        mainJob: this.activeMainJob,
        sideJobs: this.activeSideJobs,
        mainAbortController: this.mainAbortController,
        sideAbortControllers: this.sideAbortControllers,
      },
      workStarts,
    );
    this.mainAbortController = workRuntime.mainAbortController;
    this.sideAbortControllers = workRuntime.sideAbortControllers;
    this.activeMainJob = workRuntime.mainJob;
    this.activeSideJobs = workRuntime.sideJobs;

    if (!workPlan.jobNeeded) return;

    const { mainSignal, sideSignals } = workRuntime;

    const source = await runSourceImageWorkflow({
      signal: mainSignal,
      currentSource: currentState.source,
      mainJobState,
      workPlan,
      // Either worker is good enough here.
      workerBridge: this.workerBridges[0],
      pipeline: { decodeSourceImage, preprocessImage },
      isUnmounted: () => this.isUnmounted,
      showSnack: this.showSnackIfMounted,
      onDecodeStart: () => {
        this.setState(getSourceDecodeStartState());
      },
      onDecoded: ({ decoded, vectorImage }) => {
        // Set default resize values
        this.setState((currentState) => {
          if (mainSignal.aborted) return {};
          return getSourceDecodeSuccessState(
            currentState,
            decoded,
            Boolean(vectorImage),
          );
        });
      },
      onPreprocessStart: () => {
        this.setState(getSourcePreprocessStartState());
      },
      onPreprocessed: (preprocessedSource) => {
        // Update state for process completion, including intermediate render
        this.setState((currentState) => {
          if (mainSignal.aborted) return {};
          return setPreprocessedSourceState(
            currentState,
            preprocessedSource,
            mainJobState.preprocessorState,
            preprocessedSource.preprocessed,
          );
        });
      },
      onPreprocessError: () => {
        this.setState(getSourcePreprocessErrorState());
      },
    });
    if (!source) return;

    // That's the main part of the job done.
    this.activeMainJob = getActiveImageJobsAfterMainCompletion({
      mainJob: this.activeMainJob,
      sideJobs: this.activeSideJobs,
    }).mainJob;

    // Allow side jobs to happen in parallel.
    runRunnableSideJobs({
      runnableSideJobs: getRunnableSideJobs(
        workPlan.sideWorksNeeded,
        sideJobStates,
      ),
      sideSignals,
      source,
      getCurrentProcessed: (sideIndex) =>
        currentState.sides[sideIndex].processed,
      getCacheResult: (...args) => this.encodeCache.match(...args),
      getWorkerBridge: (sideIndex) => this.workerBridges[sideIndex],
      pipeline: {
        processImage,
        compressImage,
        decodeImage,
      },
      onProcessingStart: (sideIndex, signal) => {
        this.setState((currentState) => {
          if (signal.aborted) return {};
          return getSideLoadingState(
            currentState,
            sideIndex as SideIndex,
            true,
          );
        });
      },
      onProcessed: (sideIndex, signal, processed, processorState) => {
        // Update state for process completion, including intermediate render.
        this.setState((currentState) => {
          if (signal.aborted) return {};
          return getSideProcessedResultState(
            currentState,
            sideIndex as SideIndex,
            processed,
            processorState,
          );
        });
      },
      onCacheEntry: (cacheEntry) => this.encodeCache.add(cacheEntry),
      onEncodedResult: (sideIndex, signal, sideResult) => {
        this.setState((currentState) => {
          if (signal.aborted) return {};
          return getSideEncodedResultState(
            currentState,
            sideIndex as SideIndex,
            sideResult,
          );
        });
      },
      onSideComplete: (sideIndex) => {
        this.activeSideJobs = getActiveImageJobsAfterSideCompletion(
          {
            mainJob: this.activeMainJob,
            sideJobs: this.activeSideJobs,
          },
          sideIndex,
        ).sideJobs;
      },
      onError: (sideIndex, signal, err) => {
        if (isAbortError(err)) return;
        if (this.isUnmounted) return;
        this.setState((currentState) => {
          return getSideLoadingState(
            currentState,
            sideIndex as SideIndex,
            false,
          );
        });
        this.showSnackIfMounted(
          getImageProcessingErrorMessage('processing', err),
        );
        throw err;
      },
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
