from modules.script_callbacks import on_ui_settings
from modules.shared import OptionInfo, opts
import gradio as gr

# Constants
EXTENSION_NAME = 'Aspect Ratio+'

# Settings keys
ARP_ASPECT_RATIO_SHOW_KEY = 'arp_aspect_ratio_show'
ARP_ASPECT_RATIOS_KEY = 'arp_aspect_ratio'
ARP_ASPECT_RATIO_LIMIT_KEY = 'arp_aspect_ratio_limit'
ARP_PRESETS_SHOW_KEY = 'arp_presets_show'
ARP_PRESETS_KEY = 'arp_presets'
ARP_PRESETS_COLUMNS_KEY = 'arp_presets_columns'
ARP_PRESETS_AUTOLABEL_KEY = 'arp_presets_autolabel'

SECTION = 'aspect_ratio_plus', EXTENSION_NAME

# Default presets
DEFAULT_PRESETS = '''> Portrait
640 x 1536
768 x 1344
832 x 1216
896 x 1152

> Landscape
1536 x 640
1344 x 768
1216 x 832
1152 x 896'''

DEFAULT_VALUES = {
    ARP_ASPECT_RATIO_SHOW_KEY: True,
    ARP_ASPECT_RATIOS_KEY: '1:1, 2:3, 3:4, 4:5, 9:16',
    ARP_ASPECT_RATIO_LIMIT_KEY: True,
    ARP_PRESETS_SHOW_KEY: True,
    ARP_PRESETS_KEY: DEFAULT_PRESETS,
    ARP_PRESETS_COLUMNS_KEY: 2,
    ARP_PRESETS_AUTOLABEL_KEY: True
}

def get_preset_lines():
    text = getattr(opts, ARP_PRESETS_KEY, DEFAULT_PRESETS) or DEFAULT_PRESETS
    lines = text.count('\n') + 1
    return max(5, min(40, lines))

def on_settings():
    # Aspect ratio options
    opts.add_option(
        ARP_ASPECT_RATIO_SHOW_KEY,
        OptionInfo(
            default=DEFAULT_VALUES[ARP_ASPECT_RATIO_SHOW_KEY],
            label='Enable Aspect Ratio Controls',
            component=gr.Checkbox,
            section=SECTION
        ).info('Shows aspect ratio dropdown controls in txt2img and img2img tabs')
    )

    opts.add_option(
        ARP_ASPECT_RATIOS_KEY,
        OptionInfo(
            default=DEFAULT_VALUES[ARP_ASPECT_RATIOS_KEY],
            label='Available Aspect Ratios',
            component=gr.Textbox,
            section=SECTION
        ).info('Comma-separated list of aspect ratios to show in the dropdown')
    )

    opts.add_option(
        ARP_ASPECT_RATIO_LIMIT_KEY,
        OptionInfo(
            default=DEFAULT_VALUES[ARP_ASPECT_RATIO_LIMIT_KEY],
            label='Enforce Aspect Ratio Limits',
            component=gr.Checkbox,
            section=SECTION
        ).info('If enabled, the width/height sliders will respect the selected aspect ratio limits')
    )

    # Presets options
    opts.add_option(
        ARP_PRESETS_SHOW_KEY,
        OptionInfo(
            default=DEFAULT_VALUES[ARP_PRESETS_SHOW_KEY],
            label='Enable Dimension Presets Button',
            component=gr.Checkbox,
            section=SECTION
        ).info('Shows dimension presets button in txt2img tab')
    )

    opts.add_option(
        ARP_PRESETS_KEY,
        OptionInfo(
            default=DEFAULT_VALUES[ARP_PRESETS_KEY],
            label='Dimension Presets',
            component=gr.Textbox,
            component_args={'lines': get_preset_lines()},
            section=SECTION
        ).info('Presets list: use ">" for labels, "#" for comments, "width x height" for presets')
    )

    opts.add_option(
        ARP_PRESETS_COLUMNS_KEY,
        OptionInfo(
            default=DEFAULT_VALUES[ARP_PRESETS_COLUMNS_KEY],
            label='Presets Popup Columns',
            component=gr.Slider,
            component_args={'minimum': 1, 'maximum': 4, 'step': 1},
            section=SECTION
        ).info('Number of columns in the presets popup window')
    )

    opts.add_option(
        ARP_PRESETS_AUTOLABEL_KEY,
        OptionInfo(
            default=DEFAULT_VALUES[ARP_PRESETS_AUTOLABEL_KEY],
            label='Auto-create "Others" label',
            component=gr.Checkbox,
            section=SECTION
        ).info('If enabled, presets not under any ">" label will be grouped under an "Others" label')
    )

on_ui_settings(on_settings)