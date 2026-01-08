// ======== Constants ========
const MODE = {
    OFF: 'Off',
    LOCK: '🔒',
    IMAGE: '🖼️'
};

const ORIENTATION = {
    PORTRAIT: 'portrait',
    LANDSCAPE: 'landscape',
    SQUARE: 'square'
};

const IMAGE_INPUT_IDS = [
    'img2img_image',
    'img2img_sketch',
    'img2maskimg',
    'inpaint_sketch',
    'img_inpaint_base'
];


// ======== Get dimension settings ========
const getDimensionSettings = () => {
    const source = opts?.arp_settings_source || 'UI Settings';
    const min_val = source === 'UI Settings'
        ? (opts?.arp_ui_min_hidden || 64)
        : (opts?.arp_min_dimension || 64);
    const max_val = source === 'UI Settings'
        ? (opts?.arp_ui_max_hidden || 2048)
        : (opts?.arp_max_dimension || 2048);

    return {
        MIN: Math.round(min_val),
        MAX: Math.round(max_val)
    };
};


// ======== Utility functions ========
const round8 = (n) => Math.round(Number(n) / 8) * 8;
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

const clampToBoundaries = (w, h) => {
    const { MIN, MAX } = getDimensionSettings();
    return [clamp(w, MIN, MAX), clamp(h, MIN, MAX)];
};

const parseRatio = (ratioStr) => {
    if (!ratioStr || !ratioStr.includes(':')) return null;
    const [w, h] = ratioStr.split(':').map(Number);
    return (w && h) ? { w, h, value: w / h } : null;
};

const reverseRatio = (ratioStr) => {
    const parsed = parseRatio(ratioStr);
    return parsed ? `${parsed.h}:${parsed.w}` : ratioStr;
};

const getOrientation = (width, height) => {
    if (width === height) return ORIENTATION.SQUARE;
    return width > height ? ORIENTATION.LANDSCAPE : ORIENTATION.PORTRAIT;
};

const getMaxForRatio = (ratio, isWidth) => {
    const { MAX } = getDimensionSettings();
    if (!ratio) return MAX;
    const multiplier = isWidth ? ratio : (1 / ratio);
    return Math.min(MAX, MAX * multiplier);
};

const getAvailableRatios = () => {
    return opts.arp_aspect_ratio
        .split(',')
        .map(r => r.trim())
        .filter(Boolean);
};

const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
const simplifyRatio = (w, h) => {
    const divisor = gcd(w, h);
    return `${w / divisor}:${h / divisor}`;
};

const normalizeRatio = (ratioStr) => {
    const parsed = parseRatio(ratioStr);
    if (!parsed) return ratioStr;

    // Always return in ascending order (smaller:larger)
    return parsed.w <= parsed.h
        ? `${parsed.w}:${parsed.h}`
        : `${parsed.h}:${parsed.w}`;
};

const ratioExists = (targetRatio, availableRatios) => {
    const normalized = normalizeRatio(targetRatio);

    return availableRatios.some(ratio => {
        return normalizeRatio(ratio) === normalized;
    });
};

const parsePresets = (text) => {
    const autoLabel = !!opts?.arp_presets_autolabel;
    const lines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));

    const sections = [];
    let current = null;

    for (const line of lines) {
        if (line.startsWith('>')) {
            if (current) sections.push(current);
            current = { label: line.slice(1).trim(), presets: [] };
        } else if (/^\d+\s*x\s*\d+$/i.test(line)) {
            const [w, h] = line.split(/\s*x\s*/i).map(Number);
            if (!current) {
                current = { label: autoLabel ? 'Others' : '', presets: [] };
            }
            current.presets.push({ width: w, height: h });
        }
    }

    if (current) sections.push(current);
    return sections;
};


// ======== Slider Controller ========
class SliderController {
    constructor(element, isWidth) {
        this.inputs = [...element.querySelectorAll('input')];
        this.isWidth = isWidth;
        this.inputs.forEach(inp => inp.isWidth = isWidth);
        this.numberInput = this.inputs.find(i => i.type === 'number');
    }

    getValue()      { return Number(this.numberInput.value); }
    setValue(value) { this.inputs.forEach(i => i.value = round8(value)); }
    trigger(event)  { this.numberInput.dispatchEvent(event); }
    setMinMax(MIN, MAX) { this.inputs.forEach(i => (i.min = MIN, i.max = MAX)); }
}


// ======== Ratio Select Controller ========
class RatioSelectController {
    constructor(page, defaultModes, onChange) {
        this.page = page;
        this.onChange = onChange;
        this.defaultModes = defaultModes;
        this.options = [...new Set([...defaultModes, ...getAvailableRatios()])];
        this.element = null;
        this.select = null;
        this.tempRatio = null;
    }

    build() {
        const wrapper = document.createElement('div');
        wrapper.id = `${this.page}_ratio`;

        const select = document.createElement('select');
        select.id = `${this.page}_select_aspect_ratio`;
        select.title = 'Aspect Ratio';
        select.innerHTML = this.options
            .map(opt => `<option class="ar-option" value="${opt}">${opt}</option>`)
            .join('');

        select.addEventListener('change', () => this.handleChange());

        wrapper.appendChild(select);
        this.element = wrapper;
        this.select = select;

        return wrapper;
    }

    handleChange() {
        const value = this.getValue();

        // Remove temp ratio if switching to non-temp option
        if (this.tempRatio && value !== this.tempRatio) {
            this.removeTempRatio();
        }

        this.onChange?.(value);
    }

    getValue() { return this.select?.value || MODE.OFF; }

    setValue(value) {
        if (this.select) {
            this.select.value = value;
            this.onChange?.(value);
        }
    }

    addTempRatio(width, height) {
        if (!this.select) return;

        const ratio = simplifyRatio(width, height);
        const targetOrientation = getOrientation(width, height);

        // IMPORTANT: First, remove the temporary option to get a clean list.
        this.removeTempRatio();

        // Get the current list of options from select (without temp)
        const availableRatios = [...this.select.options]
            .map(opt => opt.value)
            .filter(val => !this.defaultModes.includes(val));

        // Check if ratio already exists (considering orientation)
        if (ratioExists(ratio, availableRatios)) {
            const normalizedTarget = normalizeRatio(ratio);

            // Find the matching ratio
            for (const existingRatio of availableRatios) {
                const normalizedExisting = normalizeRatio(existingRatio);

                if (normalizedExisting === normalizedTarget) {
                    const existingParsed = parseRatio(existingRatio);
                    const existingOrientation = existingParsed.w > existingParsed.h
                        ? ORIENTATION.LANDSCAPE
                        : (existingParsed.w < existingParsed.h ? ORIENTATION.PORTRAIT : ORIENTATION.SQUARE);

                    // If orientations match, use as is
                    if (existingOrientation === targetOrientation || targetOrientation === ORIENTATION.SQUARE) {
                        // Directly set value and trigger change
                        this.select.value = existingRatio;
                        const event = new Event('change', { bubbles: true });
                        this.select.dispatchEvent(event);
                        return;
                    } else {
                        // Orientations don't match - need to reverse all options
                        this.reverseAllOptions();

                        // After reversing, the ratio we want should now match orientation
                        const reversedRatio = reverseRatio(existingRatio);
                        this.select.value = reversedRatio;
                        const event = new Event('change', { bubbles: true });
                        this.select.dispatchEvent(event);
                        return;
                    }
                }
            }
            return;
        }

        // Ratio doesn't exist - create temp option
        const ratioParsed = parseRatio(ratio);

        let displayRatio;
        if (targetOrientation === ORIENTATION.LANDSCAPE && ratioParsed.w < ratioParsed.h) {
            displayRatio = `${ratioParsed.h}:${ratioParsed.w}`;
        } else if (targetOrientation === ORIENTATION.PORTRAIT && ratioParsed.w > ratioParsed.h) {
            displayRatio = `${ratioParsed.h}:${ratioParsed.w}`;
        } else {
            displayRatio = ratio;
        }

        this.tempRatio = displayRatio;

        // Add temp option after default modes
        const tempOption = document.createElement('option');
        tempOption.className = 'ar-option ar-option-temp';
        tempOption.value = displayRatio;
        tempOption.textContent = displayRatio;

        const options = [...this.select.options];
        const insertIndex = this.defaultModes.length;

        if (insertIndex < options.length) {
            this.select.insertBefore(tempOption, options[insertIndex]);
        } else {
            this.select.appendChild(tempOption);
        }

        // Add highlight class to select
        this.select.classList.add('ar-select-temp-active');

        // Set and trigger change
        this.select.value = displayRatio;
        const event = new Event('change', { bubbles: true });
        this.select.dispatchEvent(event);
    }

    removeTempRatio() {
        if (!this.select || !this.tempRatio) return;

        const tempOption = this.select.querySelector('.ar-option-temp');
        if (tempOption) {
            // If temp ratio was selected, switch to OFF
            if (this.getValue() === this.tempRatio) {
                this.select.value = MODE.OFF;
            }
            tempOption.remove();
        }

        // Remove highlight class
        this.select.classList.remove('ar-select-temp-active');

        this.tempRatio = null;
    }

    reverseAllOptions() {
        this.select?.querySelectorAll('.ar-option').forEach(opt => {
            const reversed = reverseRatio(opt.value);
            if (reversed !== opt.value) {
                opt.value = reversed;
                opt.textContent = reversed;
            }
        });

        // Update temp ratio reference if exists
        if (this.tempRatio) {
            this.tempRatio = reverseRatio(this.tempRatio);
        }
    }
}


// ======== Presets Popup Controller ========
class PresetsPopupController {
    constructor(page, onApply) {
        this.page = page;
        this.onApply = onApply;
        this.popup = null;
        this.outsideClickHandler = this.handleOutsideClick.bind(this);
        this.escKeyHandler = this.handleEscKey.bind(this);
    }

    show(buttonElement) {
        if (this.popup) {
            this.close();
            return;
        }

        const presets = parsePresets(opts.arp_presets || '');
        const columns = clamp(Number(opts?.arp_presets_columns || 2), 1, 4);

        this.popup = this.buildPopup(presets, columns);
        const parent = buttonElement.offsetParent || document.body;
        parent.appendChild(this.popup);

        this.position(buttonElement);

        requestAnimationFrame(() => {
            this.popup.style.opacity = '1';
            this.popup.style.pointerEvents = 'auto';
        });

        setTimeout(() => {
            document.addEventListener('click', this.outsideClickHandler);
            document.addEventListener('keydown', this.escKeyHandler);
        }, 0);
    }

    buildPopup(presets, columns) {
        const popup = document.createElement('div');
        popup.className = 'arp-presets-popup';
        popup.style.opacity = '0';
        popup.style.pointerEvents = 'none';

        popup.appendChild(this.createHeader());
        popup.appendChild(this.createContent(presets, columns));

        return popup;
    }

    createHeader() {
        const header = document.createElement('div');
        header.className = 'arp-presets-header';

        const title = document.createElement('div');
        title.className = 'arp-presets-title';
        title.textContent = 'Dimension Presets';

        const buttons = document.createElement('div');
        buttons.className = 'arp-header-buttons';

        const settingsBtn = this.createButton(
            'arp-presets-settings',
            'Open Settings',
            '<svg viewBox="0 0 24 24"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></svg>',
            () => this.openSettings()
        );

        const closeBtn = this.createButton(
            'arp-presets-close',
            'Close',
            '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
            () => this.close()
        );

        buttons.appendChild(settingsBtn);
        buttons.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(buttons);

        return header;
    }

    createButton(className, title, svg, onClick) {
        const btn = document.createElement('button');
        btn.className = className;
        btn.title = title;
        btn.innerHTML = svg;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
        });
        return btn;
    }

    createContent(presets, columns) {
        const content = document.createElement('div');
        content.className = 'arp-presets-content';

        presets.forEach(section => {
            if (!section.presets?.length) return;

            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'arp-presets-section';

            if (section.label) {
                const label = document.createElement('div');
                label.className = 'arp-presets-section-label';
                label.textContent = section.label;
                sectionDiv.appendChild(label);
            }

            const grid = document.createElement('div');
            grid.className = 'arp-presets-grid';
            grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

            section.presets.forEach(preset => {
                const btn = document.createElement('button');
                btn.className = 'arp-preset-btn';
                btn.textContent = `${preset.width} × ${preset.height}`;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.onApply(preset.width, preset.height);
                    this.close();
                });
                grid.appendChild(btn);
            });

            sectionDiv.appendChild(grid);
            content.appendChild(sectionDiv);
        });

        return content;
    }

    position(buttonElement) {
        const rect = buttonElement.getBoundingClientRect();
        const parentRect = (buttonElement.offsetParent || document.body).getBoundingClientRect();
        const popupRect = this.popup.getBoundingClientRect();

        let left = rect.right - parentRect.left + 8;
        let top = rect.top - parentRect.top;

        // Adjust if overflow
        if (rect.right + popupRect.width > window.innerWidth - 8) {
            left = rect.left - parentRect.left - popupRect.width - 8;
        }
        if (rect.top + popupRect.height > window.innerHeight - 8) {
            top = rect.bottom - parentRect.top - popupRect.height;
        }

        this.popup.style.left = `${Math.round(left)}px`;
        this.popup.style.top = `${Math.round(top)}px`;
    }

    close() {
        if (this.popup) {
            this.popup.remove();
            this.popup = null;
            document.removeEventListener('click', this.outsideClickHandler);
            document.removeEventListener('keydown', this.escKeyHandler);
        }
    }

    handleOutsideClick(e) {
        if (this.popup &&
            !this.popup.contains(e.target) &&
            !e.target.closest(`#${this.page}_presets_btn`)) {
            this.close();
        }
    }

    handleEscKey(e) {
        if (e.key === 'Escape') {
            this.close();
        }
    }

    openSettings() {
        const settingsTab = Array.from(gradioApp().querySelectorAll('#tabs > .tab-nav button'))
            .find(btn => btn.textContent.trim() === 'Settings');

        if (settingsTab) {
            settingsTab.click();
            setTimeout(() => {
                const arpSection = Array.from(gradioApp().querySelectorAll('#tab_settings #settings .tab-nav button'))
                    .find(btn => btn.textContent.trim() === 'Aspect Ratio+');
                arpSection?.click();
            }, 100);
        }
        this.close();
    }
}


// ======== Presets Button Controller ========
class PresetsButtonController {
    constructor(page, onApply) {
        this.page = page;
        this.element = null;
        this.popupCtrl = new PresetsPopupController(page, onApply);
    }

    build() {
        const wrapper = document.createElement('div');
        wrapper.id = `${this.page}_presets_box`;

        const btn = document.createElement('button');
        btn.id = `${this.page}_presets_btn`;
        btn.title = 'Dimension Presets';
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="8" height="8" rx="1"/>
                <rect x="13" y="3" width="8" height="8" rx="1"/>
                <rect x="3" y="13" width="8" height="8" rx="1"/>
                <rect x="13" y="13" width="8" height="8" rx="1"/>
            </svg>
        `;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.popupCtrl.show(btn);
        });

        wrapper.appendChild(btn);
        this.element = wrapper;

        return wrapper;
    }
}


// ======== Swap Button Controller ========
class SwapButtonController {
    constructor(page, onSwap) {
        this.page = page;
        this.onSwap = onSwap;
        this.element = null;
    }

    build() {
        const original = gradioApp().getElementById(`${this.page}_res_switch_btn`);
        const btn = original.cloneNode(true);
        btn.id = `${this.page}_res_switch_btn`;
        btn.addEventListener('click', () => this.onSwap());

        this.element = btn;
        return btn;
    }

    setEnabled(enabled) {
        if (this.element) {
            this.element.disabled = !enabled;
        }
    }
}


// ======== Toolbox Controller ========
class ToolboxController {
    constructor(page, aspectRatioCtrl) {
        this.page = page;
        this.aspectRatioCtrl = aspectRatioCtrl;
        this.wrapper = null;
    }

    build(defaultModes) {
        const originalSwapBtn = gradioApp().getElementById(`${this.page}_res_switch_btn`);

        this.wrapper = document.createElement('div');
        this.wrapper.id = `${this.page}_size_toolbox`;

        // 1. Ratio Select (if enabled)
        if (opts?.arp_aspect_ratio_show) {
            this.aspectRatioCtrl.ratioSelectCtrl = new RatioSelectController(
                this.page,
                defaultModes,
                (mode) => this.aspectRatioCtrl.handleModeChange(mode)
            );
            this.wrapper.appendChild(this.aspectRatioCtrl.ratioSelectCtrl.build());
        }

        // 2. Presets Button (based on settings)
        const presetsMode = opts?.arp_presets_show || 'Only txt2img';
        const showPresets =
            presetsMode === 'txt2img & img2img' ||
            (presetsMode === 'Only txt2img' && this.page === 'txt2img');

        if (showPresets) {
            this.aspectRatioCtrl.presetsButtonCtrl = new PresetsButtonController(
                this.page,
                (w, h) => this.aspectRatioCtrl.applyPreset(w, h)
            );
            this.wrapper.appendChild(this.aspectRatioCtrl.presetsButtonCtrl.build());
        }

        // 3. Swap Button (always)
        this.aspectRatioCtrl.swapButtonCtrl = new SwapButtonController(
            this.page,
            () => this.aspectRatioCtrl.handleSwap()
        );
        this.wrapper.appendChild(this.aspectRatioCtrl.swapButtonCtrl.build());

        // 4. Detect Size Button (img2img only)
        if (this.page === 'img2img') {
            const detectSizeBtn = gradioApp().getElementById('img2img_detect_image_size_btn');
            if (detectSizeBtn) {
                this.wrapper.appendChild(detectSizeBtn);
            }
        }

        originalSwapBtn.replaceWith(this.wrapper);

        return this.wrapper;
    }
}


// ======== Aspect Ratio Controller ========
class AspectRatioController {
    constructor(page, widthEl, heightEl, defaultModes) {
        // Mark elements for identification
        widthEl.isWidth = true;
        heightEl.isWidth = false;

        this.page = page;
        this.width = new SliderController(widthEl, true);
        this.height = new SliderController(heightEl, false);

        this.currentMode = MODE.OFF;
        this.currentRatio = null;
        this.orientation = null;

        // Controllers (will be set by ToolboxController)
        this.ratioSelectCtrl = null;
        this.presetsButtonCtrl = null;
        this.swapButtonCtrl = null;

        // Apply dimension settings to sliders
        this.updateSliderLimits();

        // Attach event listeners
        this.attachListeners();

        // Build UI controls
        const toolboxCtrl = new ToolboxController(page, this);
        toolboxCtrl.build(defaultModes);
    }

    updateSliderLimits() {
        const { MIN, MAX } = getDimensionSettings();
        this.width.setMinMax(MIN, MAX);
        this.height.setMinMax(MIN, MAX);
    }

    attachListeners() {
        const inputs = [...this.width.inputs, ...this.height.inputs];
        inputs.forEach(inp => {
            inp.addEventListener('change', (e) => {
                this.applyAspectRatio(e.target);
            });
        });
    }

    handleModeChange(mode) {
        this.currentMode = mode;

        // OFF mode - no ratio constraints
        if (mode === MODE.OFF) {
            this.currentRatio = null;
            this.orientation = null;
            return;
        }

        // IMAGE mode - use loaded image ratio (img2img only)
        if (mode === MODE.IMAGE && this.page === 'img2img') {
            this.swapButtonCtrl?.setEnabled(false);
            this.applyImageRatio();
            return;
        }

        // LOCK mode - lock current dimensions ratio
        if (mode === MODE.LOCK) {
            this.swapButtonCtrl?.setEnabled(true);
            this.currentRatio = this.width.getValue() / this.height.getValue();
        } else {
            // Custom ratio (including temp ratio)
            this.swapButtonCtrl?.setEnabled(true);

            const parsed = parseRatio(mode);
            if (parsed) {
                this.currentRatio = parsed.value;
            }
        }

        this.orientation = getOrientation(this.width.getValue(), this.height.getValue());
        this.applyAspectRatio();
    }

    applyImageRatio() {
        const img = this.getCurrentImage();
        if (img) {
            const w = img.naturalWidth || 1;
            const h = img.naturalHeight || 1;
            this.currentRatio = w / h;
            this.orientation = getOrientation(w, h);
            this.applyAspectRatio();
        }
    }

    getCurrentImage() {
        if (this.page !== 'img2img') return null;

        const mode = gradioApp().getElementById('mode_img2img');
        const selected = mode.querySelector('button.selected');
        const index = [...mode.querySelectorAll('button')].indexOf(selected);
        const containerId = IMAGE_INPUT_IDS[index];

        return document.getElementById(containerId)?.querySelector('img');
    }

    applyAspectRatio(changedInput = null) {
        if (this.currentMode === MODE.OFF || !this.currentRatio) return;

        let w = this.width.getValue();
        let h = this.height.getValue();

        if (!changedInput) {
            // Initial setup: maintain max dimension
            const maxDim = Math.max(w, h);
            if (this.currentRatio >= 1) {
                w = maxDim;
                h = maxDim / this.currentRatio;
            } else {
                h = maxDim;
                w = maxDim * this.currentRatio;
            }
        } else {
            const isWidth = changedInput.isWidth;
            const value = Number(changedInput.value);

            // Apply ratio limits if enabled
            const applyLimit = opts?.arp_aspect_ratio_limit ?? true;
            const maxAllowed = applyLimit
                ? getMaxForRatio(this.currentRatio, isWidth)
                : getDimensionSettings().MAX;

            if (isWidth) {
                w = Math.min(value, maxAllowed);
                h = w / this.currentRatio;
            } else {
                h = Math.min(value, maxAllowed);
                w = h * this.currentRatio;
            }
        }

        const [W, H] = clampToBoundaries(w, h);

        this.width.setValue(W);
        this.height.setValue(H);

        const event = new Event('input', { bubbles: true });
        this.width.trigger(event);
        this.height.trigger(event);

        // Legacy compatibility for other extensions
        if (typeof dimensionChange === 'function') {
            [...this.width.inputs, ...this.height.inputs].forEach(inp => {
                dimensionChange({ target: inp }, inp.isWidth, !inp.isWidth);
            });
        }
    }

    applyPreset(width, height) {
        const autoRatio = opts?.arp_presets_auto_ratio ?? false;

        // First, set dimensions
        this.width.setValue(width);
        this.height.setValue(height);

        const event = new Event('input', { bubbles: true });
        this.width.trigger(event);
        this.height.trigger(event);

        // Then handle ratio
        if (autoRatio && this.ratioSelectCtrl) {
            // Add or match temp ratio with proper orientation handling
            this.ratioSelectCtrl.addTempRatio(width, height);
        } else {
            // Turn off ratio mode and remove any temp ratio
            if (this.ratioSelectCtrl) {
                this.ratioSelectCtrl.removeTempRatio();
                this.ratioSelectCtrl.setValue(MODE.OFF);
            }
        }
    }

    handleSwap() {
        const w = this.width.getValue();
        const h = this.height.getValue();

        this.width.setValue(h);
        this.height.setValue(w);

        // Reverse ratio display in select
        if (this.ratioSelectCtrl) {
            this.ratioSelectCtrl.reverseAllOptions();
        }

        // Update internal ratio
        if (this.currentRatio) {
            this.currentRatio = 1 / this.currentRatio;
        }

        // Swap orientation
        if (this.orientation === ORIENTATION.PORTRAIT) {
            this.orientation = ORIENTATION.LANDSCAPE;
        } else if (this.orientation === ORIENTATION.LANDSCAPE) {
            this.orientation = ORIENTATION.PORTRAIT;
        }

        const event = new Event('input', { bubbles: true });
        this.width.trigger(event);
        this.height.trigger(event);
    }

    static observeAndInit(storageKey, page, defaultModes, postSetup = null) {
        const observer = new MutationObserver(() => {
            const widthEl = gradioApp().querySelector(`#${page}_width`);
            const heightEl = gradioApp().querySelector(`#${page}_height`);

            if (widthEl && heightEl && opts?.arp_aspect_ratio_show !== undefined) {
                observer.disconnect();

                const controller = new AspectRatioController(page, widthEl, heightEl, defaultModes);
                postSetup?.(controller);
                window[storageKey] = controller;
            }
        });

        observer.observe(gradioApp(), { childList: true, subtree: true });
    }
}


// ======== Helpers for img2img ========
const setupImg2ImgImageHandlers = (controller) => {
    // Handle image upload/drop for IMAGE mode
    const handleImageLoad = (e) => {
        if (controller.ratioSelectCtrl?.getValue() !== MODE.IMAGE) return;

        const file = (e.dataTransfer || e.target).files?.[0];
        if (!file) return;

        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;
            controller.currentRatio = ratio;
            controller.orientation = getOrientation(img.naturalWidth, img.naturalHeight);
            controller.applyAspectRatio();
            URL.revokeObjectURL(img.src);
        };
    };

    IMAGE_INPUT_IDS.forEach(id => {
        const container = document.getElementById(id);
        if (!container) return;

        const input = container.querySelector('input');
        if (input) {
            input.parentElement.addEventListener('drop', handleImageLoad);
            input.addEventListener('change', handleImageLoad);
        }
    });

    // Tab switch listeners for img2img
    const addTabSwitchListeners = () => {
        document
            .querySelectorAll('#img2img_settings button:not(.selected):not(.hasTabSwitchListener)')
            .forEach(btn => {
                btn.addEventListener('click', () => {
                    if (controller.ratioSelectCtrl?.getValue() === MODE.IMAGE) {
                        controller.applyImageRatio();
                    }
                    addTabSwitchListeners();
                });
                btn.classList.add('hasTabSwitchListener');
            });
    };
    addTabSwitchListeners();
};


// ======== Init ========
onUiLoaded(() => {
    AspectRatioController.observeAndInit(
        '__txt2imgAspectRatioController',
        'txt2img',
        [MODE.OFF, MODE.LOCK]
    );

    AspectRatioController.observeAndInit(
        '__img2imgAspectRatioController',
        'img2img',
        [MODE.OFF, MODE.LOCK, MODE.IMAGE],
        setupImg2ImgImageHandlers
    );
});