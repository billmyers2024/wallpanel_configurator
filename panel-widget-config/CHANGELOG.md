# Changelog

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
