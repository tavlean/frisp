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
import { getSupportedEncoderMap } from './encoder-support';
import {
  getInitialOptionsState,
  getSupportedEncoderMapLoadedState,
  type OptionsState,
} from './state';
import { getEncoderSelectOptions } from './encoder-select-state';
import { getSavedSideSettingsAvailabilityUpdate } from './saved-settings-state';
import {
  getProcessorStateWithEnabledControl,
  getProcessorStateWithOptions,
} from './processor-controls-state';
import { getOptionsRenderState } from './render-state';

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

type State = OptionsState;

const supportedEncoderMapP = getSupportedEncoderMap();

export default class Options extends Component<Props, State> {
  state: State = getInitialOptionsState();
  private isUnmounted = false;

  constructor() {
    super();
    supportedEncoderMapP.then((supportedEncoderMap) => {
      if (this.isUnmounted) return;
      this.setState(getSupportedEncoderMapLoadedState(supportedEncoderMap));
    });
  }

  private setLeftSideSettings = () => {
    this.setState(getSavedSideSettingsAvailabilityUpdate('leftSideSettings'));
  };

  private setRightSideSettings = () => {
    this.setState(getSavedSideSettingsAvailabilityUpdate('rightSideSettings'));
  };

  componentDidMount(): void {
    // Changing the state when side setting is stored in localstorage
    window.addEventListener('leftSideSettings', this.setLeftSideSettings);
    window.addEventListener('rightSideSettings', this.setRightSideSettings);
  }

  componentWillUnmount(): void {
    this.isUnmounted = true;
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

    this.props.onProcessorOptionsChange(
      this.props.index,
      getProcessorStateWithEnabledControl(
        this.props.processorState,
        el.name,
        el.checked,
      ),
    );
  };

  private onQuantizerOptionsChange = (opts: ProcessorOptions['quantize']) => {
    this.props.onProcessorOptionsChange(
      this.props.index,
      getProcessorStateWithOptions(this.props.processorState, 'quantize', opts),
    );
  };

  private onResizeOptionsChange = (opts: ProcessorOptions['resize']) => {
    this.props.onProcessorOptionsChange(
      this.props.index,
      getProcessorStateWithOptions(this.props.processorState, 'resize', opts),
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
    const renderState = getOptionsRenderState({
      index: this.props.index,
      source,
      encoderState,
      processorState,
      savedSideSettingsAvailability: this.state,
    });

    return (
      <div
        class={
          style.optionsScroller +
          ' ' +
          (renderState.isOriginalImage ? style.originalImage : '')
        }
      >
        <Expander>
          {renderState.isOriginalImage ? null : (
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
                      (renderState.canImportSavedSettings
                        ? ''
                        : ` ${style.buttonOpacity}`)
                    }
                    title="Import saved side settings"
                    onClick={this.onImportSideSettingsClick}
                    disabled={!renderState.canImportSavedSettings}
                  >
                    <ImportIcon />
                  </button>
                </div>
              </h3>
              <label class={style.sectionEnabler}>
                Resize
                <Toggle
                  name="resize.enable"
                  checked={renderState.resizeEnabled}
                  onChange={this.onProcessorEnabledChange}
                />
              </label>
              <Expander>
                {renderState.resizeEnabled ? (
                  <ResizeOptionsComponent
                    isVector={renderState.resizeOptionsState.isVector}
                    inputWidth={renderState.resizeOptionsState.inputWidth}
                    inputHeight={renderState.resizeOptionsState.inputHeight}
                    options={processorState.resize}
                    onChange={this.onResizeOptionsChange}
                  />
                ) : null}
              </Expander>

              <label class={style.sectionEnabler}>
                Reduce palette
                <Toggle
                  name="quantize.enable"
                  checked={renderState.quantizeEnabled}
                  onChange={this.onProcessorEnabledChange}
                />
              </label>
              <Expander>
                {renderState.quantizeEnabled ? (
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
              value={renderState.encoderSelectValue}
              onChange={this.onEncoderTypeChange}
              large
            >
              <option value="identity">
                {renderState.originalImageOptionLabel}
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
