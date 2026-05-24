import type { EncoderState } from '../../feature-meta';
import type { SupportedEncoderMap } from './encoder-support';

export type EncoderSelectValue = EncoderState['type'] | 'identity';

export interface EncoderSelectSource {
  file: {
    name: string;
  };
}

export interface EncoderSelectOption {
  value: string;
  label: string;
}

export function getEncoderSelectValue(
  encoderState: EncoderState | undefined,
): EncoderSelectValue {
  return encoderState ? encoderState.type : 'identity';
}

export function getOriginalImageOptionLabel(
  source: EncoderSelectSource | undefined,
): string {
  return `Original Image${source ? ` (${source.file.name})` : ''}`;
}

export function getEncoderSelectOptions(
  supportedEncoderMap: SupportedEncoderMap,
): EncoderSelectOption[] {
  return Object.entries(supportedEncoderMap).map(([type, encoder]) => ({
    value: type,
    label: encoder.meta.label,
  }));
}
