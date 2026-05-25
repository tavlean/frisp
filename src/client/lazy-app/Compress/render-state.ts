import type { EncoderState } from '../feature-meta';
import {
  getCompressionDisplayState,
  type CompressionDisplayState,
  type DisplayRenderSide,
  type EncoderLabelGetter,
} from './display-state';
import {
  getCompressionPanelLayout,
  type CompressionPanelLayout,
} from './layout-state';

export interface CompressionRenderState {
  displayState: CompressionDisplayState;
  panelLayout: CompressionPanelLayout;
}

export interface CompressionRenderStateInput {
  sides: readonly [DisplayRenderSide, DisplayRenderSide];
  loading: boolean;
  mobileView: boolean;
  getEncoderLabel: EncoderLabelGetter;
}

export function getCompressionRenderState({
  sides,
  loading,
  mobileView,
  getEncoderLabel,
}: CompressionRenderStateInput): CompressionRenderState {
  return {
    displayState: getCompressionDisplayState(
      sides,
      loading,
      mobileView,
      getEncoderLabel,
    ),
    panelLayout: getCompressionPanelLayout(mobileView),
  };
}

export function getEncoderMapLabel(
  encoderMap: Record<string, { meta: { label: string } }>,
  encoderState: EncoderState,
): string {
  return encoderMap[encoderState.type].meta.label;
}
