import type { EncoderState } from '../feature-meta';
import type { SideSettings } from './saved-settings';

export interface DisplaySettingsSide {
  latestSettings: SideSettings;
  encodedSettings?: SideSettings;
}

export interface DisplayLabelSide {
  file?: File;
  latestSettings: SideSettings;
}

export interface DisplayRenderSide
  extends DisplaySettingsSide,
    DisplayLabelSide {
  data?: ImageData;
  downloadUrl?: string;
  loading: boolean;
}

export interface OutputDisplayState {
  leftCompressed?: ImageData;
  rightCompressed?: ImageData;
  leftImgContain: boolean;
  rightImgContain: boolean;
}

export interface ResultDisplayState {
  downloadUrl?: string;
  imageFile?: File;
  loading: boolean;
  flipSide: boolean;
  typeLabel: string;
}

export type EncoderLabelGetter = (encoderState: EncoderState) => string;

export function getDisplaySettings(side: DisplaySettingsSide): SideSettings {
  return side.encodedSettings || side.latestSettings;
}

export function getSideTypeLabel(
  side: DisplayLabelSide,
  getEncoderLabel: EncoderLabelGetter,
): string {
  const encoderState = side.latestSettings.encoderState;
  if (encoderState) return getEncoderLabel(encoderState);

  return side.file ? side.file.name : 'Original Image';
}

export function shouldContainImage(side: DisplaySettingsSide): boolean {
  const displaySettings = getDisplaySettings(side);
  const resizeSettings = displaySettings.processorState.resize;
  return Boolean(
    resizeSettings.enabled && resizeSettings.fitMethod === 'contain',
  );
}

export function getOutputDisplayState(
  sides: readonly [DisplayRenderSide, DisplayRenderSide],
): OutputDisplayState {
  const [leftSide, rightSide] = sides;

  return {
    leftCompressed: leftSide.data,
    rightCompressed: rightSide.data,
    leftImgContain: shouldContainImage(leftSide),
    rightImgContain: shouldContainImage(rightSide),
  };
}

export function getResultDisplayStates(
  sides: readonly [DisplayRenderSide, DisplayRenderSide],
  loading: boolean,
  mobileView: boolean,
  getEncoderLabel: EncoderLabelGetter,
): [ResultDisplayState, ResultDisplayState] {
  return sides.map((side, index) => ({
    downloadUrl: side.downloadUrl,
    imageFile: side.file,
    loading: loading || side.loading,
    flipSide: mobileView || index === 1,
    typeLabel: getSideTypeLabel(side, getEncoderLabel),
  })) as [ResultDisplayState, ResultDisplayState];
}
