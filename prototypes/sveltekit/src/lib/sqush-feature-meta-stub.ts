export interface EncoderState {
  type: string;
  options: Record<string, unknown>;
}

export interface ProcessorState {
  resize: {
    enabled: boolean;
    width?: number;
    height?: number;
  };
  quantize: {
    enabled: boolean;
  };
}
