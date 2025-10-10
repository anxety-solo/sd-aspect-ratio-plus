// Constants
const _OFF   = 'Off';
const _LOCK  = '🔒';
const _IMAGE = '🖼️';
const _MAX   = 2048;
const _MIN   = 64;

const _IMAGE_INPUT_CONTAINER_IDS = [
    'img2img_image',
    'img2img_sketch',
    'img2maskimg',
    'inpaint_sketch',
    'img_inpaint_base'
];

// ====== Utility functions ======
const getSelectedImage2ImageTab = () => {
    const mode = gradioApp().getElementById('mode_img2img');
    const selected = mode.querySelector('button.selected');
    return [...mode.querySelectorAll('button')].indexOf(selected);
};

const getCurrentImage = () => {
    const id = _IMAGE_INPUT_CONTAINER_IDS[getSelectedImage2ImageTab()];
    return document.getElementById(id).querySelector('img');
};

const round8 = (n) => Math.round(Number(n) / 8) * 8;
const aspectRatioFromStr = (ar) => ar.includes(':') && ar.split(':').map(Number);
const reverseAspectRatio = (ar) => ar.includes(':') && ar.split(':').reverse().join(':');

const getMaxAllowedValue = (aspectRatio, isWidth) => {
    if (!aspectRatio || aspectRatio === _OFF) return _MAX;
    const aspect = aspectRatio;
    const ratio = isWidth ? aspect : 1 / aspect;
    return Math.min(_MAX, _MAX * ratio);
};

const clampToBoundaries = (w, h) => {
    w = Math.min(Math.max(w, _MIN), _MAX);
    h = Math.min(Math.max(h, _MIN), _MAX);
    return [w, h];
};

const getOptions = () =>
    window.opts.arp_aspect_ratio.split(',').map((o) => o.trim());

const reverseAllOptions = () => {
    document.querySelectorAll('.ar-option').forEach((el) => {
        const rev = reverseAspectRatio(el.value);
        if (rev) {
            el.value = rev;
            el.textContent = rev;
        }
    });
};

// ====== Presets Parser & Popup Controller ======

const parsePresets = (presetsText) => {
    const autoLabel = !!window.opts?.arp_presets_autolabel;
    const lines = presetsText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));

    const sections = [];
    let current = null;

    for (const line of lines) {
        if (line.startsWith('>')) {
            if (current) sections.push(current);
            current = { label: line.slice(1).trim(), presets: [] };
        } else if (/^\d+\s*x\s*\d+$/i.test(line)) {
            const [w, h] = line.split(/\s*x\s*/i).map(Number);
            if (!current) {
                current = {
                    label: autoLabel ? 'Others' : '',
                    presets: [],
                };
            }
            current.presets.push({ width: w, height: h });
        }
    }

    if (current) sections.push(current);
    return sections;
};

class PresetsPopupController {
    constructor(page, ctrl) {
        this.page = page;
        this.ctrl = ctrl;
        this.popup = null;
    }

    show(buttonElement) {
        if (this.popup) {
            this.close();
            return;
        }

        const presets = parsePresets(window.opts.arp_presets || '');
        const columns = Math.min(Math.max(1, Number(window.opts?.arp_presets_columns || 2)), 4);

        this.popup = document.createElement('div');
        this.popup.className = 'arp-presets-popup';
        this.popup.style.opacity = '0';
        this.popup.style.pointerEvents = 'none';

        // attach relative to the same parent as button
        const parent = buttonElement.offsetParent || document.body;
        parent.appendChild(this.popup);

        // Header
        const header = document.createElement('div');
        header.className = 'arp-presets-header';
        const title = document.createElement('div');
        title.className = 'arp-presets-title';
        title.textContent = 'Dimension Presets';
        const headerButtons = document.createElement('div');
        headerButtons.className = 'arp-header-buttons';

        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'arp-presets-settings';
        settingsBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></svg>`;
        settingsBtn.title = 'Open Settings';
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openSettings();
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'arp-presets-close';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
        });

        headerButtons.appendChild(settingsBtn);
        headerButtons.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(headerButtons);

        // Content
        const content = document.createElement('div');
        content.className = 'arp-presets-content';

        // Build sections
        presets.forEach((section) => {
            if (!section.presets || section.presets.length === 0) return;

            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'arp-presets-section';

            if (section.label) {
                const label = document.createElement('div');
                label.className = 'arp-presets-section-label';
                label.textContent = section.label;
                sectionDiv.appendChild(label);
            };

            const grid = document.createElement('div');
            grid.className = 'arp-presets-grid';
            grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

            section.presets.forEach((preset) => {
                const btn = document.createElement('button');
                btn.className = 'arp-preset-btn';
                btn.textContent = `${preset.width} × ${preset.height}`;
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    this.applyPreset(preset.width, preset.height);
                    this.close();
                });
                grid.appendChild(btn);
            });

            sectionDiv.appendChild(grid);
            content.appendChild(sectionDiv);
        });

        this.popup.appendChild(header);
        this.popup.appendChild(content);

        // Position popup with respect to viewport and button
        this.positionPopup(buttonElement);

        this.popup.style.opacity = '1';
        this.popup.style.pointerEvents = 'auto';

        // Event listeners
        setTimeout(() => {
            document.addEventListener('click', this.outsideClickHandler);
            document.addEventListener('keydown', this.escKeyHandler);
        }, 0);
    }

    positionPopup(buttonElement) {
        const rect = buttonElement.getBoundingClientRect();
        const parentRect = (buttonElement.offsetParent || document.body).getBoundingClientRect();
        const popupRect = this.popup.getBoundingClientRect();

        // Calculate offset inside parent
        let left = rect.right - parentRect.left + 8;
        let top = rect.top - parentRect.top;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const pw = popupRect.width;
        const ph = popupRect.height;

        if (rect.right + pw > vw - 8) left = rect.left - parentRect.left - pw - 8;
        if (rect.top + ph > vh - 8) top = rect.top - parentRect.top - ph - 8;

        Object.assign(this.popup.style, {
            left: `${Math.round(left)}px`,
            top: `${Math.round(top)}px`,
        });
    }

    close() {
        if (this.popup) {
            this.popup.remove();
            this.popup = null;
            document.removeEventListener('click', this.outsideClickHandler);
            document.removeEventListener('keydown', this.escKeyHandler);
        }
    }

    outsideClickHandler = (e) => {
        if (this.popup && !this.popup.contains(e.target) && !e.target.closest('#txt2img_presets_btn')) {
            this.close();
        }
    };

    escKeyHandler = (e) => {
        if (e.key === 'Escape' && this.popup) {
            this.close();
        }
    };

    applyPreset(width, height) {
        // Set ratio select to OFF
        if (this.ctrl.optionCtrl?.ratioSelect) {
            this.ctrl.optionCtrl.ratioSelect.value = _OFF;
            this.ctrl.setAspectRatio(_OFF);
            this.ctrl.widthRatio = null;
            this.ctrl.heightRatio = null;
        }

        // Apply dimensions
        this.ctrl.w.setVal(width);
        this.ctrl.h.setVal(height);

        const ev = new Event('input', { bubbles: true });
        this.ctrl.w.trigger(ev);
        this.ctrl.h.trigger(ev);
    }

    openSettings() {
        // open settings tab and Aspect Ratio+ section
        const settingsTab = Array.from(gradioApp().querySelectorAll('#tabs > .tab-nav button'))
            .find((button) => button.textContent.trim() === 'Settings');

        if (settingsTab) {
            settingsTab.click();
            setTimeout(() => {
                const aspectRatioSection = Array.from(gradioApp().querySelectorAll('#tab_settings #settings .tab-nav button'))
                    .find((button) => button.textContent.trim() === 'Aspect Ratio+');

                if (aspectRatioSection) {
                    aspectRatioSection.click();
                }
            }, 100);
        }
        this.close();
    }
}

// ====== Slider Controller ======
class SliderController {
    constructor(el) {
        this.inputs = [...el.querySelectorAll('input')];
        this.inputs.forEach((i) => (i.isWidth = el.isWidth));
        this.num = this.inputs.find((i) => i.type === 'number');
    }

    val() { return Number(this.num.value); }
    update(prop, v) { this.inputs.forEach((i) => (i[prop] = round8(v))); }
    setVal(v) { this.update('value', v); }
    trigger(e) { this.num.dispatchEvent(e); }
}

// ====== Option Picking Controller ======
class OptionPickingController {
    constructor(page, defaultOptions, ctrl) {
        this.page = page;
        this.ctrl = ctrl;
        this.options = [...new Set([...defaultOptions, ...getOptions()])];
        this.buildUI();
    }

    // === Build UI structure ===
    buildUI() {
        const originalSwapBtn = gradioApp().getElementById(`${this.page}_res_switch_btn`);

        // Wrapper container
        const wrap = document.createElement('div');
        wrap.id = `${this.page}_size_toolbox`;

        // Clone the original swap button
        const swapBtn = originalSwapBtn.cloneNode(true);
        swapBtn.id = `${this.page}_res_switch_btn`;

        // Aspect ratio select box
        const ratioBox = document.createElement('div');
        ratioBox.id = `${this.page}_ratio`;

        const select = document.createElement('select');
        select.id = `${this.page}_select_aspect_ratio`;
        select.title = 'Aspect Ratio';
        select.innerHTML = this.options.map((r) => `<option class="ar-option">${r}</option>`).join('');
        ratioBox.appendChild(select);

        // Append select box first
        wrap.appendChild(ratioBox);

        // Add presets button for txt2img only (between ratio select and swap button)
        if (this.page === 'txt2img' && window.opts?.arp_presets_show) {
            // Box for presets button
            const presetsBox = document.createElement('div');
            presetsBox.id = `${this.page}_presets_box`;

            const presetsBtn = document.createElement('button');
            presetsBtn.id = `${this.page}_presets_btn`;
            presetsBtn.innerHTML = `
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="8" height="8" rx="1"/>
                    <rect x="13" y="3" width="8" height="8" rx="1"/>
                    <rect x="3" y="13" width="8" height="8" rx="1"/>
                    <rect x="13" y="13" width="8" height="8" rx="1"/>
                </svg>
            `;
            presetsBtn.title = 'Dimension Presets';

            const popupCtrl = new PresetsPopupController(this.page, this.ctrl);
            presetsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                popupCtrl.show(presetsBtn);
            });

            presetsBox.appendChild(presetsBtn);
            wrap.appendChild(presetsBox);
        }

        // Then append swap button
        wrap.appendChild(swapBtn);

        // Replace original button with wrapper
        originalSwapBtn.replaceWith(wrap);

        // Save references
        this.swapBtn = swapBtn;
        this.ratioSelect = select;

        // Event listeners
        this.ratioSelect.addEventListener('change', () => this.handleRatioChange());
        this.swapBtn.addEventListener('click', () => this.handleSwapClick());
    }

    handleRatioChange() {
        const picked = this.current();
        if (picked !== _IMAGE) this.swapBtn.removeAttribute('disabled');
        this.ctrl.setAspectRatio(picked);
    }

    handleSwapClick() {
        // Swap width and height values directly
        const curW = this.ctrl.w.val();
        const curH = this.ctrl.h.val();
        this.ctrl.w.setVal(curH);
        this.ctrl.h.setVal(curW);

        // Swap internal ratio values
        [this.ctrl.widthRatio, this.ctrl.heightRatio] = [this.ctrl.heightRatio, this.ctrl.widthRatio];

        // Reverse all AR options visually
        reverseAllOptions();

        const picked = this.current();
        if (picked === _OFF) {
            // Trigger events to update UI
            const ev = new Event('input', { bubbles: true });
            this.ctrl.w.trigger(ev);
            this.ctrl.h.trigger(ev);
            return;
        }

        if (picked === _LOCK) {
            // Trigger events to update UI
            const ev = new Event('input', { bubbles: true });
            this.ctrl.w.trigger(ev);
            this.ctrl.h.trigger(ev);
            return;
        }

        // For aspect ratio strings (e.g., "16:9")
        const parsed = aspectRatioFromStr(picked);
        if (parsed) {
            const [wR, hR] = parsed;
            this.ctrl.widthRatio = wR;
            this.ctrl.heightRatio = hR;
            // Trigger events to update UI
            const ev = new Event('input', { bubbles: true });
            this.ctrl.w.trigger(ev);
            this.ctrl.h.trigger(ev);
        }
    }

    current() {
        return this.ratioSelect.value;
    }
}

// ====== Aspect Ratio Controller ======
class AspectRatioController {
    constructor(page, wEl, hEl, defaults) {
        wEl.isWidth = true;
        hEl.isWidth = false;

        this.w = new SliderController(wEl);
        this.h = new SliderController(hEl);
        this.inputs = [...this.w.inputs, ...this.h.inputs];

        // Set fixed limits - never change these
        this.w.update('min', _MIN);
        this.w.update('max', _MAX);
        this.h.update('min', _MIN);
        this.h.update('max', _MAX);

        // React to manual input changes
        this.inputs.forEach((inp) => inp.addEventListener('change', (e) => this.maintainAspectRatio(e.target)));

        this.optionCtrl = new OptionPickingController(page, defaults, this);
        this.setAspectRatio(_OFF);
    }

    setAspectRatio(ar) {
        this.aspectRatio = ar;

        if (ar === _OFF) {
            this.widthRatio = null;
            this.heightRatio = null;
            return;
        }

        let wR, hR;

        if (ar === _IMAGE) {
            const img = getCurrentImage();
            [wR, hR] = [img?.naturalWidth || 1, img?.naturalHeight || 1];
        } else if (ar === _LOCK) {
            [wR, hR] = [this.w.val(), this.h.val()];
        } else {
            [wR, hR] = aspectRatioFromStr(ar);
        }

        this.widthRatio = wR;
        this.heightRatio = hR;
        this.maintainAspectRatio();
    }

    maintainAspectRatio(changed) {
        if (this.aspectRatio === _OFF) return;

        const aspect = this.widthRatio / this.heightRatio;
        let w = this.w.val(), h = this.h.val();

        if (!changed) {
            // Initial calculation: use current max value
            const maxVal = Math.max(w, h);
            [w, h] = aspect >= 1
                ? [maxVal, maxVal / aspect]   // Landscape or square
                : [maxVal * aspect, maxVal];  // Portrait
        } else {
            const isW = changed.isWidth;
            const value = +changed.value;

            // Apply limit only if option enabled
            const applyLimit = window.opts?.arp_aspect_ratio_limit ?? true;
            const maxVal = applyLimit ? getMaxAllowedValue(aspect, isW) : _MAX;

            if (isW) {
                w = Math.min(value, maxVal);
                h = w / aspect;
            } else {
                h = Math.min(value, maxVal);
                w = h * aspect;
            }
        }

        const [W, H] = clampToBoundaries(w, h);
        const ev = new Event('input', { bubbles: true });
        this.w.setVal(W);
        this.w.trigger(ev);
        this.h.setVal(H);
        this.h.trigger(ev);

        // Call dimensionChange for each input (if it exists)
        if (typeof dimensionChange === 'function') {
            [...this.w.inputs, ...this.h.inputs].forEach(inp =>
                dimensionChange({ target: inp }, inp.isWidth, !inp.isWidth)
            );
        }
    }

    static observeStartup(key, page, defaults, post = () => {}) {
        const obs = new MutationObserver(() => {
            const wEl = gradioApp().querySelector(`#${page}_width`);
            const hEl = gradioApp().querySelector(`#${page}_height`);

            if (wEl && hEl && window.opts?.arp_aspect_ratio_show !== undefined) {
                obs.disconnect();
                if (!window.opts.arp_aspect_ratio_show) return;

                const c = new AspectRatioController(page, wEl, hEl, defaults);
                post(c);
                window[key] = c;
            }
        });

        obs.observe(gradioApp(), { childList: true, subtree: true });
    }
}

// ====== Helpers for img2img ======
const addImg2ImgTabSwitchClickListeners = (ctrl) => {
    document
        .querySelectorAll('#img2img_settings button:not(.selected):not(.hasTabSwitchListener)')
        .forEach((btn) => {
            btn.addEventListener('click', () => {
                if (ctrl.optionCtrl.current() === _IMAGE) ctrl.setAspectRatio(_IMAGE);
                addImg2ImgTabSwitchClickListeners(ctrl);
            });
            btn.classList.add('hasTabSwitchListener');
        });
};

const postImageControllerSetupFunction = (ctrl) => {
    const scale = (e) => {
        if (ctrl.optionCtrl.current() !== _IMAGE) return;
        const file = (e.dataTransfer || e.target).files[0];
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => ctrl.setAspectRatio(`${img.naturalWidth}:${img.naturalHeight}`);
    };

    _IMAGE_INPUT_CONTAINER_IDS.forEach((id) => {
        const input = document.getElementById(id).querySelector('input');
        input.parentElement.addEventListener('drop', scale);
        input.addEventListener('change', scale);
    });

    addImg2ImgTabSwitchClickListeners(ctrl);
};

// ====== Init ======
onUiLoaded(() => {
    AspectRatioController.observeStartup(
        '__txt2imgAspectRatioController',
        'txt2img',
        [_OFF, _LOCK]
    );

    AspectRatioController.observeStartup(
        '__img2imgAspectRatioController',
        'img2img',
        [_OFF, _LOCK, _IMAGE],
        postImageControllerSetupFunction
    );
});