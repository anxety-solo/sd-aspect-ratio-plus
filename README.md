# ❗ Removed from this fork:
The **Aspect Ratio+** extension no longer includes the following features that existed in the original:
- Scale to maximum dimension
- Scale to aspect ratio
- Scale by percentage
- Pre-defined aspect ratio buttons
- Pre-defined percentage buttons
- UI Component order
- Accordion (hide/expand section)
- Maximum dimension slider and related settings

---

# Aspect Ratio+
A simple extension for Stable Diffusion WebUI that adds a dropdown of aspect ratios and automatically maintains proportions when changing width/height.

## Features
- JavaScript aspect ratio controls
  - Adds a dropdown of configurable aspect ratios, which will auto-scale the dimensions
  - If "Lock/🔒" is selected, the aspect ratio of the current dimensions will be kept
  - If "Image/🖼️" is selected, the aspect ratio of the current image will be kept (img2img only)
  - If you click the "Swap/⇅" button, the current dimensions will swap, and the aspect ratios will flip accordingly

https://user-images.githubusercontent.com/22506439/227396634-7a63671a-fd38-419a-b734-a3d26647cc1d.mp4