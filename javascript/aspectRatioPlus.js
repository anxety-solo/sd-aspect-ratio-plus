// Constants
const _OFF   = "Off";
const _LOCK  = "🔒";
const _IMAGE = "🖼️";

const _MAX = 2048;
const _MIN = 64;

const _IMAGE_INPUT_CONTAINER_IDS = [
    "img2img_image",
    "img2img_sketch",
    "img2maskimg",
    "inpaint_sketch",
    "img_inpaint_base"
];

// Utility functions
const getSelectedImage2ImageTab = () => {
    const mode = gradioApp().getElementById("mode_img2img");
    const selected = mode.querySelector("button.selected");
    return [...mode.querySelectorAll("button")].indexOf(selected);
};

const getCurrentImage = () => {
    const id = _IMAGE_INPUT_CONTAINER_IDS[getSelectedImage2ImageTab()];
    return document.getElementById(id).querySelector("img");
};

const round8 = (n) => Math.round(Number(n) / 8) * 8;

const aspectRatioFromStr = (ar) =>
    ar.includes(":") && ar.split(":").map(Number);

const reverseAspectRatio = (ar) =>
    ar.includes(":") && ar.split(":").reverse().join(":");

const clampToBoundaries = (w, h) => {
    const ratio = w / h;
    w = Math.min(Math.max(w, _MIN), _MAX);
    h = Math.min(Math.max(h, _MIN), _MAX);
    if (w / h > ratio) h = Math.round(w / ratio);
    else if (w / h < ratio) w = Math.round(h * ratio);
    return [
        Math.min(Math.max(w, _MIN), _MAX),
        Math.min(Math.max(h, _MIN), _MAX)
    ];
};

const getOptions = () =>
    window.opts.arp_aspect_ratio.split(",").map(o => o.trim());

const reverseAllOptions = () => {
    document.querySelectorAll(".ar-option").forEach(el => {
        const rev = reverseAspectRatio(el.value);
        if (rev) {
            el.value = rev;
            el.textContent = rev;
        }
    });
};

// ====== Slider Controller ======
class SliderController {
    constructor(el) {
        this.inputs = [...el.querySelectorAll("input")];
        this.inputs.forEach(i => i.isWidth = el.isWidth);
        this.num = this.inputs.find(i => i.type === "number");
    }

    val() { return Number(this.num.value); }
    update(prop, v) { this.inputs.forEach(i => i[prop] = round8(v)); }
    setVal(v) { this.update("value", v); }
    trigger(e) { this.num.dispatchEvent(e); }
}

// ====== Option Picking Controller ======
class OptionPickingController {
    constructor(page, defaultOptions, ctrl) {
        this.page = page;
        this.ctrl = ctrl;
        this.options = this.prepareOptions(defaultOptions);

        // Original switch button
        const origBtn = gradioApp().getElementById(`${page}_res_switch_btn`);

        // Wrapper container
        const wrap = document.createElement("div");
        wrap.id = `${page}_size_toolbox`;
        wrap.className = "flex flex-col relative col gap-4";
        wrap.style = "min-width: min(320px, 100%); flex-grow: 0";

        // Container for aspect ratio select
        const ratioBox = document.createElement("div");
        ratioBox.id = `${page}_ratio`;
        ratioBox.className = "gr-block gr-box relative w-full border border-gray-200 gr-padded";

        // Aspect ratio <select>
        const select = document.createElement("select");
        select.id = `${page}_select_aspect_ratio`;
        select.className = "gr-box gr-input w-full";
        select.innerHTML = this.options.map(r => `<option class="ar-option">${r}</option>`).join("");

        ratioBox.appendChild(select);

        // Clone the original switch button to keep styles
        const clonedBtn = origBtn.cloneNode(true);
        clonedBtn.id = `${page}_res_switch_btn`;

        // Append ratio select first, then the button
        wrap.appendChild(ratioBox);
        wrap.appendChild(clonedBtn);

        // Replace original button with wrapper
        origBtn.replaceWith(wrap);

        // Save reference to the cloned button
        this.switchBtn = clonedBtn;

        // Attach event listeners
        select.addEventListener("change", this.onPickerChange());
        this.switchBtn.addEventListener("click", this.onSwitchClick());
    }

    prepareOptions(defaultOptions) {
        return [...new Set([...defaultOptions, ...getOptions()])];
    }

    onPickerChange() {
        return () => {
            const picked = this.current();
            if (picked !== _IMAGE) this.switchBtn.removeAttribute("disabled");
            this.ctrl.setAspectRatio(picked);
        };
    }

    onSwitchClick() {
        return () => {
            reverseAllOptions();
            const picked = this.current();

            if (picked === _OFF) {
                // When Off is selected, just swap width and height values
                const currentWidth = this.ctrl.w.val();
                const currentHeight = this.ctrl.h.val();
                this.ctrl.w.setVal(currentHeight);
                this.ctrl.h.setVal(currentWidth);
                return;
            }

            this.ctrl.setAspectRatio(
                picked === _LOCK
                    ? `${this.ctrl.heightRatio}:${this.ctrl.widthRatio}`
                    : picked
            );
        };
    }

    getPicker() {
        return gradioApp().getElementById(`${this.page}_select_aspect_ratio`);
    }

    current() {
        return this.getPicker().value;
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
        this.inputs.forEach(inp =>
            inp.addEventListener("change", e => this.maintainAspectRatio(e.target))
        );

        this.optionCtrl = new OptionPickingController(page, defaults, this);

        this.setAspectRatio(_OFF);
    }

    disable() {
        this.w.update("min", _MIN);
        this.w.update("max", _MAX);
        this.h.update("min", _MIN);
        this.h.update("max", _MAX);
    }

    isLandscape() {
        return this.widthRatio >= this.heightRatio;
    }

    setAspectRatio(ar) {
        this.aspectRatio = ar;
        let wR, hR;

        if (ar === _OFF) return this.disable();

        if (ar === _IMAGE) {
            const img = getCurrentImage();
            [wR, hR] = [img?.naturalWidth || 1, img?.naturalHeight || 1];
        } else if (ar === _LOCK) {
            [wR, hR] = [this.w.val(), this.h.val()];
        } else {
            [wR, hR] = aspectRatioFromStr(ar);
        }

        [this.widthRatio, this.heightRatio] = clampToBoundaries(wR, hR);
        this.updateLimits();
        this.maintainAspectRatio();
    }

    updateLimits() {
        const landscape = this.isLandscape();
        const AR = landscape
            ? this.widthRatio / this.heightRatio
            : this.heightRatio / this.widthRatio;

        if (landscape) {
            this.w.update("min", _MIN * AR);
            this.h.update("min", _MIN);
            this.h.update("max", _MAX / AR);
            this.w.update("max", _MAX);
        } else {
            this.h.update("min", _MIN * AR);
            this.w.update("min", _MIN);
            this.w.update("max", _MAX / AR);
            this.h.update("max", _MAX);
        }
    }

    maintainAspectRatio(changed) {
        if (this.aspectRatio === _OFF) return;

        const aspect = this.widthRatio / this.heightRatio;
        let w, h;

        if (!changed) {
            const maxVal = Math.max(...this.inputs.map(x => +x.value));
            if (this.isLandscape()) [w, h] = [maxVal, maxVal / aspect];
            else [h, w] = [maxVal, maxVal * aspect];
        } else if (changed.isWidth) {
            w = +changed.value; h = w / aspect;
        } else {
            h = +changed.value; w = h * aspect;
        }

        const [W, H] = clampToBoundaries(w, h);
        const ev = new Event("input", { bubbles: true });
        this.w.setVal(W); this.w.trigger(ev);
        this.h.setVal(H); this.h.trigger(ev);

        [...this.w.inputs, ...this.h.inputs].forEach(inp =>
            dimensionChange({ target: inp }, inp.isWidth, !inp.isWidth)
        );
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
        .querySelectorAll("#img2img_settings button:not(.selected):not(.hasTabSwitchListener)")
        .forEach(btn => {
            btn.addEventListener("click", () => {
                if (ctrl.optionCtrl.current() === _IMAGE) ctrl.setAspectRatio(_IMAGE);
                addImg2ImgTabSwitchClickListeners(ctrl);
            });
            btn.classList.add("hasTabSwitchListener");
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

    _IMAGE_INPUT_CONTAINER_IDS.forEach(id => {
        const input = document.getElementById(id).querySelector("input");
        input.parentElement.addEventListener("drop", scale);
        input.addEventListener("change", scale);
    });

    addImg2ImgTabSwitchClickListeners(ctrl);
};

// ====== Init ======
onUiLoaded(() => {
    AspectRatioController.observeStartup(
        "__txt2imgAspectRatioController",
        "txt2img",
        [_OFF, _LOCK]
    );

    AspectRatioController.observeStartup(
        "__img2imgAspectRatioController",
        "img2img",
        [_OFF, _LOCK, _IMAGE],
        postImageControllerSetupFunction
    );
});