import { h, Component, Fragment } from 'preact';
import type PinchZoom from './custom-els/PinchZoom';
import type { ScaleToOpts } from './custom-els/PinchZoom';
import './custom-els/PinchZoom';
import './custom-els/TwoUp';
import * as style from './style.css';
import 'add-css:./style.css';
import { shallowEqual, isSafari } from '../../util';
import {
  ToggleAliasingIcon,
  ToggleAliasingActiveIcon,
  ToggleBackgroundIcon,
  AddIcon,
  RemoveIcon,
  ToggleBackgroundActiveIcon,
  RotateIcon,
} from '../../icons';
import { twoUpHandle } from './custom-els/TwoUp/styles.css';
import type { PreprocessorState } from '../../feature-meta';
import type { SourceImage } from '../../Compress';
import { linkRef } from 'shared/prerendered-app/util';
import { drawDataToCanvas } from 'client/lazy-app/util/canvas';
import { getOutputDrawableState } from './draw-state';
import { getOutputPreviewState } from './preview-state';
import { runOutputMountWorkflow, runOutputUpdateWorkflow } from './workflow';
import {
  getNextOutputScale,
  getInitialOutputViewControlState,
  getAliasingToggleState,
  getBackgroundToggleState,
  getEditingScaleState,
  getOutputScaleFromPercent,
  getOutputScalePercent,
  getPinchZoomScaleState,
  getRotatedPreprocessorState,
  shouldBlurActiveElementAfterOutputRetarget,
  shouldRetargetOutputEvent,
} from './control-state';
interface Props {
  source?: SourceImage;
  preprocessorState?: PreprocessorState;
  mobileView: boolean;
  leftCompressed?: ImageData;
  rightCompressed?: ImageData;
  leftImgContain: boolean;
  rightImgContain: boolean;
  onPreprocessorChange: (newState: PreprocessorState) => void;
}

interface State {
  scale: number;
  editingScale: boolean;
  altBackground: boolean;
  aliasing: boolean;
}

const scaleToOpts: ScaleToOpts = {
  originX: '50%',
  originY: '50%',
  relativeTo: 'container',
  allowChangeEvent: true,
};

export default class Output extends Component<Props, State> {
  state: State = getInitialOutputViewControlState();
  canvasLeft?: HTMLCanvasElement;
  canvasRight?: HTMLCanvasElement;
  pinchZoomLeft?: PinchZoom;
  pinchZoomRight?: PinchZoom;
  scaleInput?: HTMLInputElement;
  retargetedEvents = new WeakSet<Event>();

  componentDidMount() {
    runOutputMountWorkflow({
      currentProps: this.props,
      setPinchZoomTransform: (transform) => {
        this.pinchZoomLeft!.setTransform(transform);
      },
      drawLeft: (drawable) => {
        if (this.canvasLeft) drawDataToCanvas(this.canvasLeft, drawable);
      },
      drawRight: (drawable) => {
        if (this.canvasRight) drawDataToCanvas(this.canvasRight, drawable);
      },
    });
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const pinchZoom = this.pinchZoomLeft!;
    runOutputUpdateWorkflow({
      previousProps: prevProps,
      currentProps: this.props,
      pinchZoom,
      setPinchZoomTransform: (transform) => {
        pinchZoom.setTransform(transform);
      },
      drawLeft: (drawable) => {
        if (this.canvasLeft) drawDataToCanvas(this.canvasLeft, drawable);
      },
      drawRight: (drawable) => {
        if (this.canvasRight) drawDataToCanvas(this.canvasRight, drawable);
      },
    });
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    return (
      !shallowEqual(this.props, nextProps) ||
      !shallowEqual(this.state, nextState)
    );
  }

  private leftDrawable(props: Props = this.props): ImageData | undefined {
    return getOutputDrawableState(props).leftDraw;
  }

  private rightDrawable(props: Props = this.props): ImageData | undefined {
    return getOutputDrawableState(props).rightDraw;
  }

  private toggleAliasing = () => {
    this.setState(getAliasingToggleState);
  };

  private toggleBackground = () => {
    this.setState(getBackgroundToggleState);
  };

  private zoomIn = () => {
    if (!this.pinchZoomLeft) throw Error('Missing pinch-zoom element');
    this.pinchZoomLeft.scaleTo(
      getNextOutputScale(this.state.scale, 'in'),
      scaleToOpts,
    );
  };

  private zoomOut = () => {
    if (!this.pinchZoomLeft) throw Error('Missing pinch-zoom element');
    this.pinchZoomLeft.scaleTo(
      getNextOutputScale(this.state.scale, 'out'),
      scaleToOpts,
    );
  };

  private onRotateClick = () => {
    const { preprocessorState: inputProcessorState } = this.props;
    if (!inputProcessorState) return;

    this.props.onPreprocessorChange(
      getRotatedPreprocessorState(inputProcessorState),
    );
  };

  private onScaleValueFocus = () => {
    this.setState(getEditingScaleState(true), () => {
      if (this.scaleInput) {
        // Firefox unfocuses the input straight away unless I force a style
        // calculation here. I have no idea why, but it's late and I'm quite
        // tired.
        getComputedStyle(this.scaleInput).transform;
        this.scaleInput.focus();
      }
    });
  };

  private onScaleInputBlur = () => {
    this.setState(getEditingScaleState(false));
  };

  private onScaleInputChanged = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const scale = getOutputScaleFromPercent(target.value);
    if (scale === undefined) return;
    if (!this.pinchZoomLeft) throw Error('Missing pinch-zoom element');

    this.pinchZoomLeft.scaleTo(scale, scaleToOpts);
  };

  private onPinchZoomLeftChange = (event: Event) => {
    if (!this.pinchZoomRight || !this.pinchZoomLeft) {
      throw Error('Missing pinch-zoom element');
    }
    this.setState(getPinchZoomScaleState(this.pinchZoomLeft.scale));
    this.pinchZoomRight.setTransform({
      scale: this.pinchZoomLeft.scale,
      x: this.pinchZoomLeft.x,
      y: this.pinchZoomLeft.y,
    });
  };

  /**
   * We're using two pinch zoom elements, but we want them to stay in sync. When one moves, we
   * update the position of the other. However, this is tricky when it comes to multi-touch, when
   * one finger is on one pinch-zoom, and the other finger is on the other. To overcome this, we
   * redirect all relevant pointer/touch/mouse events to the first pinch zoom element.
   *
   * @param event Event to redirect
   */
  private onRetargetableEvent = (event: Event) => {
    const targetEl = event.target as HTMLElement;
    if (!this.pinchZoomLeft) throw Error('Missing pinch-zoom element');
    // If the event is on the handle of the two-up, let it through,
    // unless it's a wheel event, in which case always let it through.
    if (
      !shouldRetargetOutputEvent({
        eventType: event.type,
        isTwoUpHandle: Boolean(targetEl.closest(`.${twoUpHandle}`)),
        alreadyRetargeted: this.retargetedEvents.has(event),
      })
    ) {
      return;
    }
    // Stop the event in its tracks.
    event.stopImmediatePropagation();
    event.preventDefault();
    // Clone the event & dispatch
    // Some TypeScript trickery needed due to https://github.com/Microsoft/TypeScript/issues/3841
    const clonedEvent = new (event.constructor as typeof Event)(
      event.type,
      event,
    );
    this.retargetedEvents.add(clonedEvent);
    this.pinchZoomLeft.dispatchEvent(clonedEvent);

    // Unfocus any active element on touchend. This fixes an issue on (at least) Android Chrome,
    // where the software keyboard is hidden, but the input remains focused, then after interaction
    // with this element the keyboard reappears for NO GOOD REASON. Thanks Android.
    if (
      shouldBlurActiveElementAfterOutputRetarget(
        event.type,
        document.activeElement instanceof HTMLElement,
      )
    ) {
      (document.activeElement as HTMLElement).blur();
    }
  };

  render(
    { mobileView, leftImgContain, rightImgContain, source }: Props,
    { scale, editingScale, altBackground, aliasing }: State,
  ) {
    const leftDraw = this.leftDrawable();
    const rightDraw = this.rightDrawable();
    // To keep position stable, the output is put in a square using the longest dimension.
    const originalImage = source && source.preprocessed;
    const previewState = getOutputPreviewState({
      mobileView,
      originalImage,
      leftImgContain,
      rightImgContain,
    });

    return (
      <Fragment>
        <div
          class={`${style.output} ${altBackground ? style.altBackground : ''}`}
        >
          <two-up
            legacy-clip-compat
            class={style.twoUp}
            orientation={previewState.orientation}
            // Event redirecting. See onRetargetableEvent.
            onTouchStartCapture={this.onRetargetableEvent}
            onTouchEndCapture={this.onRetargetableEvent}
            onTouchMoveCapture={this.onRetargetableEvent}
            onPointerDownCapture={
              // We avoid pointer events in our PinchZoom due to a Safari bug.
              // That means we also need to avoid them here too, else we end up preventing the fallback mouse events.
              isSafari ? undefined : this.onRetargetableEvent
            }
            onMouseDownCapture={this.onRetargetableEvent}
            onWheelCapture={this.onRetargetableEvent}
          >
            <pinch-zoom
              class={style.pinchZoom}
              onChange={this.onPinchZoomLeftChange}
              ref={linkRef(this, 'pinchZoomLeft')}
            >
              <canvas
                class={`${style.pinchTarget} ${
                  aliasing ? style.pixelated : ''
                }`}
                ref={linkRef(this, 'canvasLeft')}
                width={leftDraw && leftDraw.width}
                height={leftDraw && leftDraw.height}
                style={previewState.leftImage}
              />
            </pinch-zoom>
            <pinch-zoom
              class={style.pinchZoom}
              ref={linkRef(this, 'pinchZoomRight')}
            >
              <canvas
                class={`${style.pinchTarget} ${
                  aliasing ? style.pixelated : ''
                }`}
                ref={linkRef(this, 'canvasRight')}
                width={rightDraw && rightDraw.width}
                height={rightDraw && rightDraw.height}
                style={previewState.rightImage}
              />
            </pinch-zoom>
          </two-up>
        </div>
        <div class={style.controls}>
          <div class={style.buttonGroup}>
            <button class={style.firstButton} onClick={this.zoomOut}>
              <RemoveIcon />
            </button>
            {editingScale ? (
              <input
                type="number"
                step="1"
                min="1"
                max="1000000"
                ref={linkRef(this, 'scaleInput')}
                class={style.zoom}
                value={getOutputScalePercent(scale)}
                onInput={this.onScaleInputChanged}
                onBlur={this.onScaleInputBlur}
              />
            ) : (
              <span
                class={style.zoom}
                tabIndex={0}
                onFocus={this.onScaleValueFocus}
              >
                <span class={style.zoomValue}>
                  {getOutputScalePercent(scale)}
                </span>
                %
              </span>
            )}
            <button class={style.lastButton} onClick={this.zoomIn}>
              <AddIcon />
            </button>
          </div>
          <div class={style.buttonGroup}>
            <button
              class={style.firstButton}
              onClick={this.onRotateClick}
              title="Rotate"
            >
              <RotateIcon />
            </button>
            {!isSafari && (
              <button
                class={style.button}
                onClick={this.toggleAliasing}
                title="Toggle smoothing"
              >
                {aliasing ? (
                  <ToggleAliasingActiveIcon />
                ) : (
                  <ToggleAliasingIcon />
                )}
              </button>
            )}
            <button
              class={style.lastButton}
              onClick={this.toggleBackground}
              title="Toggle background"
            >
              {altBackground ? (
                <ToggleBackgroundActiveIcon />
              ) : (
                <ToggleBackgroundIcon />
              )}
            </button>
          </div>
        </div>
      </Fragment>
    );
  }
}
