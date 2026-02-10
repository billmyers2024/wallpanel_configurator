# Changelog

## 1.4.2

### Changed
- Art Image Manager now validates uploaded images
  - Only 720x720 baseline JPG/JPEG files accepted
  - Progressive JPEGs rejected (not supported by ESP32 decoder)
  - Other formats (PNG, GIF, WEBP) rejected
  - Clear error messages for validation failures

### Fixed
- Fixed delete image functionality

## 1.4.1

### Fixed
- Fixed CSS file corruption that removed all styling
  - Restored original theme and component styles
  - Art widget styles properly appended

## 1.4.0

### Added
- Art Image Manager now shows thumbnail previews
  - 60x60px preview images for easier visual sorting
  - Hover to zoom effect on thumbnails
  - Number badges for each image position

## 1.3.9

### Fixed
- Art Image Manager API URLs now use relative paths
  - Fixes "Error loading images" 404 error
  - Compatible with Home Assistant ingress

## 1.3.8

### Added
- Art Widget Image Manager
  - New "Manage Images" button on Art widget panel
  - Upload images directly through the configurator (drag & drop or click)
  - Reorder images via drag and drop
  - Delete images from the web directory
  - Auto-generates JSON configuration entries for images
  - Supports JPG, PNG, GIF, WEBP formats

## 1.3.6

### Fixed
- Export configuration 404 error
  - Properly fallback to live config when staging not found
  - Add Docker cache-bust to ensure code updates deploy

## 1.3.5

### Fixed
- Export configuration now works correctly
  - Falls back to staging directory if main staging file not found
  - Falls back to live config if no staging files exist
  - Prevents 404 error when exporting saved configurations

## 1.3.4

### Fixed
- Fixed config loader buffer size for large site_settings.json files

## 1.3.3

### Fixed
- JavaScript syntax error: missing closing brace in addWidget function

## 1.3.2

### Fixed
- JavaScript syntax error preventing configurator from loading
- Added missing closing brace in app.js widget handling

## 1.3.1

### Fixed
- JavaScript syntax error in app.js (missing closing brace)

## 1.3.0

### Added
- Art Display widget support
  - Full-screen image slideshow from HA web directory
  - Configurable transition time (1-3600 seconds)
  - Presence-aware mode (only shows when room occupied)
  - Double buffering for smooth transitions
  - Touch-to-exit functionality
  - Support for PNG/JPG images (720x720 recommended)
  - Images served from /config/www/art/ directory
  - JSON schema validation for art widget configuration
  - UI configurator support for art widget settings

### Changed
- Art widget status changed from "future" to "stable"
- Updated widget type definitions to include art capabilities

## 1.2.22

### Fixed
- Tester widget now maps tests to correct slots based on test_id (test_1, test_2, etc.)
- All 4 test entries now display correctly regardless of order in JSON

## 1.2.21

### Fixed
- Tester widget create_binary_sensor mode now properly registers (constructs entity_id from device_name + test_id)
- Configurator now shows green ticks for create_binary_sensor mode tester widgets

## 1.2.20

### Fixed
- Tester widget UI debounce reduced to 200ms with delayed fallback update
- Config loader now populates tester globals (fixes config loading)
- Added debug logging to diagnose tester widget save issues

## 1.2.17

### Fixed
- Renamed "Room Options" to "Room Settings" for consistency
- Moved expand arrow next to heading (matches Site Settings layout)
- Fixed curtains and test-tube icons to match Material Design
- Added proper spacing between site settings and room sections
- Fixed tester widget save for "Create Binary Sensor" mode
- Room Settings now collapsed by default when selecting a room

### Added
- Door Sensor Entity field in room settings (for climate control)

### Changed
- Renamed "Volume (%)" to "Audio Volume (%)" in room settings

## 1.2.15

### Fixed
- Site settings panel no longer truncated when expanded/collapsed
- Room settings panel overflow issues resolved
- Widget container scrollbar now properly visible
- Covers icon corrected to show proper draped curtains

## 1.2.13

### Fixed
- Room settings styling now matches site settings (collapsible card layout)
- Added spacing between site settings and room panel
- Tester widget "Create Binary Sensor" mode now saves correctly
- Tester widget validation now shows green tick for create binary sensor mode

## 1.2.12

### Fixed
- MDI icon rendering for curtains and test-tube widgets
- Icon colors now use primary blue instead of gray

## 1.2.11

### Fixed
- Tester widget visibility in configurator UI
- Test slots now properly display with correct icons and styling
- Fixed missing test slot rendering in widget sections

## 1.2.10

### Added
- Initial support for tester widget (4 test slots)
- MDI icons for curtains (F1846) and test-tube (F0668)
- Conditional compilation support for tester feature

### Changed
- Unified widget configuration structure
- Improved widget validation and error handling

## 1.2.9

### Added
- Lights widget configuration support
- Covers widget configuration support
- Climate widget configuration support
- Home Assistant entity validation

### Fixed
- Various UI layout improvements
- Better error messaging for invalid entities
