#!/usr/bin/env python3
"""
Panel Widget Configurator - Home Assistant Add-on
Generates and validates JSON configuration for ESPHome panel widgets
"""

import os
import json
import logging
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_from_directory
import requests

# Configuration
HA_TOKEN = os.environ.get('SUPERVISOR_TOKEN', '')
# Use supervisor API when running as add-on, otherwise use env or default
HA_API = os.environ.get('HA_API', 'http://supervisor/core/api' if HA_TOKEN else '')

# Load version from config.yaml - SINGLE SOURCE OF TRUTH
# If this fails, version shows as "0.0.0" to indicate error
ADDON_VERSION = "0.0.0"
APP_DIR = Path(__file__).parent  # /app directory where main.py lives

# Debug: List all files recursively from /app to see container structure
print("[VERSION DEBUG] === FILE LISTING START ===", flush=True)
for root, dirs, files in os.walk('/app'):
    level = root.replace('/app', '').count(os.sep)
    indent = ' ' * 2 * level
    print(f"[VERSION DEBUG] {indent}{os.path.basename(root)}/", flush=True)
    subindent = ' ' * 2 * (level + 1)
    for file in files[:20]:  # Limit to first 20 files per dir to avoid spam
        print(f"[VERSION DEBUG] {subindent}{file}", flush=True)
    if len(files) > 20:
        print(f"[VERSION DEBUG] {subindent}... and {len(files) - 20} more files", flush=True)
print("[VERSION DEBUG] === FILE LISTING END ===", flush=True)

print(f"[VERSION DEBUG] APP_DIR: {APP_DIR}", flush=True)
print(f"[VERSION DEBUG] __file__: {__file__}", flush=True)

try:
    import yaml
    # config.yaml is copied to /app/config.yaml in Docker
    config_yaml_path = APP_DIR / 'config.yaml'
    print(f"[VERSION DEBUG] Looking for config.yaml at: {config_yaml_path}", flush=True)
    print(f"[VERSION DEBUG] File exists: {config_yaml_path.exists()}", flush=True)
    if config_yaml_path.exists():
        with open(config_yaml_path, 'r') as f:
            config_data = yaml.safe_load(f)
            ADDON_VERSION = config_data.get('version', '0.0.0')
            print(f"[VERSION DEBUG] Loaded version: {ADDON_VERSION}", flush=True)
    else:
        print(f"[VERSION DEBUG] config.yaml NOT FOUND", flush=True)
except Exception as e:
    print(f"[VERSION DEBUG] ERROR loading config.yaml: {e}", flush=True)

print(f"[VERSION DEBUG] Final ADDON_VERSION: {ADDON_VERSION}", flush=True)

# Determine if running in HA add-on mode or local development
RUNNING_IN_HA = os.path.exists('/config') and os.environ.get('SUPERVISOR_TOKEN')

if RUNNING_IN_HA:
    # HA Add-on mode
    ADDON_CONFIG = Path('/config/panel_widgets')
    LIVE_CONFIG = Path('/config/www/panel_widgets/site_settings.json')
    TEMPLATE_DIR = '/app/templates'
    STATIC_DIR = '/app/static'
else:
    # Local development mode - use paths relative to script
    SCRIPT_DIR = Path(__file__).parent.parent  # Go up from app/ to ha-config-tool/
    ADDON_CONFIG = SCRIPT_DIR / 'config_data'
    LIVE_CONFIG = ADDON_CONFIG / 'live' / 'site_settings.json'
    TEMPLATE_DIR = str(SCRIPT_DIR / 'templates')
    STATIC_DIR = str(SCRIPT_DIR / 'static')
    print(f"[LOCAL MODE] Config dir: {ADDON_CONFIG}")
    print(f"[LOCAL MODE] Live config: {LIVE_CONFIG}")
    print(f"[LOCAL MODE] Templates: {TEMPLATE_DIR}")
    print(f"[LOCAL MODE] Static: {STATIC_DIR}")

def get_headers():
    """Get headers for HA API requests"""
    return {
        'Authorization': f'Bearer {HA_TOKEN}',
        'Content-Type': 'application/json'
    }

# Initialize Flask
app = Flask(__name__, 
            template_folder=TEMPLATE_DIR,
            static_folder=STATIC_DIR)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure config directories exist
ADDON_CONFIG.mkdir(parents=True, exist_ok=True)
LIVE_CONFIG.parent.mkdir(parents=True, exist_ok=True)

# Startup logging
if RUNNING_IN_HA:
    logger.info("="*50)
    logger.info("Panel Widget Configurator - HA Add-on Mode")
    logger.info("="*50)
else:
    logger.info("="*50)
    logger.info("Panel Widget Configurator - LOCAL DEV Mode")
    logger.info("="*50)

# Debug: Show environment detection
logger.info(f"RUNNING_IN_HA: {RUNNING_IN_HA}")
logger.info(f"HA_TOKEN available: {bool(HA_TOKEN)}")
logger.info(f"HA_TOKEN length: {len(HA_TOKEN) if HA_TOKEN else 0}")
logger.info(f"HA_API: {HA_API}")
logger.info(f"SUPERVISOR_TOKEN env: {bool(os.environ.get('SUPERVISOR_TOKEN'))}")
logger.info(f"/config exists: {os.path.exists('/config')}")

logger.info(f"Config directory: {ADDON_CONFIG}")
logger.info(f"Live config: {LIVE_CONFIG}")
logger.info(f"Templates: {TEMPLATE_DIR}")
logger.info(f"Static: {STATIC_DIR}")

# Ensure staging directory exists
STAGING_DIR = ADDON_CONFIG / 'staging'
STAGING_DIR.mkdir(parents=True, exist_ok=True)
logger.info(f"Staging directory: {STAGING_DIR}")

# Default configuration structure
def get_default_config():
    """Get default empty configuration"""
    return {
        "site_meta": {
            "version": "1.0",
            "last_updated": datetime.now().strftime("%Y-%m-%d")
        },
        "site_info": {
            "site_name": "My Home",
            "guest_ssid": "",
            "guest_wifi_password": ""
        },
        "defaults": {
            "cover_opening_time": "08:00",
            "cover_closing_time": "19:00",
            "climate_check_interval": 60,
            "site_cover_up_time": 14300,
            "site_cover_down_time": 11500
        },
        "devices": []
    }

# JSON Schema for validation
LIGHT_SCHEMA = {
    "type": "object",
    "properties": {
        "entity": {"type": "string", "pattern": "^light\\."},
        "name": {"type": "string", "minLength": 1},
        "type": {"type": "string", "enum": ["p", "ph", "phb", "phc", "phbc"]},
        "icon_id": {"type": "string", "enum": ["downlight", "pendant", "wardrobe", "lamp", "spot", "strip"]}
    },
    "required": ["entity", "name", "type"]
}

COVER_SCHEMA = {
    "type": "object",
    "properties": {
        "entity": {"type": "string", "pattern": "^cover\\."},
        "name": {"type": "string", "minLength": 1},
        "type": {"type": "string", "enum": ["blind", "single_curtain", "double_curtain"]},
        "up_time_msecs": {"type": "integer", "minimum": 1000, "maximum": 60000},
        "down_time_msecs": {"type": "integer", "minimum": 1000, "maximum": 60000}
    },
    "required": ["entity", "name", "type"]
}

TESTER_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string", "minLength": 1},
        "mode": {"type": "string", "enum": ["existing_switch", "create_binary_sensor"]},
        "entity": {"type": "string", "pattern": "^(switch|binary_sensor|input_boolean)\\."},
        "device_name": {"type": "string", "minLength": 1},
        "test_id": {"type": "string", "enum": ["test_1", "test_2", "test_3", "test_4"]}
    },
    "required": ["name", "mode", "test_id"],
    "allOf": [
        {
            "if": {"properties": {"mode": {"const": "existing_switch"}}},
            "then": {"required": ["entity"]}
        },
        {
            "if": {"properties": {"mode": {"const": "create_binary_sensor"}}},
            "then": {"required": ["device_name"]}
        }
    ]
}

ART_SCHEMA = {
    "type": "object",
    "properties": {
        "directory": {"type": "string", "minLength": 1, "default": "/local/art"},
        "transition_time": {"type": "integer", "minimum": 1, "maximum": 3600, "default": 5},
        "presence_aware": {"type": "string", "enum": ["Y", "N"], "default": "N"},
        "presence_sensor": {"type": "string", "pattern": "^binary_sensor\\."},
        "images": {
            "type": "array",
            "items": {"type": "string", "minLength": 1},
            "minItems": 1
        }
    },
    "required": ["images"],
    "allOf": [
        {
            "if": {"properties": {"presence_aware": {"const": "Y"}}},
            "then": {"required": ["presence_sensor"]}
        }
    ]
}

CLIMATE2_SCHEMA = {
    "type": "object",
    "properties": {
        "entity": {"type": "string", "pattern": "^climate\\."},
        "name": {"type": "string", "minLength": 1},
        "ui_mode": {"type": "string", "enum": ["simple", "advanced"], "default": "simple"}
    },
    "required": ["entity", "name"]
}


@app.route('/')
def index():
    """Main configuration page"""
    return render_template('index.html', version=ADDON_VERSION)


@app.route('/api/config', methods=['GET'])
def get_config():
    """Get current configuration - loads LIVE config on startup"""
    # Always load from LIVE location
    if LIVE_CONFIG.exists():
        try:
            with open(LIVE_CONFIG, 'r') as f:
                config = json.load(f)
                logger.info(f"Loaded LIVE config from {LIVE_CONFIG}")
                return jsonify(config)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in live config: {e}")
    
    # If no live config, return default
    logger.info("No live config found, returning default")
    return jsonify(get_default_config())


@app.route('/api/config/save', methods=['POST'])
def save_config():
    """Save configuration to STAGING (not live)"""
    data = request.get_json()
    
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid configuration structure"}), 400
    
    # Get optional filename (for named staging files)
    filename = data.pop('_filename', None)
    
    # Update metadata
    if 'site_meta' not in data:
        data['site_meta'] = {}
    data['site_meta']['last_updated'] = datetime.now().strftime("%Y-%m-%d")
    
    # Ensure devices array exists
    if 'devices' not in data:
        data['devices'] = []
    
    # Save to staging file (not live)
    if filename:
        # Named staging file in staging directory
        safe_filename = Path(filename).name
        if not safe_filename.endswith('.json'):
            safe_filename += '.json'
        staging_file = STAGING_DIR / safe_filename
    else:
        # Default staging file
        staging_file = ADDON_CONFIG / 'site_settings_staging.json'
    
    # Backup existing staging if present
    if staging_file.exists():
        backup = ADDON_CONFIG / f'site_settings_staging_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        staging_file.rename(backup)
    
    with open(staging_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    logger.info(f"Saved STAGING config to {staging_file}")
    return jsonify({
        "success": True, 
        "message": "Configuration saved to staging",
        "staging_file": str(staging_file),
        "filename": filename or "site_settings_staging.json"
    })


@app.route('/api/config/save-live', methods=['POST'])
def save_and_make_live():
    """Save configuration and immediately make it live"""
    data = request.get_json()
    
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid configuration structure"}), 400
    
    # Update metadata
    if 'site_meta' not in data:
        data['site_meta'] = {}
    data['site_meta']['last_updated'] = datetime.now().strftime("%Y-%m-%d")
    
    # Ensure devices array exists
    if 'devices' not in data:
        data['devices'] = []
    
    # Also save to staging first (as backup)
    staging_file = ADDON_CONFIG / 'site_settings_staging.json'
    with open(staging_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    try:
        # Copy to live location
        import shutil
        LIVE_CONFIG.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(staging_file, LIVE_CONFIG)
        
        logger.info(f"Saved and made LIVE: {LIVE_CONFIG}")
        return jsonify({
            "success": True, 
            "message": "Configuration saved and is now live",
            "live_path": str(LIVE_CONFIG),
            "staging_file": str(staging_file),
            "url": "/local/panel_widgets/site_settings.json"
        })
    except Exception as e:
        logger.error(f"Failed to save and make live: {e}")
        return jsonify({"error": f"Failed to make live: {str(e)}"}), 500


@app.route('/api/config/staging', methods=['GET'])
def list_staging_files():
    """List all available staging configuration files"""
    try:
        files = []
        if STAGING_DIR.exists():
            for f in STAGING_DIR.glob('*.json'):
                stat = f.stat()
                files.append({
                    "name": f.name,
                    "path": str(f),
                    "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                    "size": stat.st_size
                })
        files.sort(key=lambda x: x['modified'], reverse=True)
        return jsonify({"files": files})
    except Exception as e:
        logger.error(f"Failed to list staging files: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/config/staging/<filename>', methods=['GET'])
def load_staging_file(filename):
    """Load a specific staging configuration file"""
    try:
        safe_filename = Path(filename).name
        if not safe_filename.endswith('.json'):
            safe_filename += '.json'
        
        staging_file = STAGING_DIR / safe_filename
        
        if not staging_file.exists():
            return jsonify({"error": f"Staging file not found: {filename}"}), 404
        
        with open(staging_file, 'r') as f:
            config = json.load(f)
        
        logger.info(f"Loaded staging file: {staging_file}")
        return jsonify(config)
    except json.JSONDecodeError as e:
        return jsonify({"error": f"Invalid JSON: {str(e)}"}), 400
    except Exception as e:
        logger.error(f"Failed to load staging file: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/config/staging/<filename>', methods=['DELETE'])
def delete_staging_file(filename):
    """Delete a staging configuration file"""
    try:
        safe_filename = Path(filename).name
        staging_file = STAGING_DIR / safe_filename
        
        if not staging_file.exists():
            return jsonify({"error": f"Staging file not found: {filename}"}), 404
        
        staging_file.unlink()
        logger.info(f"Deleted staging file: {staging_file}")
        return jsonify({"success": True, "message": f"Deleted {filename}"})
    except Exception as e:
        logger.error(f"Failed to delete staging file: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/config/make-live', methods=['POST'])
def make_live():
    """Copy current staging config to LIVE location"""
    staging_file = ADDON_CONFIG / 'site_settings_staging.json'
    
    # Use staging if exists, otherwise error (user should save first)
    if not staging_file.exists():
        return jsonify({"error": "No staging config found. Save first before making live."}), 404
    
    try:
        # Copy staging to live
        import shutil
        LIVE_CONFIG.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(staging_file, LIVE_CONFIG)
        
        logger.info(f"Made config LIVE: {LIVE_CONFIG}")
        return jsonify({
            "success": True, 
            "message": "Configuration is now live",
            "live_path": str(LIVE_CONFIG),
            "url": "/local/panel_widgets/site_settings.json"
        })
    except Exception as e:
        logger.error(f"Failed to make live: {e}")
        return jsonify({"error": f"Failed to make live: {str(e)}"}), 500


@app.route('/api/config/import', methods=['POST'])
def import_config():
    """Import configuration from uploaded file (becomes staging)"""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    try:
        data = json.load(file)
        
        # Validate basic structure
        if 'devices' not in data:
            return jsonify({"error": "Invalid file: missing 'devices' array"}), 400
        
        # Save as staging
        staging_file = ADDON_CONFIG / 'site_settings_staging.json'
        with open(staging_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        logger.info(f"Imported config to staging: {staging_file}")
        return jsonify({
            "success": True,
            "message": f"Imported {len(data['devices'])} devices to staging",
            "config": data
        })
    except json.JSONDecodeError as e:
        return jsonify({"error": f"Invalid JSON: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to import: {str(e)}"}), 500


@app.route('/api/config/export/<filename>')
def export_config(filename):
    """Export current configuration as downloadable JSON"""
    # Try to find config in multiple locations
    # Priority: 1) Main staging file, 2) Any .json in staging dir, 3) Live config
    staging_file = ADDON_CONFIG / 'site_settings_staging.json'
    
    logger.info(f"Export requested for: {filename}")
    logger.info(f"Checking main staging file: {staging_file} (exists: {staging_file.exists()})")
    logger.info(f"ADDON_CONFIG path: {ADDON_CONFIG}")
    logger.info(f"STAGING_DIR path: {STAGING_DIR}")
    logger.info(f"LIVE_CONFIG path: {LIVE_CONFIG}")
    
    # If main staging file doesn't exist, try to find any staging file
    if not staging_file.exists():
        logger.info("Main staging file not found, checking alternatives...")
        # Look for any .json files in staging directory
        if STAGING_DIR.exists():
            json_files = list(STAGING_DIR.glob('*.json'))
            logger.info(f"Found {len(json_files)} JSON files in staging dir")
            if json_files:
                staging_file = json_files[0]  # Use first found
                logger.info(f"Using staging file: {staging_file}")
        
        # If still no staging file, try live config
        if not staging_file.exists() and LIVE_CONFIG.exists():
            staging_file = LIVE_CONFIG
            logger.info(f"Using live config for export: {staging_file}")
    else:
        logger.info(f"Using main staging file: {staging_file}")
    
    # If no config file found anywhere, we can't export
    if not staging_file.exists():
        logger.error("No configuration file found for export!")
        return jsonify({"error": "No configuration found. Save first."}), 404
    
    # Ensure filename is safe
    safe_filename = Path(filename).name
    if not safe_filename.endswith('.json'):
        safe_filename += '.json'
    
    # Create temporary copy with desired filename in staging dir
    temp_file = STAGING_DIR / safe_filename
    import shutil
    shutil.copy2(staging_file, temp_file)
    
    return send_from_directory(
        str(STAGING_DIR), 
        safe_filename,
        as_attachment=True,
        download_name=safe_filename
    )


@app.route('/api/validate/entity', methods=['POST'])
def validate_entity():
    """Validate that an entity exists in Home Assistant"""
    data = request.get_json()
    entity_id = data.get('entity', '')
    
    if not entity_id:
        return jsonify({"valid": False, "error": "Empty entity_id"})
    
    # Check format
    if '.' not in entity_id:
        return jsonify({"valid": False, "error": "Invalid format, must be 'domain.entity'"})
    
    domain, name = entity_id.split('.', 1)
    
    # If not running in HA, simulate validation for local testing
    if not RUNNING_IN_HA and not HA_TOKEN:
        return jsonify({
            "valid": True,
            "state": "unavailable",
            "attributes": {},
            "domain": domain,
            "simulated": True
        })
    
    try:
        # Query HA API
        response = requests.get(
            f'{HA_API}/states/{entity_id}',
            headers=get_headers(),
            timeout=5
        )
        
        if response.status_code == 200:
            state = response.json()
            return jsonify({
                "valid": True,
                "state": state.get('state'),
                "attributes": state.get('attributes', {}),
                "domain": domain
            })
        elif response.status_code == 404:
            return jsonify({"valid": False, "error": f"Entity '{entity_id}' not found in Home Assistant"})
        else:
            return jsonify({"valid": False, "error": f"HA API error: {response.status_code}"})
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to validate entity: {e}")
        return jsonify({"valid": False, "error": "Cannot connect to Home Assistant API"})


@app.route('/api/entities/<domain>')
def get_entities(domain):
    """Get all entities of a specific domain from HA"""
    # Debug logging
    logger.info(f"API: get_entities({domain})")
    logger.info(f"RUNNING_IN_HA: {RUNNING_IN_HA}")
    logger.info(f"HA_TOKEN available: {bool(HA_TOKEN)}")
    logger.info(f"HA_API: {HA_API}")
    
    # If not running in HA, return empty list for local testing
    if not RUNNING_IN_HA and not HA_TOKEN:
        logger.warning("Not in HA mode and no token - returning empty list")
        return jsonify({"entities": []})
    
    try:
        url = f'{HA_API}/states'
        headers = get_headers()
        logger.info(f"Fetching from: {url}")
        logger.info(f"Headers: {headers}")
        
        response = requests.get(url, headers=headers, timeout=5)
        logger.info(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            states = response.json()
            logger.info(f"Got {len(states)} states from HA")
            entities = [
                {
                    "entity_id": s['entity_id'],
                    "name": s['attributes'].get('friendly_name', s['entity_id']),
                    "state": s['state']
                }
                for s in states
                if s['entity_id'].startswith(f'{domain}.')
            ]
            logger.info(f"Returning {len(entities)} entities for domain '{domain}'")
            return jsonify({"entities": entities})
        else:
            logger.error(f"HA API error: {response.status_code} - {response.text}")
            return jsonify({"error": f"HA API returned {response.status_code}"}), 500
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch entities: {e}")
        return jsonify({"error": "Cannot connect to Home Assistant API"}), 503


@app.route('/api/schema/<widget_type>')
def get_schema(widget_type):
    """Get JSON schema for a widget type"""
    schemas = {
        'light': LIGHT_SCHEMA,
        'cover': COVER_SCHEMA,
        'tester': TESTER_SCHEMA,
        'art': ART_SCHEMA,
        'climate2': CLIMATE2_SCHEMA
    }
    
    if widget_type not in schemas:
        return jsonify({"error": "Unknown widget type"}), 404
    
    return jsonify(schemas[widget_type])


@app.route('/api/widget-types')
def widget_types():
    """Get list of supported widget types"""
    return jsonify({
        "widgets": [
            {
                "id": "lights",
                "name": "Lights",
                "description": "Control lights with support for power, brightness, color temp, and RGB",
                "icon": "mdi:lightbulb",
                "capabilities": ["on_off", "brightness", "color_temp", "color"],
                "status": "stable"
            },
            {
                "id": "covers",
                "name": "Covers",
                "description": "Control blinds, curtains with position and animation",
                "icon": "mdi:curtains",
                "icon_code": "F1846",
                "capabilities": ["position", "open", "close", "stop"],
                "status": "stable"
            },
            {
                "id": "climate",
                "name": "Climate",
                "description": "HVAC control with dual setpoint (heat/cool)",
                "icon": "mdi:thermostat",
                "capabilities": ["temperature", "mode", "fan"],
                "status": "planned"
            },
            {
                "id": "climate2",
                "name": "Climate2",
                "description": "Modern climate control with simple and advanced modes. Simple: temperature, on/off, fan speed. Advanced: adds mode selection and presets.",
                "icon": "mdi:thermostat-auto",
                "icon_code": "F23FF",
                "capabilities": ["temperature", "mode", "fan", "preset"],
                "status": "beta",
                "note": "Simple mode: temp/on/off/fan. Advanced mode: adds mode/presets"
            },
            {
                "id": "tester",
                "name": "Tester",
                "description": "Diagnostic widget for testing subscriptions without external hardware",
                "icon": "mdi:test-tube",
                "icon_code": "F0668",
                "capabilities": ["on_off", "state_display"],
                "status": "stable",
                "note": "Zero external dependencies - use for validation testing"
            },
            {
                "id": "weather",
                "name": "Weather",
                "description": "Display weather information",
                "icon": "mdi:weather-partly-cloudy",
                "capabilities": ["display"],
                "status": "planned"
            },
            {
                "id": "alarm",
                "name": "Alarm",
                "description": "House alarm control panel",
                "icon": "mdi:shield-home",
                "capabilities": ["arm", "disarm", "status"],
                "status": "planned"
            },
            {
                "id": "music",
                "name": "Music",
                "description": "Background music streaming control",
                "icon": "mdi:music",
                "capabilities": ["play", "pause", "volume", "source"],
                "status": "future"
            },
            {
                "id": "art",
                "name": "Art Display",
                "description": "Full-screen image slideshow from HA web directory with double buffering and presence awareness",
                "icon": "mdi:image",
                "icon_code": "F2E9",
                "capabilities": ["display", "slideshow", "presence_aware", "touch_exit"],
                "status": "stable",
                "note": "Images must be 720x720 PNG/JPG in /config/www/art/ directory"
            },
            {
                "id": "intercom",
                "name": "Intercom",
                "description": "Room-to-room intercom",
                "icon": "mdi:phone",
                "capabilities": ["call", "audio"],
                "status": "future"
            },
            {
                "id": "pa",
                "name": "Public Address",
                "description": "Announcements to panels and speakers",
                "icon": "mdi:bullhorn",
                "capabilities": ["announce", "zones"],
                "status": "future"
            },
            {
                "id": "assistant",
                "name": "Voice Assistant",
                "description": "Streaming audio to voice assistant",
                "icon": "mdi:microphone",
                "capabilities": ["streaming", "wake_word"],
                "status": "future"
            }
        ]
    })


# =============================================================================
# ART WIDGET - Image Management Endpoints
# =============================================================================

@app.route('/api/art/images', methods=['GET'])
def list_art_images():
    """List images in the art directory"""
    directory = request.args.get('directory', '/local/art')
    
    # Convert /local/art to /config/www/art path
    if directory.startswith('/local/'):
        dir_name = directory[7:]  # Remove '/local/'
        art_path = Path('/config/www') / dir_name
    else:
        art_path = Path('/config/www') / directory.strip('/')
    
    # Security: Ensure path is within /config/www
    try:
        art_path = art_path.resolve()
        www_path = Path('/config/www').resolve()
        if not str(art_path).startswith(str(www_path)):
            return jsonify({"error": "Invalid directory path"}), 403
    except Exception as e:
        return jsonify({"error": f"Invalid path: {str(e)}"}), 400
    
    # Create directory if it doesn't exist
    art_path.mkdir(parents=True, exist_ok=True)
    
    # List image files
    try:
        images = []
        for ext in ['*.jpg', '*.jpeg', '*.png', '*.gif', '*.webp']:
            images.extend([f.name for f in art_path.glob(ext)])
        images.sort()
        
        return jsonify({
            "success": True,
            "directory": directory,
            "path": str(art_path),
            "images": images
        })
    except Exception as e:
        logger.error(f"Failed to list images: {e}")
        return jsonify({"error": str(e)}), 500


def validate_jpeg(file_stream, filename):
    """
    Validate JPEG file:
    1. Must be JPEG format (SOI marker)
    2. Must be baseline (SOF0), not progressive (SOF2)
    3. Must be 720x720 pixels
    
    Returns: (is_valid, error_message)
    """
    # Read file content
    content = file_stream.read()
    file_stream.seek(0)  # Reset for later use
    
    # Check JPEG SOI marker (FF D8)
    if len(content) < 2 or content[0] != 0xFF or content[1] != 0xD8:
        return False, "Not a valid JPEG file"
    
    # Parse JPEG markers
    i = 2
    width = None
    height = None
    is_progressive = False
    
    while i < len(content) - 1:
        # Look for marker
        if content[i] != 0xFF:
            i += 1
            continue
        
        marker = content[i + 1]
        
        # Skip padding
        if marker == 0xFF:
            i += 1
            continue
        
        # SOF0 = Baseline DCT
        if marker == 0xC0:
            if i + 9 < len(content):
                height = (content[i + 5] << 8) | content[i + 6]
                width = (content[i + 7] << 8) | content[i + 8]
        
        # SOF2 = Progressive DCT
        elif marker == 0xC2:
            is_progressive = True
            if i + 9 < len(content):
                height = (content[i + 5] << 8) | content[i + 6]
                width = (content[i + 7] << 8) | content[i + 8]
        
        # Skip to next marker
        if marker == 0xD9:  # EOI
            break
        elif marker in [0xD8, 0x01]:  # SOI, TEM
            i += 2
        elif marker in [0xD0, 0xD1, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7]:  # Restart markers
            i += 2
        else:
            # Skip segment length
            if i + 3 < len(content):
                length = (content[i + 2] << 8) | content[i + 3]
                i += 2 + length
            else:
                break
    
    # Validate results
    if is_progressive:
        return False, "Progressive JPEG not supported - use baseline JPEG"
    
    if width != 720 or height != 720:
        return False, f"Image must be 720x720 pixels, got {width}x{height}"
    
    return True, None


@app.route('/api/art/upload', methods=['POST'])
def upload_art_image():
    """Upload an image to the art directory"""
    directory = request.form.get('directory', '/local/art')
    
    # Convert /local/art to /config/www/art path
    if directory.startswith('/local/'):
        dir_name = directory[7:]
        art_path = Path('/config/www') / dir_name
    else:
        art_path = Path('/config/www') / directory.strip('/')
    
    # Security check
    try:
        art_path = art_path.resolve()
        www_path = Path('/config/www').resolve()
        if not str(art_path).startswith(str(www_path)):
            return jsonify({"error": "Invalid directory path"}), 403
    except Exception as e:
        return jsonify({"error": f"Invalid path: {str(e)}"}), 400
    
    # Create directory if needed
    art_path.mkdir(parents=True, exist_ok=True)
    
    # Check if file was uploaded
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    # Validate file extension - ONLY JPG/JPEG allowed
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ['.jpg', '.jpeg']:
        return jsonify({"error": "Only JPG/JPEG files allowed"}), 400
    
    # Validate JPEG content
    is_valid, error_msg = validate_jpeg(file.stream, file.filename)
    file.stream.seek(0)  # Reset stream after validation
    
    if not is_valid:
        return jsonify({"error": error_msg}), 400
    
    # Save file with safe filename
    try:
        safe_filename = Path(file.filename).name
        file_path = art_path / safe_filename
        file.save(str(file_path))
        
        logger.info(f"Uploaded art image: {file_path}")
        return jsonify({
            "success": True,
            "filename": safe_filename,
            "path": str(file_path)
        })
    except Exception as e:
        logger.error(f"Failed to upload image: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/art/delete', methods=['POST'])
def delete_art_image():
    """Delete an image from the art directory"""
    data = request.get_json()
    directory = data.get('directory', '/local/art')
    filename = data.get('filename', '')
    
    if not filename:
        return jsonify({"error": "No filename provided"}), 400
    
    # Convert /local/art to /config/www/art path
    if directory.startswith('/local/'):
        dir_name = directory[7:]
        art_path = Path('/config/www') / dir_name
    else:
        art_path = Path('/config/www') / directory.strip('/')
    
    # Security check
    try:
        art_path = art_path.resolve()
        www_path = Path('/config/www').resolve()
        if not str(art_path).startswith(str(www_path)):
            return jsonify({"error": "Invalid directory path"}), 403
    except Exception as e:
        return jsonify({"error": f"Invalid path: {str(e)}"}), 400
    
    # Delete file
    try:
        file_path = art_path / Path(filename).name
        if file_path.exists():
            file_path.unlink()
            logger.info(f"Deleted art image: {file_path}")
            return jsonify({
                "success": True,
                "filename": filename,
                "message": f"Deleted {filename}"
            })
        else:
            return jsonify({"error": "File not found"}), 404
    except Exception as e:
        logger.error(f"Failed to delete image: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Development mode
    app.run(host='0.0.0.0', port=8099, debug=True)
