export type OutputPreviewOrientation = 'vertical' | 'horizontal';

export interface OutputPreviewImage {
  [property: string]: string | number;
  width: number | '';
  height: number | '';
  objectFit: 'contain' | '';
}

export interface OutputPreviewState {
  orientation: OutputPreviewOrientation;
  leftImage: OutputPreviewImage;
  rightImage: OutputPreviewImage;
}

export interface OutputPreviewSourceImage {
  width: number;
  height: number;
}

export interface OutputPreviewStateInput {
  mobileView: boolean;
  originalImage: OutputPreviewSourceImage | undefined;
  leftImgContain: boolean;
  rightImgContain: boolean;
}

export function getOutputPreviewImageState(
  originalImage: OutputPreviewSourceImage | undefined,
  contain: boolean,
): OutputPreviewImage {
  return {
    width: originalImage ? originalImage.width : '',
    height: originalImage ? originalImage.height : '',
    objectFit: contain ? 'contain' : '',
  };
}

export function getOutputPreviewState({
  mobileView,
  originalImage,
  leftImgContain,
  rightImgContain,
}: OutputPreviewStateInput): OutputPreviewState {
  return {
    orientation: mobileView ? 'vertical' : 'horizontal',
    leftImage: getOutputPreviewImageState(originalImage, leftImgContain),
    rightImage: getOutputPreviewImageState(originalImage, rightImgContain),
  };
}
