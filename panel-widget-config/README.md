# Panel Widget Configurator

Home Assistant Add-on for configuring ESPHome panel widgets (lights, covers, climate, etc.)

## Features

- **Visual Configuration**: Web-based UI for creating and managing device widgets
- **Entity Validation**: Validates entity IDs against your Home Assistant instance
- **Entity Picker**: Browse and select entities from your HA installation
- **Multi-Room Support**: Configure multiple rooms/devices with different widgets
- **Staging/Live Workflow**: Save drafts or publish directly to live config
- **Room Settings**: IP address, presence sensor, voice assistant, screen timeout, brightness, volume

## Supported Widgets

### Lights
Light types use the key: `p`=power, `h`=hue/temperature, `b`=brightness, `c`=color

- `ph`: Power + Temperature (white temperature control)
- `phb`: Power + Temperature + Brightness
- `phc`: Power + Temperature + Color
- `phbc`: Full Control (Power + Temperature + Brightness + Color)

Icons: Downlight, Pendant, Wardrobe, Lamp, Spot, Strip

### Covers
- Types: Blind, Single Curtain, Double Curtain
- Custom up/down timing per cover

### Climate
- Presence-based activation/deactivation
- Presence deactivation timeout
- Low/High setpoints (°C)
- Default fan speed (Low/Medium/High)
- Auto dehumidify setpoint (%)
- Simple UI mode option

## Room Configuration

Each room can have:
- **Room Name**: Display name for the room
- **Device ID**: Unique identifier (used in MQTT topics)
- **IP Address**: Panel's network address
- **Presence Sensor**: Binary sensor entity for presence detection
- **Voice Assistant**: Enable/disable voice assistant
- **Use Presence for Screen**: Activate screen based on presence
- **Screen Timeout**: Seconds before screen dims (5-300)
- **Screen Brightness**: Default brightness % (10-100)
- **Volume**: Default speaker volume % (0-100)

## Installation (Local Development)

### Local Testing (No Home Assistant Required)

The app automatically detects when running locally:

```bash
cd panel-widget-config

# Install dependencies
pip install -r requirements.txt

# Run in local development mode
python app/main.py
```

**In local mode:**
- Config is stored in `./config_data/` 
- Templates loaded from `./templates/`
- Static files served from `./static/`
- Entity validation disabled (unless you provide HA_API)

**Access:** http://localhost:8099

### Local Testing WITH Home Assistant Connection

```bash
# Create a Long-Lived Access Token in HA (Profile → Long-Lived Access Tokens)
export HA_API=http://192.168.1.100:8123/api  # Your HA IP
export SUPERVISOR_TOKEN=your_token_here      # Your HA token

python app/main.py
```

## Configuration File Locations

When running as an add-on:
- **Staging configs**: `/config/panel_widgets/staging/`
- **Live config**: `/config/www/panel_widgets/site_settings.json`

When running locally:
- **Configs**: `./config_data/`

## Example Configuration

```json
{
  "site_meta": {
    "version": "1.0",
    "last_updated": "2026-02-04"
  },
  "site_info": {
    "site_name": "My Home",
    "guest_ssid": "guest_network",
    "guest_wifi_password": "secret"
  },
  "defaults": {
    "cover_opening_time": "08:00",
    "cover_closing_time": "19:00",
    "site_cover_up_time": 14300,
    "site_cover_down_time": 11500
  },
  "devices": [
    {
      "name": "Master Bedroom",
      "id": "master_bedroom",
      "ip": "10.0.0.15",
      "presence_entity": "binary_sensor.master_bedroom_presence",
      "voice_assistant_enabled": true,
      "use_presence_for_screen": true,
      "screen_timeout": 30,
      "screen_brightness": 80,
      "volume": 50,
      "widgets": {
        "lights": [
          {
            "entity": "light.master_bedroom_main",
            "name": "Main Light",
            "type": "phbc",
            "icon_id": 0
          }
        ],
        "covers": [
          {
            "entity": "cover.master_blind",
            "name": "Roller Blind",
            "type": "blind",
            "up_time_msecs": 14300,
            "down_time_msecs": 11500
          }
        ],
        "climate": [
          {
            "entity": "climate.master_bedroom",
            "name": "Bedroom AC",
            "use_presence_for_deactivation": true,
            "use_presence_for_activation": false,
            "presence_deactivation_time": 300,
            "default_fan_speed": "medium",
            "default_low_setpoint": 20,
            "default_high_setpoint": 24,
            "auto_dehumidify_setpoint": 60,
            "use_simple_ui": false
          }
        ]
      }
    }
  ]
}
```

## Building

```bash
docker build -t panel-widget-config .
docker run -p 8099:8099 -e SUPERVISOR_TOKEN=test panel-widget-config
```

## License

MIT License
