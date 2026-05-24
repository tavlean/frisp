import { h, Component } from 'preact';

import * as style from './style.css';
import 'add-css:./style.css';
import type { SourceImage, OutputType } from '..';
import {
  EncoderOptions,
  EncoderState,
  ProcessorState,
  ProcessorOptions,
  encoderMap,
} from '../../feature-meta';
import Expander from './Expander';
import Toggle from './Toggle';
import Select from './Select';
import { Options as QuantOptionsComponent } from 'features/processors/quantize/client';
import { Options as ResizeOptionsComponent } from 'features/processors/resize/client';
import { ImportIcon, SaveIcon, SwapIcon } from 'client/lazy-app/icons';
import { mergeProcessorOptions, setProcessorEnabled } from '../processor-state';
import {
  getSupportedEncoderMap,
  type SupportedEncoderMap,
} from './encoder-support';
import {
  getEncoderSelectOptions,
  getEncoderSelectValue,
  getOriginalImageOptionLabel,
} from './encoder-select-state';
import {
  canImportSavedSideSettings,
  getSavedSideSettingsAvailability,
} from './saved-settings-state';
import {
  getProcessorTypeFromControlName,
  getResizeOptionsState,
} from './processor-controls-state';

interface Props {
  index: 0 | 1;
  mobileView: boolean;
  source?: SourceImage;
  encoderState?: EncoderState;
  processorState: ProcessorState;
  onEncoderTypeChange(index: 0 | 1, newType: OutputType): void;
  onEncoderOptionsChange(index: 0 | 1, newOptions: EncoderOptions): void;
  onProcessorOptionsChange(index: 0 | 1, newOptions: ProcessorState): void;
  onCopyToOtherSideClick(index: 0 | 1): void;
  onSaveSideSettingsClick(index: 0 | 1): void;
  onImportSideSettingsClick(index: 0 | 1): void;
}

interface State {
  supportedEncoderMap?: SupportedEncoderMap;
  hasLeftSideSettings: boolean;
  hasRightSideSettings: boolean;
}

const supportedEncoderMapP = getSupportedEncoderMap();

export default class Options extends Component<Props, State> {
  state: State = {
    supportedEncoderMap: undefined,
    ...getSavedSideSettingsAvailability(),
  };

  constructor() {
    super();
    supportedEncoderMapP.then((supportedEncoderMap) =>
      this.setState({ supportedEncoderMap }),
    );
  }

  private setLeftSideSettings = () => {
    this.setState({
      hasLeftSideSettings:
        getSavedSideSettingsAvailability().hasLeftSideSettings,
    });
  };

  private setRightSideSettings = () => {
    this.setState({
      hasRightSideSettings:
        getSavedSideSettingsAvailability().hasRightSideSettings,
    });
  };

  componentDidMount(): void {
    // Changing the state when side setting is stored in localstorage
    window.addEventListener('leftSideSettings', this.setLeftSideSettings);
    window.addEventListener('rightSideSettings', this.setRightSideSettings);
  }

  componentWillUnmount(): void {
    window.removeEventListener('leftSideSettings', this.setLeftSideSettings);
    window.removeEventListener('rightSideSettings', this.setRightSideSettings);
  }

  private onEncoderTypeChange = (event: Event) => {
    const el = event.currentTarget as HTMLSelectElement;

    // The select element only has values matching encoder types,
    // so 'as' is safe here.
    const type = el.value as OutputType;
    this.props.onEncoderTypeChange(this.props.index, type);
  };

  private onProcessorEnabledChange = (event: Event) => {
    const el = event.currentTarget as HTMLInputElement;
    const processor = getProcessorTypeFromControlName(el.name);

    this.props.onProcessorOptionsChange(
      this.props.index,
      setProcessorEnabled(this.props.processorState, processor, el.checked),
    );
  };

  private onQuantizerOptionsChange = (opts: ProcessorOptions['quantize']) => {
    this.props.onProcessorOptionsChange(
      this.props.index,
      mergeProcessorOptions(this.props.processorState, 'quantize', opts),
    );
  };

  private onResizeOptionsChange = (opts: ProcessorOptions['resize']) => {
    this.props.onProcessorOptionsChange(
      this.props.index,
      mergeProcessorOptions(this.props.processorState, 'resize', opts),
    );
  };

  private onEncoderOptionsChange = (newOptions: EncoderOptions) => {
    this.props.onEncoderOptionsChange(this.props.index, newOptions);
  };

  private renderEncoderOptions(encoderState: EncoderState | undefined) {
    if (!encoderState) return null;

    switch (encoderState.type) {
      case 'avif':
        return (
          <encoderMap.avif.Options
            options={encoderState.options}
            onChange={this.onEncoderOptionsChange}
          />
        );
      case 'browserJPEG':
        return (
          <encoderMap.browserJPEG.Options
            options={encoderState.options}
            onChange={this.onEncoderOptionsChange}
          />
        );
      case 'jxl':
        return (
          <encoderMap.jxl.Options
            options={encoderState.options}
            onChange={this.onEncoderOptionsChange}
          />
        );
      case 'mozJPEG':
        return (
          <encoderMap.mozJPEG.Options
            options={encoderState.options}
            onChange={this.onEncoderOptionsChange}
          />
        );
      case 'oxiPNG':
        return (
          <encoderMap.oxiPNG.Options
            options={encoderState.options}
            onChange={this.onEncoderOptionsChange}
          />
        );
      case 'webP':
        return (
          <encoderMap.webP.Options
            options={encoderState.options}
            onChange={this.onEncoderOptionsChange}
          />
        );
      case 'wp2':
        return (
          <encoderMap.wp2.Options
            options={encoderState.options}
            onChange={this.onEncoderOptionsChange}
          />
        );
      case 'browserGIF':
      case 'browserPNG':
      case 'qoi':
        return null;
    }
  }

  private onCopyToOtherSideClick = () => {
    this.props.onCopyToOtherSideClick(this.props.index);
  };

  private onSaveSideSettingClick = () => {
    this.props.onSaveSideSettingsClick(this.props.index);
  };

  private onImportSideSettingsClick = () => {
    this.props.onImportSideSettingsClick(this.props.index);
  };

  render(
    { source, encoderState, processorState }: Props,
    { supportedEncoderMap }: State,
  ) {
    const canImportSavedSettings = canImportSavedSideSettings(
      this.state,
      this.props.index,
    );
    const resizeOptionsState = getResizeOptionsState(source);

    return (
      <div
        class={
          style.optionsScroller +
          ' ' +
          (encoderState ? '' : style.originalImage)
        }
      >
        <Expander>
          {!encoderState ? null : (
            <div>
              <h3 class={style.optionsTitle}>
                <div class={style.titleAndButtons}>
                  Edit
                  <button
                    class={style.copyOverButton}
                    title="Copy settings to other side"
                    onClick={this.onCopyToOtherSideClick}
                  >
                    <SwapIcon />
                  </button>
                  <button
                    class={style.saveButton}
                    title="Save side settings"
                    onClick={this.onSaveSideSettingClick}
                  >
                    <SaveIcon />
                  </button>
                  <button
                    class={
                      style.importButton +
                      (canImportSavedSettings ? '' : ` ${style.buttonOpacity}`)
                    }
                    title="Import saved side settings"
                    onClick={this.onImportSideSettingsClick}
                    disabled={!canImportSavedSettings}
                  >
                    <ImportIcon />
                  </button>
                </div>
              </h3>
              <label class={style.sectionEnabler}>
                Resize
                <Toggle
                  name="resize.enable"
                  checked={!!processorState.resize.enabled}
                  onChange={this.onProcessorEnabledChange}
                />
              </label>
              <Expander>
                {processorState.resize.enabled ? (
                  <ResizeOptionsComponent
                    isVector={resizeOptionsState.isVector}
                    inputWidth={resizeOptionsState.inputWidth}
                    inputHeight={resizeOptionsState.inputHeight}
                    options={processorState.resize}
                    onChange={this.onResizeOptionsChange}
                  />
                ) : null}
              </Expander>

              <label class={style.sectionEnabler}>
                Reduce palette
                <Toggle
                  name="quantize.enable"
                  checked={!!processorState.quantize.enabled}
                  onChange={this.onProcessorEnabledChange}
                />
              </label>
              <Expander>
                {processorState.quantize.enabled ? (
                  <QuantOptionsComponent
                    options={processorState.quantize}
                    onChange={this.onQuantizerOptionsChange}
                  />
                ) : null}
              </Expander>
            </div>
          )}
        </Expander>

        <h3 class={style.optionsTitle}>Compress</h3>

        <section class={`${style.optionOneCell} ${style.optionsSection}`}>
          {supportedEncoderMap ? (
            <Select
              value={getEncoderSelectValue(encoderState)}
              onChange={this.onEncoderTypeChange}
              large
            >
              <option value="identity">
                {getOriginalImageOptionLabel(source)}
              </option>
              {getEncoderSelectOptions(supportedEncoderMap).map((option) => (
                <option value={option.value}>{option.label}</option>
              ))}
            </Select>
          ) : (
            <Select large>
              <option>Loading…</option>
            </Select>
          )}
        </section>

        <Expander>{this.renderEncoderOptions(encoderState)}</Expander>
      </div>
    );
  }
}
