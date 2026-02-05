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

# Load version from config.yaml
ADDON_VERSION = "1.2.0"  # Default fallback
SCRIPT_DIR = Path(__file__).parent.parent
try:
    import yaml
    config_yaml_path = SCRIPT_DIR / 'config.yaml'
    if config_yaml_path.exists():
        with open(config_yaml_path, 'r') as f:
            config_data = yaml.safe_load(f)
            ADDON_VERSION = config_data.get('version', ADDON_VERSION)
except Exception:
    pass  # Use default version if config.yaml can't be read

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
    # Use the current config in memory (saved to staging first if needed)
    staging_file = ADDON_CONFIG / 'site_settings_staging.json'
    
    # If no staging file exists, we can't export
    if not staging_file.exists():
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
        'cover': COVER_SCHEMA
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
                "icon": "mdi:window-shutter",
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
                "description": "Background art slideshow",
                "icon": "mdi:image",
                "capabilities": ["display", "slideshow"],
                "status": "future"
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


if __name__ == '__main__':
    # Development mode
    app.run(host='0.0.0.0', port=8099, debug=True)
