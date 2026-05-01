# Changelog

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
