export type ImageProcessingErrorStage =
  | 'source-decoding'
  | 'preprocessing'
  | 'processing';

const errorLabels: Record<ImageProcessingErrorStage, string> = {
  'source-decoding': 'Source decoding',
  preprocessing: 'Preprocessing',
  processing: 'Processing',
};

export function getImageProcessingErrorMessage(
  stage: ImageProcessingErrorStage,
  error: unknown,
): string {
  return `${errorLabels[stage]} error: ${error}`;
}
