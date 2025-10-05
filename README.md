# Aspect Ratio+
### A simple extension for Stable Diffusion WebUI that adds a dropdown of aspect ratios and automatically maintains proportions when changing width/height.

## Features
- **JavaScript aspect ratio controls**
  - Adds a dropdown of configurable aspect ratios, which will auto-scale the dimensions
  - If "Lock/🔒" is selected, the aspect ratio of the current dimensions will be kept
  - If "Image/🖼️" is selected, the aspect ratio of the current image will be kept (img2img only)
  - If you click the "Swap/⇅" button, the current dimensions will swap, and the aspect ratios will flip accordingly

- **Dimension Presets Button (🧩)**
  - Adds a button that opens a popup window with customizable width × height presets
  - Presets are grouped by labels (use `>` for labels, `#` for comments, and `width x height` for actual presets)
  - You can edit the preset list and layout in the **Settings → Aspect Ratio+** section
  - The popup supports 1–4 columns layout
  - Includes a quick access button to open the extension settings

---

## Credits
- Original idea for the **Dimension Presets** popup was inspired by the extension
  [sd-simple-dimension-preset](https://github.com/gutris1/sd-simple-dimension-preset) by **gutris1**.