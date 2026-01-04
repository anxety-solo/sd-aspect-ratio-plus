from modules.script_callbacks import on_ui_settings
from modules.shared import OptionInfo, opts
import gradio as gr
import os
import json

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
ARP_SETTINGS_SOURCE_KEY = 'arp_settings_source'
ARP_MIN_DIMENSION_KEY = 'arp_min_dimension'
ARP_MAX_DIMENSION_KEY = 'arp_max_dimension'

# Hidden widgets for passing UI config values to JS
ARP_UI_MIN_HIDDEN_KEY = 'arp_ui_min_hidden'
ARP_UI_MAX_HIDDEN_KEY = 'arp_ui_max_hidden'

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
    ARP_PRESETS_SHOW_KEY: 'Only txt2img',
    ARP_PRESETS_KEY: DEFAULT_PRESETS,
    ARP_PRESETS_COLUMNS_KEY: 2,
    ARP_PRESETS_AUTOLABEL_KEY: True,
    ARP_SETTINGS_SOURCE_KEY: 'UI Settings',
    ARP_MIN_DIMENSION_KEY: 64,
    ARP_MAX_DIMENSION_KEY: 2048
}

def _find_ui_value(config, pattern):
    """Find key in ui-config.json case-insensitively"""
    target = pattern.lower()
    for key, val in config.items():
        if key.lower() == target:
            try:
                return int(val)
            except:
                return None
    return None

def read_ui_config():
    """Read dimension settings from ui-config.json"""
    try:
        ui_config_path = os.path.join(os.getcwd(), 'ui-config.json')
        if not os.path.exists(ui_config_path):
            return DEFAULT_VALUES[ARP_MIN_DIMENSION_KEY], DEFAULT_VALUES[ARP_MAX_DIMENSION_KEY]

        with open(ui_config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)

        min_vals = []
        max_vals = []

        # Check all 4 combinations: txt2img/img2img × Width/Height
        for tab in ['txt2img', 'img2img']:
            for dim in ['Width', 'Height']:
                min_val = _find_ui_value(config, f"{tab}/{dim}/minimum")
                max_val = _find_ui_value(config, f"{tab}/{dim}/maximum")

                if min_val is not None:
                    min_vals.append(min_val)
                if max_val is not None:
                    max_vals.append(max_val)

        if min_vals and max_vals:
            return min(min_vals), max(max_vals)

    except Exception as e:
        print(f"[Aspect Ratio+] Error reading ui-config.json: {e}")

    return DEFAULT_VALUES[ARP_MIN_DIMENSION_KEY], DEFAULT_VALUES[ARP_MAX_DIMENSION_KEY]

def cleanup_hidden_settings():
    """Remove hidden settings from config.json so they refresh on next load"""
    try:
        config_path = os.path.join(os.getcwd(), 'config.json')
        if os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)

            changed = False
            if ARP_UI_MIN_HIDDEN_KEY in config:
                del config[ARP_UI_MIN_HIDDEN_KEY]
                changed = True
            if ARP_UI_MAX_HIDDEN_KEY in config:
                del config[ARP_UI_MAX_HIDDEN_KEY]
                changed = True

            if changed:
                with open(config_path, 'w', encoding='utf-8') as f:
                    json.dump(config, f, indent=4)
    except Exception as e:
        print(f"[Aspect Ratio+] Error cleaning up hidden settings: {e}")

def get_preset_lines():
    text = getattr(opts, ARP_PRESETS_KEY, DEFAULT_PRESETS) or DEFAULT_PRESETS
    lines = text.count('\n') + 1
    return max(5, min(40, lines))

def on_settings():
    cleanup_hidden_settings()

    # Read UI config values
    ui_min, ui_max = read_ui_config()

    # Create hidden number widgets that will be saved to config.json
    opts.add_option(
        ARP_UI_MIN_HIDDEN_KEY,
        OptionInfo(
            default=ui_min,
            label='',
            component=gr.Number,
            component_args={'visible': False},
            section=SECTION
        )
    )

    opts.add_option(
        ARP_UI_MAX_HIDDEN_KEY,
        OptionInfo(
            default=ui_max,
            label='',
            component=gr.Number,
            component_args={'visible': False},
            section=SECTION
        )
    )

    # Force update the hidden values
    opts.data[ARP_UI_MIN_HIDDEN_KEY] = ui_min
    opts.data[ARP_UI_MAX_HIDDEN_KEY] = ui_max

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

    # Dimension settings
    opts.add_option(
        ARP_SETTINGS_SOURCE_KEY,
        OptionInfo(
            default=DEFAULT_VALUES[ARP_SETTINGS_SOURCE_KEY],
            label='Dimension Settings Source',
            component=gr.Radio,
            component_args={'choices': ['UI Settings', 'Extension Settings']},
            section=SECTION
        ).info(f"UI Settings: min={ui_min}, max={ui_max} (from ui-config.json) | Extension Settings: use custom values below")
    )

    opts.add_option(
        ARP_MIN_DIMENSION_KEY,
        OptionInfo(
            default=DEFAULT_VALUES[ARP_MIN_DIMENSION_KEY],
            label='Minimum Dimension',
            component=gr.Slider,
            component_args={'minimum': 64, 'maximum': 2048, 'step': 64},
            section=SECTION
        ).info('Minimum allowed dimension value (used when "Extension Settings" is selected)')
    )

    opts.add_option(
        ARP_MAX_DIMENSION_KEY,
        OptionInfo(
            default=DEFAULT_VALUES[ARP_MAX_DIMENSION_KEY],
            label='Maximum Dimension',
            component=gr.Slider,
            component_args={'minimum': 2048, 'maximum': 4096, 'step': 64},
            section=SECTION
        ).info('Maximum allowed dimension value (used when "Extension Settings" is selected)')
    )

    # Presets options
    opts.add_option(
        ARP_PRESETS_SHOW_KEY,
        OptionInfo(
            default=DEFAULT_VALUES[ARP_PRESETS_SHOW_KEY],
            label='Enable Dimension Presets Button',
            component=gr.Radio,
            component_args={'choices': ['Off', 'Only txt2img', 'txt2img & img2img']},
            section=SECTION
        ).info('Choose where to show the dimension presets button')
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