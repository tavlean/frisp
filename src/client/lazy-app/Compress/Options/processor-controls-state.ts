import type { ProcessorState } from '../../feature-meta';

export interface ResizeOptionsSource {
  vectorImage?: unknown;
  preprocessed: {
    width: number;
    height: number;
  };
}

export interface ResizeOptionsState {
  isVector: boolean;
  inputWidth: number;
  inputHeight: number;
}

export function getProcessorTypeFromControlName(
  name: string,
): keyof ProcessorState {
  return name.split('.')[0] as keyof ProcessorState;
}

export function getResizeOptionsState(
  source: ResizeOptionsSource | undefined,
): ResizeOptionsState {
  return {
    isVector: Boolean(source && source.vectorImage),
    inputWidth: source ? source.preprocessed.width : 1,
    inputHeight: source ? source.preprocessed.height : 1,
  };
}
