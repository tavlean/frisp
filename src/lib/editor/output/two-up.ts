// Ported from src/client/lazy-app/Compress/Output/custom-els/TwoUp/index.ts.
// Only change from the original: CSS-module class references become literal class
// names paired with the global two-up.css (Vite doesn't treat plain .css as
// modules), and the styles import is a normal side-effect import.
import PointerTracker, { type Pointer } from 'pointer-tracker';
import './two-up.css';

const legacyClipCompatAttr = 'legacy-clip-compat';
const orientationAttr = 'orientation';

type TwoUpOrientation = 'horizontal' | 'vertical';

/**
 * A split view that the user can adjust. The first child becomes the left-hand
 * side, and the second child becomes the right-hand side.
 */
export default class TwoUp extends HTMLElement {
  static get observedAttributes() {
    return [orientationAttr];
  }

  private readonly _handle = document.createElement('div');
  private _position = 0;
  private _relativePosition = 0.5;
  private _positionOnPointerStart = 0;
  private _everConnected = false;

  private readonly _childrenObserver = new MutationObserver(() =>
    this._childrenChange(),
  );
  private _resetPositionFrame = 0;
  private _resizeObserver?: ResizeObserver;

  constructor() {
    super();
    this._handle.className = 'two-up-handle';

    const pointerTracker: PointerTracker = new PointerTracker(this._handle, {
      start: (_pointer: Pointer, event: Event) => {
        if (pointerTracker.currentPointers.length === 1) return false;
        event.preventDefault();
        this._positionOnPointerStart = this._position;
        return true;
      },
      move: () => {
        this._pointerChange(
          pointerTracker.startPointers[0],
          pointerTracker.currentPointers[0],
        );
      },
    });
  }

  connectedCallback() {
    this._childrenObserver.observe(this, { childList: true });
    this._childrenChange();

    this._handle.innerHTML =
      `<div class="scrubber">` +
      `<svg viewBox="0 0 27 20">` +
      `<path class="arrow-left" d="M9.6 0L0 9.6l9.6 9.6z"/>` +
      `<path class="arrow-right" d="M17 19.2l9.5-9.6L16.9 0z"/>` +
      `</svg>` +
      `</div>`;

    this._resizeObserver = new ResizeObserver(() => this._resetPosition());
    this._resizeObserver.observe(this);

    window.addEventListener('keydown', this._onKeyDown);

    if (!this._everConnected) {
      this._resetPosition();
      this._everConnected = true;
    }
  }

  disconnectedCallback() {
    this._childrenObserver.disconnect();
    cancelAnimationFrame(this._resetPositionFrame);
    this._resetPositionFrame = 0;
    window.removeEventListener('keydown', this._onKeyDown);
    if (this._resizeObserver) this._resizeObserver.disconnect();
  }

  attributeChangedCallback(name: string) {
    if (name === orientationAttr) {
      this._resetPosition();
    }
  }

  private _onKeyDown = (event: KeyboardEvent) => {
    // This is a window-level shortcut, so scope it: only act when the key isn't
    // already handled, carries no modifier, and focus is either nowhere in
    // particular (document.body) or inside this viewer. Otherwise pressing "2"
    // while a toolbar button/select is focused would silently recentre the split.
    if (event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target;
    if (target !== document.body && !this.contains(target as Node | null))
      return;
    if (target instanceof HTMLElement && target.closest('input')) return;

    if (event.code === 'Digit1' || event.code === 'Numpad1') {
      this._position = 0;
      this._relativePosition = 0;
      this._setPosition();
    } else if (event.code === 'Digit2' || event.code === 'Numpad2') {
      this.centerSplit();
    } else if (event.code === 'Digit3' || event.code === 'Numpad3') {
      const dimensionAxis =
        this.orientation === 'vertical' ? 'height' : 'width';
      const bounds = this.getBoundingClientRect();

      this._position = bounds[dimensionAxis];
      this._relativePosition = this._position / bounds[dimensionAxis];
      this._setPosition();
    }
  };

  private _resetPosition() {
    cancelAnimationFrame(this._resetPositionFrame);
    this._resetPositionFrame = requestAnimationFrame(() => {
      this._resetPositionFrame = 0;
      const bounds = this.getBoundingClientRect();
      const dimensionAxis =
        this.orientation === 'vertical' ? 'height' : 'width';
      this._position = bounds[dimensionAxis] * this._relativePosition;
      this._setPosition();
    });
  }

  get legacyClipCompat() {
    return this.hasAttribute(legacyClipCompatAttr);
  }

  set legacyClipCompat(val: boolean) {
    if (val) {
      this.setAttribute(legacyClipCompatAttr, '');
    } else {
      this.removeAttribute(legacyClipCompatAttr);
    }
  }

  get orientation(): TwoUpOrientation {
    const value = this.getAttribute(orientationAttr);
    if (value && value.toLowerCase() === 'vertical') return 'vertical';
    return 'horizontal';
  }

  set orientation(val: TwoUpOrientation) {
    this.setAttribute(orientationAttr, val);
  }

  /** Divider position as a fraction of the split axis (0 = left/top, 1 = right/bottom; 0.5 = centred). */
  get splitFraction() {
    return this._relativePosition;
  }

  /**
   * Recentre the divider (50%). Public counterpart to the keyboard "2" shortcut,
   * used by the editor's "reset view" control.
   */
  centerSplit() {
    const dimensionAxis = this.orientation === 'vertical' ? 'height' : 'width';
    const bounds = this.getBoundingClientRect();
    this._relativePosition = 0.5;
    this._position = bounds[dimensionAxis] / 2;
    this._setPosition();
  }

  private _childrenChange() {
    // Ensure the handle is the last child. The CSS depends on this.
    if (this.lastElementChild !== this._handle) {
      this.appendChild(this._handle);
    }
  }

  private _pointerChange(startPoint: Pointer, currentPoint: Pointer) {
    const pointAxis = this.orientation === 'vertical' ? 'clientY' : 'clientX';
    const dimensionAxis = this.orientation === 'vertical' ? 'height' : 'width';
    const bounds = this.getBoundingClientRect();

    this._position =
      this._positionOnPointerStart +
      (currentPoint[pointAxis] - startPoint[pointAxis]);

    this._position = Math.max(
      0,
      Math.min(this._position, bounds[dimensionAxis]),
    );
    this._relativePosition = this._position / bounds[dimensionAxis];
    this._setPosition();
  }

  private _setPosition() {
    this.style.setProperty('--split-point', `${this._position}px`);
    // Notify listeners (e.g. the editor's reset-view affordance) that the
    // divider moved. Fires on drag, keyboard shortcuts, resize and centerSplit().
    this.dispatchEvent(new Event('splitchange', { bubbles: true }));
  }
}

// Guard the registration: a bare define() throws NotSupportedError when the
// module is re-evaluated (e.g. Vite HMR), which breaks hot updates in dev.
if (!customElements.get('two-up')) {
  customElements.define('two-up', TwoUp);
}
