import {
  getOutputDrawableState,
  getOutputUpdatePlan,
  type OutputDrawableInput,
  type OutputImageSize,
  type OutputPinchZoomState,
  type OutputPinchZoomTransform,
} from './draw-state';

const resetPinchZoomTransform: OutputPinchZoomTransform = {
  allowChangeEvent: true,
  x: 0,
  y: 0,
  scale: 1,
};

export interface RunOutputWorkflowInput<Drawable extends OutputImageSize> {
  currentProps: OutputDrawableInput<Drawable>;
  previousProps?: OutputDrawableInput<Drawable>;
  pinchZoom: OutputPinchZoomState;
  setPinchZoomTransform: (transform: OutputPinchZoomTransform) => void;
  drawLeft: (drawable: Drawable) => void;
  drawRight: (drawable: Drawable) => void;
}

export function runOutputMountWorkflow<Drawable extends OutputImageSize>({
  currentProps,
  setPinchZoomTransform,
  drawLeft,
  drawRight,
}: Omit<
  RunOutputWorkflowInput<Drawable>,
  'previousProps' | 'pinchZoom'
>): void {
  const drawState = getOutputDrawableState(currentProps);

  setPinchZoomTransform(resetPinchZoomTransform);

  if (drawState.leftDraw) {
    drawLeft(drawState.leftDraw);
  }

  if (drawState.rightDraw) {
    drawRight(drawState.rightDraw);
  }
}

export function runOutputUpdateWorkflow<Drawable extends OutputImageSize>({
  previousProps,
  currentProps,
  pinchZoom,
  setPinchZoomTransform,
  drawLeft,
  drawRight,
}: RunOutputWorkflowInput<Drawable>): void {
  if (!previousProps) return;

  const drawState = getOutputDrawableState(currentProps);
  const updatePlan = getOutputUpdatePlan(
    previousProps,
    currentProps,
    pinchZoom,
  );

  if (updatePlan.resetPinchZoom) {
    setPinchZoomTransform(resetPinchZoomTransform);
  } else if (updatePlan.pinchZoomUpdate) {
    setPinchZoomTransform(updatePlan.pinchZoomUpdate);
  }

  if (updatePlan.redrawLeft && drawState.leftDraw) {
    drawLeft(drawState.leftDraw);
  }

  if (updatePlan.redrawRight && drawState.rightDraw) {
    drawRight(drawState.rightDraw);
  }
}
