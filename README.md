# Panel Widget Configurator

Home Assistant Add-on for configuring ESPHome panel widgets with entity validation.

## Features

- **Visual Configuration**: Web-based UI for creating and managing room widgets
- **Entity Validation**: Validates entity IDs against your Home Assistant instance
- **Entity Picker**: Browse and select entities from your HA installation
- **Multi-Room Support**: Configure multiple rooms/devices with different settings
- **Staging/Live Workflow**: Save drafts locally, then publish to live config
- **Room Settings**: IP address, presence sensor, screen timeout, brightness, volume

## Supported Widgets

### Lights
- Types: `ph` (Power+Temp), `phb` (Power+Temp+Brightness), `phc` (Power+Temp+Color), `phbc` (Full)
- Icons: Downlight, Pendant, Wardrobe, Lamp, Spot, Strip

### Covers
- Types: Blind, Single Curtain, Double Curtain
- Custom up/down timing

### Climate
- Presence-based activation/deactivation
- Dual setpoint support
- Fan speed and dehumidify settings

## Installation

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**
2. Click **⋮ (menu) → Repositories**
3. Add: `https://github.com/billmyers2024/wallpanel_configurator`
4. Click **Add**, then **Close**
5. Find "Panel Widget Configurator" in the add-on store
6. Click **Install**
7. Start the add-on
8. Click **Open Web UI** or access via sidebar

## Usage

1. **Create Rooms**: Use "Add Room" button to create new rooms
2. **Room Settings**: Configure IP, presence sensor, screen settings (collapsible)
3. **Add Widgets**: Click "Add Light", "Add Cover", or "Add Climate"
4. **Configure**: Use entity picker or type entity IDs directly
5. **Validate**: Entities are validated against your HA instance
6. **Save**: Choose "Save Staging" (draft) or "Make Live" (publish)
7. **Export**: Download JSON configuration for backup

## Configuration File Locations

- **Staging configs**: `/config/panel_widgets/staging/`
- **Live config**: `/config/www/panel_widgets/site_settings.json`

The live config is accessible to ESP32 panels via:
```
http://your-ha-ip:8123/local/panel_widgets/site_settings.json
```

## JSON Format

```json
{
  "site_meta": {
    "version": "1.0",
    "last_updated": "2026-02-04"
  },
  "site_info": {
    "site_name": "My Home",
    "guest_ssid": "guest_wifi",
    "guest_wifi_password": "password"
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
        "lights": [...],
        "covers": [...],
        "climate": [...]
      }
    }
  ]
}
```

## Development

See [DEVELOPMENT.md](panel-widget-config/README.md) for local testing instructions.

## License

MIT License
