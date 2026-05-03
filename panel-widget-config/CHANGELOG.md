# Changelog

## 1.7.52

### Added
- **Smartpanel Controller**: New real-time control interface at `/controller`
  - Parametric EQ designer with 6 bands (Peaking, Low/High Shelf, Low/High Pass)
  - Real-time canvas visualization of EQ curve, reference response, and net response
  - REW reference curve import (auto-normalizes absolute SPL exports)
  - Device selector populated from live config
  - "Send to Panel" pushes EQ settings via Home Assistant service calls
  - Clean separation from Configurator via distinct UI and navigation
- **Audio Test Widget (Firmware)**:
  - Explicit 0 dB codec gain initialization on boot (with post-init retry) and page load
  - Replaced gain slider with ±1 dB step buttons for precise adjustment
  - Clean EOF detection for network audio streams (distinguishes from underrun)
  - New HA API service `set_eq` for real-time EQ updates from Controller

### Changed
- **Backend**: Added `/controller` route, `/api/devices`, and `/api/device/<id>/eq` endpoints
- **Frontend**: New `controller.html`, `controller.js`, and `controller.css` for EQ management

## 1.7.45

### Added
- **Audio Service**: New site-level service for audio configuration
  - Audio Dictionary: map audio codes to WAV filenames with test button assignments (1-6)
  - Parametric EQ: configure up to 6 bands (type, frequency, Q, gain) from configurator
  - Media player entity and PA zones (future use)
- **Audio Test Widget**: Simplified to enable/disable only. Server config moved to Audio Service.
  - Buttons 1-6: configurable from audio dictionary
  - Buttons 7-9: fixed internal tones (1kHz sine, pink noise loop, sweep)
  - Button colors: configurable buttons use dark blue, fixed tones use brown/orange

### Changed
- **Slideshow Service**: Moved from root-level `slideshow` to `services.slideshow` in JSON
- **Audio Test Widget**: Removed per-device server IP/port fields (now in Audio Service)

## 1.7.44

### Fixed
- **Audio Test Widget**: Added missing `mdi:speaker` icon to Available Widgets panel
- **Audio Test Widget**: Added to widget sort order so it appears in correct position

## 1.7.43

### Added
- **Audio Test Widget**: New widget for testing speaker playback, codec gain, EQ, and network audio streaming
  - Configure audio server IP and port for network WAV streaming
  - Optional `sounds` array for custom playback entries
  - Widget appears in device configurator alongside other test widgets
  - Supports MJPEG sender protocol for streaming 48kHz/16-bit/mono WAV files

## 1.7.42

### Changed
- **Weather Widget**: Moved weather_entity and external_temp_entity to global site services
  - These settings are now configured once in Site Services > Weather section
  - Applies to all devices (panels) in the site
  - Device-specific widget config now only contains room_temp_entity and forecast_entity
  - Simplifies configuration when multiple panels share the same weather source

## 1.7.41

### Added
- **Weather Widget**: Added Daily Forecast Entity field
  - New configuration field for daily forecast sensor entity
  - Supports sensors like `sensor.xxx_daily_forecast` from HA
  - Enables 4-day weather forecast display on panel

## 1.7.38

### Changed
- **Weather Widget**: Updated weather condition labels in configurator
  - Renamed: Sunny → Sunny Day, Cloudy → Cloudy Day, Rainy → Rainy Day
  - Renamed: Drizzle → Drizzle Day, Windy → Windy Day, Hot → Scorching
  - Added night variants: Clear Night, Rainy Night, Cloudy Night, Windy Night
  - JSON keys remain unchanged for ESP32 compatibility

## 1.7.37

### Added
- **Weather Widget**: Added night mode variants for weather conditions
  - New conditions: Clear_Night, Rainy_Night, Cloudy_Night, Windy_Night
  - Web configurator updated with file inputs for night mode MJPEG files
  - ESP32 panel code supports all 4 new night modes
  - Night variants can use same MJPEG files as day or separate night-themed videos

## 1.7.36

### Fixed
- **Video Test Widget**: Fixed widget type naming consistency
  - Changed `video_test` to `test_video` throughout configurator
  - Now matches the widget registration name in firmware
  - Prevents duplicate/conflicting widget entries in site_settings.json

## 1.7.35

### Fixed
- **Entity Picker**: Fixed clicking on entity in search results not selecting it
  - Changed selector from `.entity-input` to `input` to work with all widget input types
  - Weather widget entity pickers now work correctly

## 1.7.34

### Changed
- **Weather Widget** improvements:
  - Moved MJPEG server settings and filename configuration to Site Services (global)
  - Weather widgets now reference the global site configuration
  - Added entity picker with HA search for Weather Entity and Room Temperature Entity
  - Site Services Weather section allows configuration of all MJPEG filenames:
    - sunny, cloudy, rainy, drizzle, stormy, windy, hot

## 1.7.33

### Fixed
- Added missing Weather Widget UI components to configurator
  - HTML template and section
  - JavaScript render functions
  - Add widget handling

## 1.7.32

### Added
- **Weather Widget** (`weather`) - New widget with animated MJPEG backgrounds
  - Displays animated weather backgrounds (sunny, rainy, cloudy, windy, etc.)
  - Left-side translucent panel showing weather info (temp, condition, date, time, room temp)
  - Configuration options: weather entity, room temp entity, MJPEG server settings
  - Supports test mode to cycle through different weather conditions
  - Requires MJPEG video files on server (rain.mjpeg, sunny.mjpeg, etc.)
