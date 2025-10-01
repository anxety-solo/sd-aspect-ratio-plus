from modules.shared import OptionInfo, opts
from modules.script_callbacks import on_ui_settings
import gradio as gr

# Constants
EXTENSION_NAME = 'Aspect Ratio+'

# Settings keys
ARP_ASPECT_RATIO_SHOW_KEY = 'arp_aspect_ratio_show'
ARP_ASPECT_RATIOS_KEY = 'arp_aspect_ratio'

SECTION = 'aspect_ratio_plus', EXTENSION_NAME

# Default values
DEFAULT_VALUES = {
    ARP_ASPECT_RATIO_SHOW_KEY: True,
    ARP_ASPECT_RATIOS_KEY: '1:1, 2:3, 3:4, 4:5, 9:16',
}

def on_settings():
    # Aspect ratio options
    opts.add_option(
        ARP_ASPECT_RATIO_SHOW_KEY,
        OptionInfo(
            default=DEFAULT_VALUES.get(ARP_ASPECT_RATIO_SHOW_KEY),
            label='Enable Aspect Ratio Controls',
            component=gr.Checkbox,
            section=SECTION
        ).info('Shows aspect ratio dropdown controls in txt2img and img2img tabs')
    )

    opts.add_option(
        ARP_ASPECT_RATIOS_KEY,
        OptionInfo(
            default=DEFAULT_VALUES.get(ARP_ASPECT_RATIOS_KEY),
            label='Available Aspect Ratios',
            component=gr.Textbox,
            section=SECTION
        ).info('Comma-separated list of aspect ratios to show in the dropdown')
    )

on_ui_settings(on_settings)