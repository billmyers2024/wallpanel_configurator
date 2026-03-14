# Panel Widget Configurator - Implementation Specification v1.7.1

## Overview

This document specifies the widget configurations for ART3, Test Video, Network Test, Plasma Effect, and the Slideshow Service. These definitions generate the JSON settings file consumed by the ESPHome smartpanel widgets.

**Default Server Configuration:**
- Default IP: `192.168.1.100`
- Default Port: `8090` (for all streaming/test services)

---

## 1. ART3 Widget (Per-Device)

The ART3 widget connects to the slideshow stream server and displays synchronized slideshow content.

### JSON Structure
```json
"art3": {
    "enabled": "Y",
    "presence_aware": "N",
    "suppress_screensaver": "N",
    "auto_start_after_sec": 0,
    "enabled_start_time": "00:00",
    "enabled_end_time": "23:59",
    "stream_server": "192.168.1.100",
    "stream_port": 8090
}
```

### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | string ("Y"/"N") | "Y" | Whether to add the widget to the device |
| `presence_aware` | string ("Y"/"N") | "N" | Turn off widget when no one is present |
| `suppress_screensaver` | string ("Y"/"N") | "N" | Disable screensaver while widget is running |
| `auto_start_after_sec` | integer | 0 | Auto-start slideshow after N seconds (0=disabled) |
| `enabled_start_time` | string (HH:MM) | "00:00" | Time of day when widget becomes available |
| `enabled_end_time` | string (HH:MM) | "23:59" | Time of day when widget becomes unavailable |
| `stream_server` | string | "192.168.1.100" | MJPEG/slideshow server IP address |
| `stream_port` | integer | 8090 | MJPEG/slideshow server port |

### UI Requirements
- Single-instance widget (one per device)
- Checkbox for Y/N fields
- Time picker for HH:MM fields
- Number input for seconds/port fields
- IP address input for server

---

## 2. Test Video Widget (Per-Device)

The Test Video widget provides streaming MJPEG and JPEG file testing capabilities.

### JSON Structure
```json
"test_video": {
    "streams": [
        {
            "name": "Test Stream",
            "video_server_ip": "192.168.1.100",
            "video_server_port": 8090,
            "jpeg_filename": "test1.jpg",
            "jpeg_scale": 0,
            "mjpeg_filename": "test.mjpeg",
            "mjpeg_fps": 60,
            "mjpeg_loopcnt": 0,
            "mjpeg_duration_secs": 0
        }
    ]
}
```

### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | "Test Stream" | Display name for this stream config |
| `video_server_ip` | string | "192.168.1.100" | Video server IP address |
| `video_server_port` | integer | 8090 | Video server port |
| `jpeg_filename` | string | "" | Static JPEG file to display |
| `jpeg_scale` | integer | 0 | Scale factor for JPEG (0=default) |
| `mjpeg_filename` | string | "" | MJPEG video file to play |
| `mjpeg_fps` | integer | 30 | Frames per second for MJPEG |
| `mjpeg_loopcnt` | integer | 0 | Number of loops (0=infinite) |
| `mjpeg_duration_secs` | integer | 0 | Max duration in seconds (0=no limit) |

### UI Requirements
- Multi-instance supported (array of streams)
- Text inputs for filenames and name
- Number inputs for port, fps, scale, loopcnt, duration
- IP address input

---

## 3. Network Test Widget (Per-Device)

Network throughput diagnostic tool.

### JSON Structure
```json
"network_test": {
    "enabled": "Y",
    "server_ip": "192.168.1.100",
    "server_port": 8090,
    "duration_sec": 10,
    "packet_size": 8192
}
```

### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | string ("Y"/"N") | "Y" | Whether to add the widget to the device |
| `server_ip` | string | "192.168.1.100" | Test server IP address |
| `server_port` | integer | 8090 | Test server port |
| `duration_sec` | integer | 10 | Test duration in seconds |
| `packet_size` | integer | 8192 | Packet size in bytes |

### UI Requirements
- Single-instance widget (one per device)
- Checkbox for enabled
- IP address input
- Number inputs for port, duration, packet_size

---

## 4. Plasma Effect Widget (Per-Device)

Graphic visualization demo with PPA-accelerated plasma effect.

### JSON Structure
```json
"plasma": {
    "enabled": "Y"
}
```

### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | string ("Y"/"N") | "Y" | Whether to add the widget to the device |

### UI Requirements
- Single-instance widget (one per device)
- Simple checkbox for enabled
- Future: May add effect type, colors, speed

---

## 5. Slideshow Service (Site-Wide)

The slideshow service manages site-wide synchronized slideshow content. This is configured in the Site Services section, not per-device.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER (mjpeg_sender)                        │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │ Playlist     │───▶│ Slideshow    │    │ MJPEG Streamer  │   │
│  │ Manager      │◀───│ Coordinator  │───▶│ (port 8090)     │   │
│  └──────────────┘    └──────────────┘    └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
           Binary Protocol    │    Binary Protocol
           (TCP 8090)         │    (TCP 8090)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT (ESP32)                               │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │ Slideshow    │───▶│ Content      │───▶│ PPA Renderer    │   │
│  │ State Mach   │◀───│ Buffer Mgr   │    │ - Transitions   │   │
│  └──────────────┘    └──────────────┘    └─────────────────┘   │
│  ┌──────────────┐                                               │
│  │ ART3 Widget  │◀── UI control (start/stop/gallery)            │
│  │ (pages/art3) │                                               │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

### JSON Structure
```json
"services": {
    "slideshow": {
        "server": "192.168.1.100",
        "stream_port": 8090,
        "http_port": 8080,
        "default_duration": 10,
        "slides": [
            {
                "type": "image",
                "filename": "image1.jpg",
                "scale": "crop_center",
                "ken_burns": false,
                "duration": 10,
                "transition": "fade"
            },
            {
                "type": "video",
                "filename": "video1.mjpeg",
                "scale": "crop_center",
                "fps": 25,
                "duration": 0,
                "loopcnt": 0
            }
        ]
    }
}
```

### Configuration Fields - Server

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `server` | string | "192.168.1.100" | Slideshow server IP |
| `stream_port` | integer | 8090 | Binary protocol port (MJPEG/Commands) |
| `http_port` | integer | 8080 | HTTP port for introspection/API |
| `default_duration` | integer | 10 | Default slide duration in seconds |

### Configuration Fields - Slides (Image)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | "image" | Must be "image" |
| `filename` | string | required | Image filename |
| `scale` | string | "crop_center" | "crop_center", "stretch", "fit_letterbox" |
| `ken_burns` | boolean | false | Enable Ken Burns effect |
| `duration` | integer | system default | Override duration in seconds |
| `transition` | string | "fade" | "cut", "fade", "slide_right", "slide_left" |

### Configuration Fields - Slides (Video)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | "video" | Must be "video" |
| `filename` | string | required | Video filename |
| `scale` | string | "crop_center" | "crop_center", "stretch", "fit_letterbox" |
| `fps` | integer | 25 | Frames per second (1-60) |
| `duration` | integer | 0 | Play duration in seconds (0=use default, infinite if no limit) |
| `loopcnt` | integer | 0 | Number of loops (0=infinite) |

### UI Requirements

#### Server Configuration Panel
- IP address input for server
- Number inputs for stream_port, http_port
- Number input for default_duration

#### Media Management Panel
- "Manage Images/Video" button opening modal
- Upload area (drag & drop + click) for images and videos
- List of available files on server

#### Playlist Editor
- Draggable list of slides (reorderable)
- Add/Remove slides
- Per-slide configuration form:
  - Type selector (Image/Video)
  - File selector dropdown
  - Scale selector
  - For images: Ken Burns checkbox, Transition selector, Duration
  - For videos: FPS input, Duration input, Loop count input
- Save button to generate playlist JSON

---

## 6. MJPEG Sender HTTP Server Extension (C++)

### Overview
The mjpeg_sender requires an HTTP server component for file introspection and upload management. This enables the configurator to query available media files and upload new content.

### HTTP Server Configuration

Add to `mjpeg_config.h`:
```cpp
struct MJPEGConfigData {
    // ... existing fields ...
    
    // HTTP server settings (NEW)
    int http_server_port;           // Default: 8080
    bool http_server_enabled;       // Default: true
};
```

Add to `mjpeg_sender_config.yaml`:
```yaml
# =============================================================================
# HTTP SERVER (for file introspection and upload)
# =============================================================================
http_server:
  # Enable HTTP server for file management
  enabled: true
  
  # HTTP port for file introspection and upload API
  # Must be different from the binary stream port (server.port)
  port: 8080
```

### HTTP API Endpoints

#### 1. GET /api/files
List all available media files.

**Response:**
```json
{
  "images": [
    {
      "filename": "image1.jpg",
      "path": "/home/vibe/esphome/mjpeg_streamer/jpeg_files/image1.jpg",
      "size": 12345,
      "modified": "2024-03-14T10:30:00Z",
      "width": 720,
      "height": 720
    }
  ],
  "videos": [
    {
      "filename": "video1.mjpeg",
      "path": "/home/vibe/esphome/mjpeg_streamer/mjpeg_files/video1.mjpeg",
      "size": 567890,
      "modified": "2024-03-14T11:00:00Z",
      "duration_sec": 30,
      "fps": 30
    }
  ]
}
```

#### 2. POST /api/upload
Upload a new file to the server.

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `file`: Binary file data
  - `type`: "image" or "video"

**Response:**
```json
{
  "success": true,
  "filename": "uploaded_image.jpg",
  "path": "/home/vibe/esphome/mjpeg_streamer/jpeg_files/uploaded_image.jpg",
  "size": 12345
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid file type or upload failed"
}
```

#### 3. DELETE /api/files/{filename}
Delete a file from the server.

**Request:**
- Query parameter: `type=image` or `type=video`

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

#### 4. GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "binary_port": 8090,
  "http_port": 8080
}
```

### Implementation Details

#### New Files
- `http_server.cpp` - HTTP server implementation
- `http_server.h` - HTTP server header

#### Modified Files
- `mjpeg_config.h` - Add HTTP server configuration
- `mjpeg_sender.cpp` - Integrate HTTP server thread

#### HTTP Server Thread
```cpp
// In mjpeg_sender.cpp main():
std::thread http_server(http_server_thread);
http_server.detach();

// HTTP server thread function
void http_server_thread() {
    // Create TCP socket
    // Bind to http_port
    // Listen for connections
    // Parse HTTP requests
    // Route to appropriate handler
}
```

#### CORS Support
All HTTP responses must include CORS headers for browser compatibility:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

### Security Considerations
- File uploads validated for type (JPEG/MJPEG only)
- Filename sanitization to prevent directory traversal
- File size limits (configurable, default 100MB)
- Read-only directories should be enforced

---

## Implementation Notes

### Widget Registration
Widgets self-register using the `WIDGET_REGISTER` macro with priority:
- Test Video: 70
- Plasma: 80
- Network Test: 90

### Protocol Markers
- MJPEG Frame: `0xFF 0xFE 0xFD 0xFC`
- JPEG Upload: `0xFF 0xFD 0xFC 0xFB`
- Command: `0xFE 0xFD 0xFC 0xFB`

### File Storage
- Images: `/config/www/art/` (existing ART display location) OR configured `image_dir`
- Videos: `/config/www/videos/` OR configured `mjpeg_dir`
- Slideshow config: `/config/panels/site_settings.json`

### HTTP Server Libraries
Options for C++ HTTP server implementation:
1. **Custom lightweight HTTP parser** (recommended for minimal dependencies)
2. **mongoose** (embedded web server library)
3. **cpp-httplib** (header-only library)

Recommended: Custom implementation using existing socket code for minimal dependencies.

---

## Task List

### Configurator Changes (Python/JS/HTML)
- [ ] Update ART3 widget schema with full configuration (8 fields)
- [ ] Fix Test Video widget schema (streams array)
- [ ] Fix Network Test widget schema (add enabled flag)
- [ ] Fix Plasma Effect widget schema (add enabled flag)
- [ ] Design Slideshow Service configuration UI
- [ ] Implement server configuration panel for slideshow
- [ ] Implement media upload functionality
- [ ] Implement playlist editor with drag-drop
- [ ] Update HTML templates for all widgets
- [ ] Update JavaScript render functions
- [ ] Update widget types API
- [ ] Test and validate all configurations

### MJPEG Sender Changes (C++)
- [ ] Add HTTP server configuration to mjpeg_config.h
- [ ] Create http_server.h header file
- [ ] Create http_server.cpp implementation
- [ ] Implement GET /api/files endpoint
- [ ] Implement POST /api/upload endpoint
- [ ] Implement DELETE /api/files/{filename} endpoint
- [ ] Implement GET /api/health endpoint
- [ ] Add CORS headers to all responses
- [ ] Integrate HTTP server thread into mjpeg_sender.cpp
- [ ] Add file validation (type, size, name sanitization)
- [ ] Test HTTP server with curl/browser
- [ ] Test configurator integration
