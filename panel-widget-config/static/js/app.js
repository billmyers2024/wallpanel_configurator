/**
 * Panel Widget Configurator - Main Application
 */

const app = {
    // State
    config: null,
    currentDevice: null,
    currentDeviceIndex: -1,
    widgetTypes: [],
    
    // Initialize
    init() {
        this.loadWidgetTypes();
        this.loadConfig();
        this.setupEventListeners();
    },
    
    // Load widget types from API
    async loadWidgetTypes() {
        try {
            const response = await fetch('api/widget-types');
            const data = await response.json();
            this.widgetTypes = data.widgets;
            this.renderWidgetTypes();
        } catch (error) {
            console.error('Failed to load widget types:', error);
        }
    },
    
    // Load configuration from API with timeout
    async loadConfig() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        try {
            this.showToast('Loading configuration...', 'info');
            const response = await fetch('api/config', { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.config = await response.json();
            
            // Ensure devices array exists
            if (!this.config.devices) {
                this.config.devices = [];
            }
            
            this.renderDeviceList();
            if (this.currentDeviceIndex >= 0) {
                this.selectDevice(this.currentDeviceIndex);
            }
            this.showToast('Live configuration loaded', 'success');
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                this.showToast('Request timed out - HA API may be unavailable', 'error');
            } else {
                this.showToast(`Failed to load: ${error.message}`, 'error');
            }
            console.error('Failed to load config:', error);
            // Set default empty config so UI doesn't break
            if (!this.config) {
                this.config = this.getDefaultConfig();
                this.renderDeviceList();
            }
        }
    },
    
    // Get default empty configuration
    getDefaultConfig() {
        return {
            site_meta: { version: '1.6', last_updated: new Date().toISOString().split('T')[0] },
            site_info: { site_name: 'My Home', guest_ssid: '', guest_wifi_password: '' },
            defaults: { cover_opening_time: '08:00', cover_closing_time: '19:00', site_cover_up_time: 14300, site_cover_down_time: 11500 },
            services: { cameras: [] },
            devices: []
        };
    },
    
    // Save configuration - shows prompt for Make Live vs Staging
    async saveConfig() {
        // Update current device from form
        if (this.currentDevice) {
            this.updateDeviceFromForm();
        }
        
        // Validate all devices have IP addresses and check for duplicates
        if (this.config && this.config.devices) {
            const ipMap = new Map();
            
            for (const device of this.config.devices) {
                // Check for missing IP
                if (!device.ip || device.ip.trim() === '') {
                    this.showToast(`Device "${device.name}" is missing IP address`, 'error');
                    const idx = this.config.devices.indexOf(device);
                    if (idx >= 0) this.selectDevice(idx);
                    return;
                }
                
                // Validate IP format
                if (!this.validateIP(device.ip)) {
                    this.showToast(`Device "${device.name}" has invalid IP: ${device.ip}`, 'error');
                    const idx = this.config.devices.indexOf(device);
                    if (idx >= 0) this.selectDevice(idx);
                    return;
                }
                
                // Check for duplicate IP
                const ip = device.ip.trim();
                if (ipMap.has(ip)) {
                    const otherDevice = ipMap.get(ip);
                    this.showToast(`Duplicate IP: "${device.name}" and "${otherDevice}" both use ${ip}`, 'error');
                    const idx = this.config.devices.indexOf(device);
                    if (idx >= 0) this.selectDevice(idx);
                    return;
                }
                ipMap.set(ip, device.name);
            }
        }
        
        // Update site settings
        this.updateSiteSettings();
        
        // Show save prompt modal
        this.showSavePromptModal();
    },
    
    // Show save prompt modal (Make Live vs Staging)
    showSavePromptModal() {
        document.getElementById('save-prompt-modal').classList.add('active');
    },
    
    // Close save prompt modal
    closeSavePromptModal() {
        document.getElementById('save-prompt-modal').classList.remove('active');
    },
    
    // Save and make live
    async doSaveLive() {
        this.closeSavePromptModal();
        
        try {
            const response = await fetch('api/config/save-live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.config)
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showToast('Configuration saved and is now LIVE!', 'success');
            } else {
                const error = await response.json();
                this.showToast(error.error || 'Failed to make live', 'error');
            }
        } catch (error) {
            console.error('Failed to save live:', error);
            this.showToast('Failed to save configuration', 'error');
        }
    },
    
    // Save to staging (show filename dialog)
    doSaveStaging() {
        this.closeSavePromptModal();
        this.showStagingModal();
    },
    
    // Show staging filename modal
    showStagingModal() {
        // Set default filename with timestamp
        const date = new Date().toISOString().slice(0, 10);
        document.getElementById('staging-filename').value = `site_settings_${date}`;
        document.getElementById('staging-modal').classList.add('active');
    },
    
    // Close staging modal
    closeStagingModal() {
        document.getElementById('staging-modal').classList.remove('active');
    },
    
    // Save to staging file
    async doSaveStagingFile() {
        const filename = document.getElementById('staging-filename').value.trim() || 'site_settings_staging';
        this.closeStagingModal();
        
        try {
            const response = await fetch('api/config/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({...this.config, _filename: filename})
            });
            
            if (response.ok) {
                const result = await response.json();
                this.showToast(`Configuration saved to staging: ${result.filename}`, 'success');
            } else {
                const error = await response.json();
                this.showToast(error.error || 'Failed to save', 'error');
            }
        } catch (error) {
            console.error('Failed to save staging:', error);
            this.showToast('Failed to save configuration', 'error');
        }
    },
    
    // Update site settings from form
    updateSiteSettings() {
        if (!this.config) return;
        
        // Ensure structure exists
        if (!this.config.site_info) this.config.site_info = {};
        if (!this.config.defaults) this.config.defaults = {};
        if (!this.config.site_meta) this.config.site_meta = {};
        
        // Update fields
        const siteName = document.getElementById('site-name');
        const guestSsid = document.getElementById('guest-ssid');
        const guestPassword = document.getElementById('guest-password');
        const coverOpening = document.getElementById('cover-opening-time');
        const coverClosing = document.getElementById('cover-closing-time');
        const siteCoverUp = document.getElementById('site-cover-up-time');
        const siteCoverDown = document.getElementById('site-cover-down-time');
        const siteVersion = document.getElementById('site-version');
        
        if (siteName) this.config.site_info.site_name = siteName.value;
        if (guestSsid) this.config.site_info.guest_ssid = guestSsid.value;
        if (guestPassword) this.config.site_info.guest_wifi_password = guestPassword.value;
        if (coverOpening) this.config.defaults.cover_opening_time = coverOpening.value;
        if (coverClosing) this.config.defaults.cover_closing_time = coverClosing.value;
        if (siteCoverUp) this.config.defaults.site_cover_up_time = parseInt(siteCoverUp.value) || 14300;
        if (siteCoverDown) this.config.defaults.site_cover_down_time = parseInt(siteCoverDown.value) || 11500;
        
        // Auto-increment version on save
        if (siteVersion) {
            const currentVersion = parseFloat(siteVersion.value) || 1.0;
            this.config.site_meta.version = (currentVersion + 0.1).toFixed(1);
            siteVersion.value = this.config.site_meta.version;
        }
        
        this.config.site_meta.last_updated = new Date().toISOString().split('T')[0];
    },
    
    // Show load file modal - loads staging files list
    async showLoadModal() {
        document.getElementById('load-modal').classList.add('active');
        await this.refreshStagingFiles();
    },
    
    // Refresh staging files list
    async refreshStagingFiles() {
        try {
            const response = await fetch('api/config/staging');
            const data = await response.json();
            
            const listEl = document.getElementById('staging-files-list');
            
            if (!data.files || data.files.length === 0) {
                listEl.innerHTML = '<p class="text-muted">No staging files found</p>';
                return;
            }
            
            listEl.innerHTML = data.files.map(file => `
                <div class="staging-file-item" onclick="app.loadStagingFile('${file.name}')">
                    <i class="fas fa-file-code file-icon"></i>
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-meta">${file.modified} · ${(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <i class="fas fa-trash file-delete" onclick="event.stopPropagation(); app.deleteStagingFile('${file.name}')"></i>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load staging files:', error);
            document.getElementById('staging-files-list').innerHTML = '<p class="text-muted">Failed to load staging files</p>';
        }
    },
    
    // Load a specific staging file
    async loadStagingFile(filename) {
        try {
            const response = await fetch(`api/config/staging/${encodeURIComponent(filename)}`);
            const data = await response.json();
            
            if (response.ok) {
                this.config = data;
                this.currentDevice = null;
                this.currentDeviceIndex = -1;
                this.renderDeviceList();
                this.renderEditor();
                this.closeLoadModal();
                this.showToast(`Loaded staging: ${filename}`, 'success');
            } else {
                this.showToast(data.error || 'Failed to load staging file', 'error');
            }
        } catch (error) {
            console.error('Failed to load staging file:', error);
            this.showToast('Failed to load staging file', 'error');
        }
    },
    
    // Delete a staging file
    async deleteStagingFile(filename) {
        if (!confirm(`Delete staging file "${filename}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`api/config/staging/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showToast('Staging file deleted', 'success');
                await this.refreshStagingFiles();
            } else {
                this.showToast(data.error || 'Failed to delete', 'error');
            }
        } catch (error) {
            console.error('Failed to delete staging file:', error);
            this.showToast('Failed to delete staging file', 'error');
        }
    },
    
    // Close load modal
    closeLoadModal() {
        document.getElementById('load-modal').classList.remove('active');
        document.getElementById('config-file-input').value = '';
    },
    
    // Load configuration from file
    async loadFile() {
        const fileInput = document.getElementById('config-file-input');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showToast('Please select a file', 'warning');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch('api/config/import', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.config = result.config;
                this.currentDevice = null;
                this.currentDeviceIndex = -1;
                this.renderDeviceList();
                this.renderEditor();
                this.closeLoadModal();
                this.showToast(result.message, 'success');
            } else {
                this.showToast(result.error || 'Failed to load file', 'error');
            }
        } catch (error) {
            console.error('Failed to upload file:', error);
            this.showToast('Failed to load file', 'error');
        }
    },
    
    // Show export modal
    showExportModal() {
        document.getElementById('export-modal').classList.add('active');
    },
    
    // Close export modal
    closeExportModal() {
        document.getElementById('export-modal').classList.remove('active');
    },
    
    // Export configuration
    doExport() {
        const filename = document.getElementById('export-filename').value || 'site_settings';
        // Use relative URL for ingress compatibility
        window.open(`api/config/export/${filename}`, '_blank');
        this.closeExportModal();
    },
    
    // Make configuration live
    async makeLive() {
        try {
            const response = await fetch('api/config/make-live', {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(result.message, 'success');
            } else {
                this.showToast(result.error || 'Failed to make live', 'error');
            }
        } catch (error) {
            console.error('Failed to make live:', error);
            this.showToast('Failed to make configuration live', 'error');
        }
    },
    
    // Add new device
    addDevice() {
        if (!this.config) {
            this.config = {
                site_meta: { version: "1.0", last_updated: new Date().toISOString().split('T')[0] },
                site_info: { site_name: "My Home", guest_ssid: "", guest_wifi_password: "" },
                defaults: { cover_opening_time: "08:00", cover_closing_time: "19:00", climate_check_interval: 60 },
                devices: []
            };
        }
        
        if (!this.config.devices) {
            this.config.devices = [];
        }
        
        const device = {
            name: `Room ${this.config.devices.length + 1}`,
            id: `room_${this.config.devices.length + 1}`,
            ip: "",
            widgets: {
                lights: [],
                covers: [],
                climate: [],
                climate2: [],
                tests: [],
                art: null
            }
        };
        
        this.config.devices.push(device);
        this.renderDeviceList();
        this.selectDevice(this.config.devices.length - 1);
        this.showToast('New room added', 'success');
    },
    
    // Delete current device
    deleteCurrentDevice() {
        if (!this.currentDevice) return;
        
        if (confirm(`Delete room "${this.currentDevice.name}"?`)) {
            this.config.devices.splice(this.currentDeviceIndex, 1);
            this.currentDevice = null;
            this.currentDeviceIndex = -1;
            this.renderDeviceList();
            this.renderEditor();
            this.showToast('Room deleted', 'success');
        }
    },
    
    // Select device for editing
    selectDevice(index) {
        this.updateDeviceFromForm(); // Save current before switching
        this.currentDeviceIndex = index;
        this.currentDevice = this.config.devices[index];
        this.renderDeviceList(); // Update active state
        this.renderEditor();
    },
    
    // Validate IP address format
    validateIP(ip) {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    },
    
    // Update device from form data
    updateDeviceFromForm() {
        if (!this.currentDevice) return;
        
        const nameInput = document.getElementById('device-name');
        const idInput = document.getElementById('device-id');
        const ipInput = document.getElementById('device-ip');
        
        if (nameInput) this.currentDevice.name = nameInput.value;
        if (idInput) this.currentDevice.id = idInput.value;
        if (ipInput) {
            const ip = ipInput.value.trim();
            if (ip && !this.validateIP(ip)) {
                this.showToast(`Invalid IP address: ${ip}`, 'error');
                ipInput.style.borderColor = 'var(--danger)';
            } else {
                ipInput.style.borderColor = '';
                this.currentDevice.ip = ip;
            }
        }
        
        // Update new room config fields
        const presenceEntity = document.getElementById('presence-entity');
        const doorEntity = document.getElementById('door-entity');
        const roomTempEntity = document.getElementById('room-temp-entity');
        const voiceEnabled = document.getElementById('voice-assistant-enabled');
        const usePresence = document.getElementById('use-presence-for-screen');
        const screenTimeout = document.getElementById('screen-timeout');
        const screenBrightness = document.getElementById('screen-brightness');
        const volume = document.getElementById('volume');
        
        if (presenceEntity) this.currentDevice.presence_entity = presenceEntity.value;
        if (doorEntity) this.currentDevice.door_entity = doorEntity.value;
        if (roomTempEntity) this.currentDevice.room_temp_entity = roomTempEntity.value;
        if (voiceEnabled) this.currentDevice.voice_assistant_enabled = voiceEnabled.checked;
        if (usePresence) this.currentDevice.use_presence_for_screen = usePresence.checked;
        if (screenTimeout) this.currentDevice.screen_timeout = parseInt(screenTimeout.value) || 30;
        if (screenBrightness) this.currentDevice.screen_brightness = parseInt(screenBrightness.value) || 80;
        if (volume) this.currentDevice.volume = parseInt(volume.value) || 50;
        
        // Update widget data from cards
        this.updateWidgetsFromCards('lights');
        this.updateWidgetsFromCards('covers');
        this.updateWidgetsFromCards('climate');
        this.updateWidgetsFromCards('climate2');
        this.updateWidgetsFromCards('tests');
        this.updateArtFromForm();
        
        // Phase 1: Update cameras and new widgets
        this.updateCamerasFromForm();
        this.updateWeatherServiceFromForm();
        this.updateCCTVFromForm();
        this.updateAlarmPanelFromForm();
        this.updatePlasmaFromForm();
        this.updateNetworkTestFromForm();
        this.updateArt3FromForm();
        
        // Save slideshow settings from form to config
        this.updateSlideshowSettingsFromForm();
    },
    
    // Update slideshow settings from form fields
    updateSlideshowSettingsFromForm() {
        const serverInput = document.getElementById('slideshow-server');
        const streamPortInput = document.getElementById('slideshow-stream-port');
        const httpPortInput = document.getElementById('slideshow-http-port');
        const durationInput = document.getElementById('slideshow-default-duration');
        
        if (!this.config.slideshow) {
            this.config.slideshow = {};
        }
        
        if (serverInput) this.config.slideshow.server = serverInput.value || '192.168.1.100';
        if (streamPortInput) this.config.slideshow.stream_port = parseInt(streamPortInput.value) || 8090;
        if (httpPortInput) this.config.slideshow.http_port = parseInt(httpPortInput.value) || 8050;
        if (durationInput) this.config.slideshow.default_duration = parseInt(durationInput.value) || 10;
    },
    
    // Update widget array from card forms
    updateWidgetsFromCards(type) {
        const container = document.getElementById(`${type}-list`);
        if (!container) return;
        
        const cards = container.querySelectorAll('.widget-card');
        const widgets = [];
        
        cards.forEach(card => {
            const entityInput = card.querySelector('.entity-input');
            const entity = entityInput ? entityInput.value : '';
            const name = card.querySelector('.name-input').value;
            
            // For tester widgets in create_binary_sensor mode, we don't need an entity
            const modeInput = card.querySelector('.mode-input');
            const isTesterCreateMode = (type === 'tests') && 
                (modeInput?.value === 'create_binary_sensor');
            
            // Skip empty widgets, but allow tester create mode without entity
            if (!entity && !isTesterCreateMode) return;
            
            if (type === 'lights') {
                widgets.push({
                    entity,
                    name: name || entity,
                    type: card.querySelector('.type-input').value,
                    icon_id: card.querySelector('.icon-input').value
                });
            } else if (type === 'covers') {
                widgets.push({
                    entity,
                    name: name || entity,
                    type: card.querySelector('.type-input').value,
                    up_time_msecs: parseInt(card.querySelector('.uptime-input').value) || 14300,
                    down_time_msecs: parseInt(card.querySelector('.downtime-input').value) || 11500
                });
            } else if (type === 'climate') {
                widgets.push({
                    entity,
                    name: name || entity,
                    use_presence_for_deactivation: card.querySelector('.presence-deactivate-input').checked,
                    use_presence_for_activation: card.querySelector('.presence-activate-input').checked,
                    presence_deactivation_time: parseInt(card.querySelector('.presence-timeout-input').value) || 300,
                    default_fan_speed: card.querySelector('.fan-speed-input').value,
                    default_low_setpoint: parseFloat(card.querySelector('.low-setpoint-input').value) || 20,
                    default_high_setpoint: parseFloat(card.querySelector('.high-setpoint-input').value) || 24,
                    auto_dehumidify_setpoint: parseInt(card.querySelector('.dehumidify-input').value) || 60,
                    use_simple_ui: card.querySelector('.simple-ui-input').checked
                });
            } else if (type === 'climate2') {
                widgets.push({
                    entity,
                    name: name || entity,
                    ui_mode: card.querySelector('.ui-mode-input').value,
                    use_presence_for_deactivation: card.querySelector('.presence-deactivate-input').checked,
                    use_presence_for_activation: card.querySelector('.presence-activate-input').checked,
                    presence_deactivation_time: parseInt(card.querySelector('.presence-timeout-input').value) || 300,
                    default_fan_speed: card.querySelector('.fan-speed-input').value,
                    default_low_setpoint: parseFloat(card.querySelector('.low-setpoint-input').value) || 20,
                    default_high_setpoint: parseFloat(card.querySelector('.high-setpoint-input').value) || 24,
                    auto_dehumidify_setpoint: parseInt(card.querySelector('.dehumidify-input').value) || 60
                });
            } else if (type === 'tests') {
                const mode = card.querySelector('.mode-input').value;
                const deviceNameInput = card.querySelector('.device-name-input');
                const deviceName = deviceNameInput ? deviceNameInput.value : 'Panel';
                const testId = card.querySelector('.test-id-input').value;
                
                console.log('Saving tester widget:', { mode, deviceName, testId, entity, name });
                
                // Always save tester widgets - generate name if needed
                let displayName = name;
                if (!displayName) {
                    if (mode === 'create_binary_sensor') {
                        displayName = `${deviceName} ${testId}`;
                    } else {
                        displayName = entity || 'Unnamed Test';
                    }
                }
                
                const widget = {
                    name: displayName,
                    mode: mode,
                    test_id: testId
                };
                if (mode === 'existing_switch') {
                    widget.entity = entity;
                } else {
                    widget.device_name = deviceName || 'Panel';
                }
                
                widgets.push(widget);
            }
        });
        
        this.currentDevice.widgets[type] = widgets;
        
        // Update badge immediately
        this.updateWidgetCount(type);
    },
    
    // Update art widget from form (special case - single instance, different structure)
    updateArtFromForm() {
        if (!this.currentDevice) return;
        
        const container = document.getElementById('art-list');
        if (!container) return;
        
        const card = container.querySelector('.widget-card');
        if (!card) {
            // No art widget configured
            this.currentDevice.widgets.art = null;
            return;
        }
        
        const directory = card.querySelector('.art-directory')?.value || '/local/art';
        const transitionTime = parseInt(card.querySelector('.art-transition')?.value || '5');
        const presenceAware = card.querySelector('.art-presence')?.value || 'N';
        const presenceSensor = card.querySelector('.art-presence-sensor')?.value || '';
        const imagesText = card.querySelector('.art-images')?.value || '';
        
        // Parse images (one per line)
        const images = imagesText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        this.currentDevice.widgets.art = {
            directory,
            transition_time: transitionTime,
            presence_aware: presenceAware,
            presence_sensor: presenceAware === 'Y' ? presenceSensor : '',
            images
        };
        
        // Update badge
        this.updateWidgetCount('art');
    },
    
    // Phase 1: Update CCTV widgets from form
    updateCCTVFromForm() {
        if (!this.currentDevice) return;
        
        const container = document.getElementById('cctv-list');
        if (!container) return;
        
        const cards = container.querySelectorAll('.widget-card');
        const cctvWidgets = [];
        
        cards.forEach(card => {
            const cameraId = card.querySelector('.camera-id-input')?.value?.trim();
            if (!cameraId) return; // Skip empty
            
            const widget = {
                id: cameraId,
                show_cam_entity: card.querySelector('.show-cam-entity')?.value?.trim() || ''
            };
            
            // Optional name override
            const nameOverride = card.querySelector('.camera-name-input')?.value?.trim();
            if (nameOverride) {
                widget.name = nameOverride;
            }
            
            cctvWidgets.push(widget);
        });
        
        if (cctvWidgets.length > 0) {
            this.currentDevice.widgets.cctv = cctvWidgets;
        } else {
            delete this.currentDevice.widgets.cctv;
        }
        
        this.updateWidgetCount('cctv');
    },
    
    // Phase 1: Update Alarm Panel widget from form
    updateAlarmPanelFromForm() {
        if (!this.currentDevice) return;
        
        const container = document.getElementById('alarm-panel-list');
        if (!container) return;
        
        const card = container.querySelector('.widget-card');
        if (!card) {
            // No alarm panel configured
            delete this.currentDevice.widgets.alarm_panel;
            return;
        }
        
        const entity = card.querySelector('.entity-input')?.value?.trim();
        if (!entity) {
            delete this.currentDevice.widgets.alarm_panel;
            return;
        }
        
        this.currentDevice.widgets.alarm_panel = {
            entity: entity,
            name: card.querySelector('.name-input')?.value?.trim() || 'Alarm',
            auto_hide_sec: parseInt(card.querySelector('.auto-hide-input')?.value) || 30
        };
        
        this.updateWidgetCount('alarm_panel');
    },
    
    // Phase 1: Update Plasma widget from form
    updatePlasmaFromForm() {
        if (!this.currentDevice) return;
        
        const container = document.getElementById('plasma-list');
        if (!container) return;
        
        const card = container.querySelector('.widget-card');
        if (!card) {
            // No plasma widget configured
            delete this.currentDevice.widgets.plasma;
            return;
        }
        
        // Widget exists, just keep the enabled flag
        this.currentDevice.widgets.plasma = {
            enabled: 'Y'
        };
        
        this.updateWidgetCount('plasma');
    },
    
    // Phase 1: Update Network Test widget from form
    updateNetworkTestFromForm() {
        if (!this.currentDevice) return;
        
        const container = document.getElementById('network-test-list');
        if (!container) return;
        
        const card = container.querySelector('.widget-card');
        if (!card) {
            // No network test widget configured
            delete this.currentDevice.widgets.network_test;
            return;
        }
        
        this.currentDevice.widgets.network_test = {
            enabled: 'Y',
            server_ip: card.querySelector('.server-ip-input')?.value?.trim() || '192.168.1.100',
            server_port: parseInt(card.querySelector('.server-port-input')?.value) || 8090,
            duration_sec: parseInt(card.querySelector('.duration-input')?.value) || 10,
            packet_size: parseInt(card.querySelector('.packet-size-input')?.value) || 8192
        };
        
        this.updateWidgetCount('network_test');
    },
    
    // Phase 1: Update ART3 widget from form
    updateArt3FromForm() {
        if (!this.currentDevice) return;
        
        const container = document.getElementById('art3-list');
        if (!container) return;
        
        const card = container.querySelector('.widget-card');
        if (!card) {
            // No ART3 widget configured
            delete this.currentDevice.widgets.art3;
            return;
        }
        
        this.currentDevice.widgets.art3 = {
            enabled: 'Y',
            presence_aware: card.querySelector('.presence-aware-input')?.checked ? 'Y' : 'N',
            suppress_screensaver: card.querySelector('.suppress-screensaver-input')?.checked ? 'Y' : 'N',
            auto_start_after_sec: parseInt(card.querySelector('.auto-start-input')?.value) || 0,
            enabled_start_time: card.querySelector('.start-time-input')?.value || '00:00',
            enabled_end_time: card.querySelector('.end-time-input')?.value || '23:59',
            stream_server: card.querySelector('.stream-server-input')?.value?.trim() || '192.168.1.100',
            stream_port: parseInt(card.querySelector('.stream-port-input')?.value) || 8090
        };
        
        this.updateWidgetCount('art3');
    },
    
    // =========================================================================
    // ART WIDGET - Image Manager
    // =========================================================================
    
    // Open the art image manager modal
    async openArtImageManager(button) {
        // Get the art widget card
        const card = button.closest('.widget-card');
        if (!card) return;
        
        // Get current directory
        const directory = card.querySelector('.art-directory')?.value || '/local/art';
        document.getElementById('art-manager-directory').value = directory;
        
        // Store reference to current art widget for later
        this.currentArtWidget = card;
        
        // Show modal
        document.getElementById('art-image-manager-modal').style.display = 'flex';
        
        // Load images
        await this.loadArtImages(directory);
    },
    
    // Close the art image manager modal
    closeArtImageManager() {
        document.getElementById('art-image-manager-modal').style.display = 'none';
        this.currentArtWidget = null;
    },
    
    // Load images from the art directory
    async loadArtImages(directory) {
        const listContainer = document.getElementById('art-image-list');
        listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
        
        try {
            const response = await fetch(`api/art/images?directory=${encodeURIComponent(directory)}`);
            const data = await response.json();
            
            if (!data.success) {
                listContainer.innerHTML = `<div style="padding: 20px; color: var(--danger);">Error: ${data.error}</div>`;
                return;
            }
            
            // Get current images from widget
            const currentImages = this.currentDevice?.widgets?.art?.images || [];
            
            // Render images in order, with any new images at the end
            const imagesToShow = [...currentImages];
            
            // Add any images from directory that aren't in current list
            data.images.forEach(img => {
                if (!imagesToShow.includes(img)) {
                    imagesToShow.push(img);
                }
            });
            
            if (imagesToShow.length === 0) {
                listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No images found. Upload some images to get started.</div>';
                return;
            }
            
            // Render image list with thumbnails
            const haBaseUrl = window.location.origin;  // Get HA base URL
            listContainer.innerHTML = imagesToShow.map((img, index) => {
                const imageUrl = `${haBaseUrl}/local/art/${encodeURIComponent(img)}`;
                return `
                <div class="art-image-item" draggable="true" data-filename="${img}" style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color); background: var(--bg-secondary); cursor: grab; gap: 10px;">
                    <span class="drag-handle" style="color: var(--text-muted); cursor: grab;"><i class="fas fa-grip-vertical"></i></span>
                    <span class="image-number" style="color: var(--text-muted); min-width: 25px; text-align: center;">${index + 1}</span>
                    <img src="${imageUrl}" alt="${img}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color); flex-shrink: 0;" onerror="this.style.display='none'">
                    <span class="image-name" style="flex: 1; font-family: monospace; font-size: 12px; word-break: break-all;">${img}</span>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteArtImage('${img}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `}).join('');
            
            // Setup drag and drop
            this.setupArtImageDragAndDrop();
            
        } catch (error) {
            console.error('Failed to load images:', error);
            listContainer.innerHTML = `<div style="padding: 20px; color: var(--danger);">Error loading images: ${error.message}</div>`;
        }
    },
    
    // Setup drag and drop for image reordering
    setupArtImageDragAndDrop() {
        const list = document.getElementById('art-image-list');
        let draggedItem = null;
        
        list.querySelectorAll('.art-image-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
            });
            
            item.addEventListener('dragend', () => {
                item.style.opacity = '1';
                draggedItem = null;
                this.updateArtImageNumbers();
            });
            
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                if (draggedItem && draggedItem !== item) {
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    
                    if (e.clientY < midY) {
                        item.parentNode.insertBefore(draggedItem, item);
                    } else {
                        item.parentNode.insertBefore(draggedItem, item.nextSibling);
                    }
                }
            });
        });
    },
    
    // Update image numbers after reordering
    updateArtImageNumbers() {
        document.querySelectorAll('.art-image-item').forEach((item, index) => {
            item.querySelector('.image-number').textContent = `${index + 1}.`;
        });
    },
    
    // Upload new images
    async uploadArtImages(input) {
        const files = input.files;
        if (!files || files.length === 0) return;
        
        const directory = document.getElementById('art-manager-directory').value;
        const uploadArea = document.querySelector('.file-upload-area');
        const originalContent = uploadArea.innerHTML;
        
        uploadArea.innerHTML = `<i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i><p>Uploading ${files.length} image(s)...</p>`;
        
        let successCount = 0;
        let errorCount = 0;
        let errorMessages = [];
        
        for (const file of files) {
            // Pre-validate file extension
            if (!file.name.toLowerCase().endsWith('.jpg') && !file.name.toLowerCase().endsWith('.jpeg')) {
                errorCount++;
                errorMessages.push(`${file.name}: Only JPG/JPEG files allowed`);
                continue;
            }
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('directory', directory);
            
            try {
                const response = await fetch('api/art/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                if (data.success) {
                    successCount++;
                } else {
                    errorCount++;
                    errorMessages.push(`${file.name}: ${data.error}`);
                    console.error(`Failed to upload ${file.name}:`, data.error);
                }
            } catch (error) {
                errorCount++;
                errorMessages.push(`${file.name}: Network error`);
                console.error(`Error uploading ${file.name}:`, error);
            }
        }
        
        // Restore upload area
        uploadArea.innerHTML = originalContent;
        
        // Show result
        if (successCount > 0) {
            this.showToast(`Uploaded ${successCount} image(s)`, 'success');
        }
        if (errorCount > 0) {
            // Show detailed error for first error
            const firstError = errorMessages[0];
            this.showToast(firstError, 'error', 5000);
            if (errorMessages.length > 1) {
                this.showToast(`${errorMessages.length - 1} more file(s) failed`, 'warning');
            }
        }
        
        // Reload image list
        await this.loadArtImages(directory);
        
        // Clear input
        input.value = '';
    },
    
    // Delete an image
    async deleteArtImage(filename) {
        if (!confirm(`Are you sure you want to delete "${filename}"?\n\nThis cannot be undone.`)) {
            return;
        }
        
        const directory = document.getElementById('art-manager-directory').value;
        
        try {
            const response = await fetch('api/art/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ directory, filename })
            });
            
            const data = await response.json();
            if (data.success) {
                this.showToast(`Deleted ${filename}`, 'success');
                await this.loadArtImages(directory);
            } else {
                this.showToast(`Failed to delete: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('Failed to delete image:', error);
            this.showToast(`Error deleting image: ${error.message}`, 'error');
        }
    },
    
    // Save the image order to the widget config
    saveArtImageOrder() {
        if (!this.currentArtWidget) return;
        
        // Get ordered list of images
        const images = [];
        document.querySelectorAll('.art-image-item').forEach(item => {
            const filename = item.getAttribute('data-filename');
            if (filename) images.push(filename);
        });
        
        // Update the textarea in the widget
        const textarea = this.currentArtWidget.querySelector('.art-images');
        if (textarea) {
            textarea.value = images.join('\n');
        }
        
        // Update device config
        this.updateArtFromForm();
        
        this.showToast('Image order saved', 'success');
        this.closeArtImageManager();
    },
    
    // Add new widget
    addWidget(type) {
        if (!this.currentDevice) {
            this.showToast('Select a room first', 'warning');
            return;
        }
        
        // Special handling for art widget - only one allowed per device
        if (type === 'art') {
            if (this.currentDevice.widgets.art) {
                this.showToast('Only one Art widget allowed per room', 'warning');
                return;
            }
            this.currentDevice.widgets.art = {
                directory: '/local/art',
                transition_time: 5,
                presence_aware: 'N',
                presence_sensor: '',
                images: []
            };
            this.renderArtWidget();
            this.showToast('Art widget added', 'success');
            return;
        }
        
        // Phase 1: Special handling for CCTV widget
        if (type === 'cctv') {
            if (!this.currentDevice.widgets.cctv) {
                this.currentDevice.widgets.cctv = [];
            }
            
            const list = document.getElementById('cctv-list');
            const template = document.getElementById('cctv-widget-template');
            
            if (template && list) {
                const clone = template.content.cloneNode(true);
                const card = clone.querySelector('.widget-card');
                const currentCount = list.querySelectorAll('.widget-card').length;
                
                card.dataset.index = currentCount;
                
                // Set number
                const number = card.querySelector('.widget-number');
                if (number) {
                    number.textContent = `#${currentCount + 1}`;
                }
                
                // Populate camera dropdown with available cameras
                const cameraSelect = card.querySelector('.camera-id-input');
                const cameras = this.getAvailableCameras();
                
                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = cameras.length === 0 ? 'No cameras configured' : 'Select a camera...';
                cameraSelect.appendChild(defaultOption);
                
                cameras.forEach(cam => {
                    const option = document.createElement('option');
                    option.value = cam.id;
                    option.textContent = `${cam.name} (${cam.id})`;
                    cameraSelect.appendChild(option);
                });
                
                // Add change listener
                const inputs = card.querySelectorAll('input, select');
                inputs.forEach(input => {
                    input.addEventListener('change', () => {
                        this.updateWidgetCount('cctv');
                    });
                });
                
                list.appendChild(card);
                this.updateWidgetCount('cctv');
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                if (cameras.length === 0) {
                    this.showToast('No cameras configured in Site Services', 'warning');
                }
            }
            return;
        }
        
        // Phase 1: Special handling for alarm_panel widget - only one allowed
        if (type === 'alarm_panel') {
            if (this.currentDevice.widgets.alarm_panel) {
                this.showToast('Only one Alarm Panel allowed per room', 'warning');
                return;
            }
            this.currentDevice.widgets.alarm_panel = {
                entity: '',
                name: '',
                auto_hide_sec: 30
            };
            this.renderAlarmPanelWidget();
            this.showToast('Alarm Panel added', 'success');
            return;
        }
        
        // Phase 1: Special handling for video_test widget - multi-instance streams array
        if (type === 'video_test') {
            if (!this.currentDevice.widgets.video_test) {
                this.currentDevice.widgets.video_test = { streams: [] };
            }
            
            this.currentDevice.widgets.video_test.streams.push({
                name: 'Test Stream',
                video_server_ip: '192.168.1.100',
                video_server_port: 8090,
                jpeg_filename: '',
                jpeg_scale: 0,
                mjpeg_filename: '',
                mjpeg_fps: 30,
                mjpeg_loopcnt: 0,
                mjpeg_duration_secs: 0
            });
            this.renderVideoTestWidget();
            this.showToast('Video Test stream added', 'success');
            return;
        }
        
        // Phase 1: Special handling for plasma widget - only one allowed
        if (type === 'plasma') {
            if (this.currentDevice.widgets.plasma) {
                this.showToast('Only one Plasma Effect allowed per room', 'warning');
                return;
            }
            this.currentDevice.widgets.plasma = {
                enabled: 'Y'
            };
            this.renderPlasmaWidget();
            this.showToast('Plasma Effect added', 'success');
            return;
        }
        
        // Phase 1: Special handling for network_test widget - only one allowed
        if (type === 'network_test') {
            if (this.currentDevice.widgets.network_test) {
                this.showToast('Only one Network Test allowed per room', 'warning');
                return;
            }
            this.currentDevice.widgets.network_test = {
                enabled: 'Y',
                server_ip: '192.168.1.100',
                server_port: 8090,
                duration_sec: 10,
                packet_size: 8192
            };
            this.renderNetworkTestWidget();
            this.showToast('Network Test added', 'success');
            return;
        }
        
        // Phase 1: Special handling for art3 widget - only one allowed
        if (type === 'art3') {
            if (this.currentDevice.widgets.art3) {
                this.showToast('Only one ART3 allowed per room', 'warning');
                return;
            }
            this.currentDevice.widgets.art3 = {
                enabled: 'Y',
                presence_aware: 'N',
                suppress_screensaver: 'N',
                auto_start_after_sec: 0,
                enabled_start_time: '00:00',
                enabled_end_time: '23:59',
                stream_server: '192.168.1.100',
                stream_port: 8090
            };
            this.renderArt3Widget();
            this.showToast('ART3 added', 'success');
            return;
        }
        
        // Phase 1: Special handling for weather widget - only one allowed
        if (type === 'weather') {
            if (this.currentDevice.widgets.weather) {
                this.showToast('Only one Weather widget allowed per room', 'warning');
                return;
            }
            this.currentDevice.widgets.weather = {
                weather_entity: 'weather.home',
                room_temp_entity: 'sensor.room_temperature'
            };
            this.renderWeatherWidget();
            this.showToast('Weather widget added', 'success');
            return;
        }
        
        if (!this.currentDevice.widgets[type]) {
            this.currentDevice.widgets[type] = [];
        } // end if
        
        const list = document.getElementById(`${type}-list`);
        
        // Get template ID based on type
        let templateId;
        if (type === 'lights') templateId = 'light-widget-template';
        else if (type === 'covers') templateId = 'cover-widget-template';
        else if (type === 'climate') templateId = 'climate-widget-template';
        else if (type === 'climate2') templateId = 'climate2-widget-template';
        else if (type === 'tests') templateId = 'tests-widget-template';
        else if (type === 'art') templateId = 'art-widget-template';
        else if (type === 'cctv') templateId = 'cctv-widget-template';
        else if (type === 'alarm_panel') templateId = 'alarm-panel-widget-template';
        else if (type === 'video_test') templateId = 'video-test-widget-template';
        else if (type === 'plasma') templateId = 'plasma-widget-template';
        else if (type === 'network_test') templateId = 'network-test-widget-template';
        else if (type === 'art3') templateId = 'art3-widget-template';
        else templateId = `${type.slice(0, -1)}-widget-template`;
        
        const template = document.getElementById(templateId);
        
        if (template && list) {
            const clone = template.content.cloneNode(true);
            const card = clone.querySelector('.widget-card');
            const currentCount = list.querySelectorAll('.widget-card').length;
            card.dataset.index = currentCount;
            
            // Set number
            const number = card.querySelector('.widget-number');
            if (number) {
                number.textContent = `#${currentCount + 1}`;
            }
            
            // Add entity validation (skip for tests in create_binary_sensor mode)
            const entityInput = card.querySelector('.entity-input');
            if (entityInput) {
                entityInput.addEventListener('blur', () => {
                    // Skip validation if tests widget in create_binary_sensor mode
                    if (type === 'tests') {
                        const modeSelect = card.querySelector('.mode-input');
                        if (modeSelect && modeSelect.value === 'create_binary_sensor') {
                            return; // No validation needed
                        }
                    }
                    this.validateEntity(entityInput.value, card);
                });
            }
            
            // Add change listener to update count
            const inputs = card.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.addEventListener('change', () => {
                    this.updateWidgetCount(type);
                });
            });
            
            list.appendChild(card);
            
            // Update count immediately
            this.updateWidgetCount(type);
            
            // For tests widgets, trigger initial mode display and set validation
            if (type === 'tests') {
                const modeSelect = card.querySelector('.mode-input');
                if (modeSelect) {
                    this.toggleTesterMode(modeSelect);
                    // Show green tick for create_binary_sensor mode by default
                    if (modeSelect.value === 'create_binary_sensor') {
                        const validIcon = card.querySelector('.valid');
                        if (validIcon) validIcon.style.display = 'inline';
                    }
                }
            }
            
            // Scroll to new widget
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },
    
    // Remove widget
    removeWidget(button) {
        const card = button.closest('.widget-card');
        const type = card.dataset.type;
        
        // Handle special cases for list IDs
        let listId;
        if (type === 'art' || type === 'alarm_panel' || type === 'plasma' || type === 'network_test' || type === 'art3') {
            // Single-instance widgets
            listId = `${type}-list`;
        } else {
            // Multi-instance widgets (plural)
            listId = `${type}s-list`;
        }
        
        const list = document.getElementById(listId);
        card.remove();
        
        // Delete from currentDevice.widgets for single-instance widgets
        if (type === 'art' || type === 'alarm_panel' || type === 'plasma' || type === 'network_test' || type === 'art3') {
            if (this.currentDevice && this.currentDevice.widgets) {
                delete this.currentDevice.widgets[type];
            }
        }
        
        // Renumber remaining cards (for multi-instance widgets)
        if (type !== 'art' && type !== 'alarm_panel' && type !== 'plasma' && type !== 'network_test' && type !== 'art3') {
            const cards = list.querySelectorAll('.widget-card');
            cards.forEach((c, i) => {
                c.dataset.index = i;
                const number = c.querySelector('.widget-number');
                if (number) {
                    number.textContent = `#${i + 1}`;
                }
            });
        }
        
        // Show add button for single-instance widgets when removed
        if (type === 'alarm_panel') {
            const addBtn = document.getElementById('add-alarm-panel-btn');
            if (addBtn) addBtn.style.display = 'inline-flex';
        } else if (type === 'plasma') {
            const addBtn = document.getElementById('add-plasma-btn');
            if (addBtn) addBtn.style.display = 'inline-flex';
        } else if (type === 'network_test') {
            const addBtn = document.getElementById('add-network-test-btn');
            if (addBtn) addBtn.style.display = 'inline-flex';
        } else if (type === 'art3') {
            const addBtn = document.getElementById('add-art3-btn');
            if (addBtn) addBtn.style.display = 'inline-flex';
        }
        
        this.updateWidgetCount(type);
    },
    
    // Update widget count badge
    updateWidgetCount(type, explicitCount) {
        // Normalize type (remove 's' suffix if present)
        const baseType = type.endsWith('s') ? type.slice(0, -1) : type;
        
        // Get count - handle different widget data structures
        let count;
        if (typeof explicitCount === 'number') {
            count = explicitCount;
        } else {
            // Get count from device widgets config based on widget type structure
            const widgets = this.currentDevice?.widgets;
            if (!widgets) {
                count = 0;
            } else if (baseType === 'climate' || baseType === 'climate2' || baseType === 'cctv') {
                // Array widgets - count array length
                count = widgets[baseType]?.length || 0;
            } else if (baseType === 'art') {
                // Art widget - single object with images array
                count = widgets.art?.images?.length || 0;
            } else if (baseType === 'alarm_panel' || baseType === 'plasma' || baseType === 'network_test' || baseType === 'art3') {
                // Single-instance widgets - 1 if exists, 0 if not
                count = widgets[baseType] ? 1 : 0;
            } else if (baseType === 'video_test') {
                // Video test - object with streams array
                count = widgets.video_test?.streams?.length || 0;
            } else {
                // Default: count from DOM for other types
                let listId;
                if (baseType === 'art' || baseType === 'alarm_panel') {
                    listId = `${baseType}-list`;
                } else {
                    listId = `${baseType}s-list`;
                }
                const list = document.getElementById(listId);
                count = list ? list.querySelectorAll('.widget-card').length : 0;
            }
        }
        
        // Badge IDs mapping for all widget types
        const badgeIdMap = {
            'light': 'lights-count',
            'cover': 'covers-count',
            'climate': 'climate-count',
            'climate2': 'climate2-count',
            'test': 'tests-count',
            'art': 'art-count',
            'cctv': 'cctv-count',
            'alarm_panel': 'alarm-panel-count',
            'video_test': 'video-test-count',
            'plasma': 'plasma-count',
            'network_test': 'network-test-count',
            'art3': 'art3-count'
        };
        
        const badgeId = badgeIdMap[baseType] || `${baseType}s-count`;
        
        const badge = document.getElementById(badgeId);
        if (badge) {
            badge.textContent = count;
        }
    },
    
    // Validate entity against HA
    async validateEntity(entityId, card) {
        if (!entityId) return;
        
        const validIcon = card.querySelector('.valid');
        const invalidIcon = card.querySelector('.invalid');
        const message = card.querySelector('.validation-message');
        
        validIcon.style.display = 'none';
        invalidIcon.style.display = 'none';
        message.textContent = 'Validating...';
        
        try {
            const response = await fetch('api/validate/entity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entity: entityId })
            });
            
            const result = await response.json();
            
            if (result.valid) {
                validIcon.style.display = 'inline';
                invalidIcon.style.display = 'none';
                message.textContent = '';
            } else {
                validIcon.style.display = 'none';
                invalidIcon.style.display = 'inline';
                message.textContent = result.error || 'Invalid entity';
            }
        } catch (error) {
            validIcon.style.display = 'none';
            invalidIcon.style.display = 'inline';
            message.textContent = 'Validation failed';
        }
    },
    
    // Entity picker modal
    async pickEntity(button, domain) {
        this.currentEntityButton = button;
        this.currentEntityDomain = domain;
        
        const modal = document.getElementById('entity-modal');
        const list = document.getElementById('entity-list');
        
        list.innerHTML = '<div class="entity-item">Loading...</div>';
        modal.classList.add('active');
        
        try {
            const response = await fetch(`api/entities/${domain}`);
            const data = await response.json();
            
            this.renderEntityList(data.entities || []);
        } catch (error) {
            list.innerHTML = '<div class="entity-item">Failed to load entities</div>';
        }
    },
    
    // Render entity list
    renderEntityList(entities) {
        const list = document.getElementById('entity-list');
        const search = document.getElementById('entity-search');
        
        const render = (filter = '') => {
            list.innerHTML = '';
            
            const filtered = entities.filter(e => 
                e.entity_id.toLowerCase().includes(filter.toLowerCase()) ||
                e.name.toLowerCase().includes(filter.toLowerCase())
            );
            
            filtered.forEach(entity => {
                const item = document.createElement('div');
                item.className = 'entity-item';
                
                // Icon based on domain
                let icon = 'circle';
                if (this.currentEntityDomain === 'light') icon = 'lightbulb';
                else if (this.currentEntityDomain === 'cover') icon = 'window-shutter';
                else if (this.currentEntityDomain === 'climate') icon = 'temperature-half';
                
                item.innerHTML = `
                    <i class="fas fa-${icon}"></i>
                    <div>
                        <div>${entity.name}</div>
                        <small style="color: var(--text-muted)">${entity.entity_id}</small>
                    </div>
                    <span class="state">${entity.state}</span>
                `;
                item.onclick = () => this.selectEntity(entity.entity_id);
                list.appendChild(item);
            });
        };
        
        render();
        
        search.oninput = (e) => render(e.target.value);
    },
    
    // Select entity from picker
    selectEntity(entityId) {
        if (this.currentEntityButton) {
            const input = this.currentEntityButton.closest('.input-with-action').querySelector('input');
            input.value = entityId;
            
            // Trigger validation
            const card = this.currentEntityButton.closest('.widget-card');
            this.validateEntity(entityId, card);
        }
        
        this.closeEntityModal();
    },
    
    // Close entity modal
    closeEntityModal() {
        document.getElementById('entity-modal').classList.remove('active');
        this.currentEntityButton = null;
        this.currentEntityInput = null;
    },
    
    // Show entity picker for an input field (by ID)
    async showEntityPicker(inputId, domain) {
        this.currentEntityInput = document.getElementById(inputId);
        this.currentEntityDomain = domain;
        
        const modal = document.getElementById('entity-modal');
        const list = document.getElementById('entity-list');
        
        list.innerHTML = '<div class="entity-item">Loading...</div>';
        modal.classList.add('active');
        
        try {
            const response = await fetch(`api/entities/${domain}`);
            const data = await response.json();
            
            this.renderEntityListForInput(data.entities || []);
        } catch (error) {
            list.innerHTML = '<div class="entity-item">Failed to load entities</div>';
        }
    },
    
    // Render entity list for input field selection
    renderEntityListForInput(entities) {
        const list = document.getElementById('entity-list');
        const search = document.getElementById('entity-search');
        
        const render = (filter = '') => {
            list.innerHTML = '';
            
            const filtered = entities.filter(e => 
                e.entity_id.toLowerCase().includes(filter.toLowerCase()) ||
                e.name.toLowerCase().includes(filter.toLowerCase())
            );
            
            filtered.forEach(entity => {
                const item = document.createElement('div');
                item.className = 'entity-item';
                
                // Icon based on domain
                let icon = 'circle';
                if (this.currentEntityDomain === 'light') icon = 'lightbulb';
                else if (this.currentEntityDomain === 'cover') icon = 'window-shutter';
                else if (this.currentEntityDomain === 'binary_sensor') icon = 'motion-sensor';
                else if (this.currentEntityDomain === 'climate') icon = 'temperature-half';
                
                item.innerHTML = `
                    <i class="fas fa-${icon}"></i>
                    <div>
                        <div>${entity.name}</div>
                        <small style="color: var(--text-muted)">${entity.entity_id}</small>
                    </div>
                    <span class="state">${entity.state}</span>
                `;
                item.onclick = () => this.selectEntityForInput(entity.entity_id);
                list.appendChild(item);
            });
        };
        
        render();
        
        search.oninput = (e) => render(e.target.value);
    },
    
    // Select entity for input field
    selectEntityForInput(entityId) {
        if (this.currentEntityInput) {
            this.currentEntityInput.value = entityId;
        }
        this.closeEntityModal();
    },
    
    // Toggle site settings section
    // Toggle room settings panel
    toggleRoomSettings() {
        const panel = document.getElementById('room-settings-panel');
        const icon = document.getElementById('room-settings-toggle');
        if (!panel) return;
        
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            if (icon) icon.classList.add('expanded');
        } else {
            panel.style.display = 'none';
            if (icon) icon.classList.remove('expanded');
        }
    },
    
    toggleSection(sectionId) {
        const content = document.getElementById(`${sectionId}-content`);
        const icon = document.getElementById(`${sectionId}-icon`);
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.classList.add('expanded');
        } else {
            content.style.display = 'none';
            icon.classList.remove('expanded');
        }
    },
    
    // Toggle password visibility
    togglePassword(inputId) {
        const input = document.getElementById(inputId);
        if (input.type === 'password') {
            input.type = 'text';
        } else {
            input.type = 'password';
        }
    },
    
    // Render device list sidebar
    renderDeviceList() {
        const list = document.getElementById('device-list');
        list.innerHTML = '';
        
        if (!this.config || !this.config.devices) return;
        
        this.config.devices.forEach((device, index) => {
            const item = document.createElement('div');
            item.className = `device-item ${index === this.currentDeviceIndex ? 'active' : ''}`;
            
            const lightCount = device.widgets?.lights?.length || 0;
            const coverCount = device.widgets?.covers?.length || 0;
            const total = lightCount + coverCount;
            
            item.innerHTML = `
                <i class="fas fa-home"></i>
                <span class="name">${device.name}</span>
                <span class="count">${total} widgets</span>
            `;
            
            item.onclick = () => this.selectDevice(index);
            list.appendChild(item);
        });
    },
    
    // Render widget types sidebar
    renderWidgetTypes() {
        const container = document.getElementById('widget-types');
        container.innerHTML = '';
        
        // MDI Icon SVG paths
        const mdiIcons = {
            'mdi:curtains': '<svg class="mdi-icon" viewBox="0 0 24 24"><path d="M2 3H22V5H20V11C20 14 17.5 16 15 16H13C13 16 13 18 13 20C13 21 12.5 22 12 22C11.5 22 11 21 11 20C11 18 11 16 11 16H9C6.5 16 4 14 4 11V5H2V3M6 5V11C6 12.5 7.5 14 9 14H11V5H6M13 5V14H15C16.5 14 18 12.5 18 11V5H13Z"/></svg>',
            'mdi:test-tube': '<svg class="mdi-icon" viewBox="0 0 24 24"><path d="M17 2V4H15V12.5C15 14.43 13.43 16 11.5 16C9.57 16 8 14.43 8 12.5V4H6V2H17M9.5 4V12.5C9.5 13.6 10.4 14.5 11.5 14.5C12.6 14.5 13.5 13.6 13.5 12.5V4H9.5M11.5 18C12.6 18 13.5 18.9 13.5 20H9.5C9.5 18.9 10.4 18 11.5 18M11.5 8C12.6 8 13.5 8.9 13.5 10H9.5C9.5 8.9 10.4 8 11.5 8Z"/></svg>',
            'mdi:lightbulb': '<i class="fas fa-lightbulb"></i>',
            'mdi:thermostat': '<i class="fas fa-temperature-half"></i>',
            'mdi:weather-partly-cloudy': '<i class="fas fa-cloud-sun"></i>',
            'mdi:shield-home': '<i class="fas fa-shield-alt"></i>',
            'mdi:music': '<i class="fas fa-music"></i>',
            'mdi:image': '<i class="fas fa-image"></i>',
            'mdi:phone': '<i class="fas fa-phone"></i>',
            'mdi:bullhorn': '<i class="fas fa-bullhorn"></i>',
            'mdi:microphone': '<i class="fas fa-microphone"></i>',
            'mdi:video': '<svg class="mdi-icon" viewBox="0 0 24 24"><path d="M17 10.5V7C17 6.45 16.55 6 16 6H4C3.45 6 3 6.45 3 7V17C3 17.55 3.45 18 4 18H16C16.55 18 17 17.55 17 17V13.5L21 17.5V6.5L17 10.5Z"/></svg>',
            'mdi:cctv': '<svg class="mdi-icon" viewBox="0 0 24 24"><path d="M6 8.5H4V15.5H6V8.5M21 8.5H19V15.5H21V8.5M18 17H2V15.5H4V8.5H2V7H18V8.5H16V15.5H18V17M18 2H6C4.9 2 4 2.9 4 4H20C20 2.9 19.1 2 18 2M18 20H6V22H18V20Z"/></svg>',
            'mdi:lightning-bolt': '<svg class="mdi-icon" viewBox="0 0 24 24"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg>',
            'mdi:palette': '<svg class="mdi-icon" viewBox="0 0 24 24"><path d="M12 22A10 10 0 0 1 2 12 10 10 0 0 1 12 2c5.5 0 10 4.5 10 10 0 1.5-.5 2.5-1 3.5-.5 1-1 2-1 3.5 0 1.5-1.5 3-3 3H15v-2h2c.5 0 1-.5 1-1 0-1.5.5-2.5 1-3.5.5-1 1-2 1-3.5A8 8 0 0 0 12 4 8 8 0 0 0 4 12a8 8 0 0 0 8 8v2m-3-8a3 3 0 0 1 3-3 3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3z"/></svg>',
            'mdi:check': '<svg class="mdi-icon" viewBox="0 0 24 24"><path d="M21 7L9 19L3.5 13.5L4.91 12.09L9 16.17L19.59 5.59L21 7Z"/></svg>',
            'mdi:ethernet': '<svg class="mdi-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>',
            'mdi:television-guide': '<svg class="mdi-icon" viewBox="0 0 24 24"><path d="M3 5h18v12h-5v2h3v2H5v-2h3v-2H3V5m2 2v8h14V7H5m2 2h10v4H7V9z"/></svg>'
        };
        
        // Define sort order by function: Core -> Security -> Media -> Test -> Future
        // Lights, Covers, Climate, Climate2, CCTV, Alarm Panel, Art Display, Art Slideshow, Plasma Effect, Tester, Video Test, Network Test, Music, Intercom, Public Address, Voice Assistant, Weather
        const sortOrder = [
            'lights', 'covers', 'climate', 'climate2', 'cctv', 'alarm_panel',
            'art', 'art3', 'plasma', 'tester', 'video_test', 'network_test',
            'music', 'intercom', 'pa', 'assistant', 'weather'
        ];
        
        // Sort widget types by the defined order
        const sortedTypes = [...this.widgetTypes].sort((a, b) => {
            const indexA = sortOrder.indexOf(a.id);
            const indexB = sortOrder.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
        
        sortedTypes.forEach(type => {
            const item = document.createElement('div');
            item.className = 'widget-type-item';
            
            // Get icon (MDI SVG or Font Awesome)
            const iconHtml = mdiIcons[type.icon] || `<i class="fas ${type.icon.replace('mdi:', '')}"></i>`;
            
            item.innerHTML = `
                ${iconHtml}
                <span>${type.name}</span>
                <span class="status ${type.status}">${type.status}</span>
            `;
            container.appendChild(item);
        });
    },
    
    // Render editor for current device
    renderEditor() {
        const noSelection = document.getElementById('no-selection');
        const editor = document.getElementById('device-editor');
        
        if (!this.currentDevice) {
            noSelection.style.display = 'flex';
            editor.style.display = 'none';
            return;
        }
        
        noSelection.style.display = 'none';
        editor.style.display = 'flex';
        
        // Render site settings
        if (this.config) {
            const siteName = document.getElementById('site-name');
            const guestSsid = document.getElementById('guest-ssid');
            const guestPassword = document.getElementById('guest-password');
            const coverOpening = document.getElementById('cover-opening-time');
            const coverClosing = document.getElementById('cover-closing-time');
            const siteCoverUp = document.getElementById('site-cover-up-time');
            const siteCoverDown = document.getElementById('site-cover-down-time');
            const siteVersion = document.getElementById('site-version');
            
            if (siteName) siteName.value = this.config.site_info?.site_name || '';
            if (guestSsid) guestSsid.value = this.config.site_info?.guest_ssid || '';
            if (guestPassword) guestPassword.value = this.config.site_info?.guest_wifi_password || '';
            if (coverOpening) coverOpening.value = this.config.defaults?.cover_opening_time || '08:00';
            if (coverClosing) coverClosing.value = this.config.defaults?.cover_closing_time || '19:00';
            if (siteCoverUp) siteCoverUp.value = this.config.defaults?.site_cover_up_time || 14300;
            if (siteCoverDown) siteCoverDown.value = this.config.defaults?.site_cover_down_time || 11500;
            if (siteVersion) siteVersion.value = this.config.site_meta?.version || '1.0';
        }
        
        // Set device info
        document.getElementById('device-name').value = this.currentDevice.name;
        document.getElementById('device-id').value = this.currentDevice.id;
        document.getElementById('device-ip').value = this.currentDevice.ip || '';
        
        // Set new room config fields
        const presenceEntity = document.getElementById('presence-entity');
        const doorEntity = document.getElementById('door-entity');
        const roomTempEntity = document.getElementById('room-temp-entity');
        const voiceEnabled = document.getElementById('voice-assistant-enabled');
        const usePresence = document.getElementById('use-presence-for-screen');
        const screenTimeout = document.getElementById('screen-timeout');
        const screenBrightness = document.getElementById('screen-brightness');
        const volume = document.getElementById('volume');
        
        if (presenceEntity) presenceEntity.value = this.currentDevice.presence_entity || '';
        if (doorEntity) doorEntity.value = this.currentDevice.door_entity || '';
        if (roomTempEntity) roomTempEntity.value = this.currentDevice.room_temp_entity || '';
        if (voiceEnabled) voiceEnabled.checked = this.currentDevice.voice_assistant_enabled || false;
        if (usePresence) usePresence.checked = this.currentDevice.use_presence_for_screen || false;
        if (screenTimeout) screenTimeout.value = this.currentDevice.screen_timeout || 30;
        if (screenBrightness) screenBrightness.value = this.currentDevice.screen_brightness || 80;
        if (volume) volume.value = this.currentDevice.volume || 50;
        
        // Collapse room settings by default when selecting a room
        const roomSettingsPanel = document.getElementById('room-settings-panel');
        const roomSettingsToggle = document.getElementById('room-settings-toggle');
        if (roomSettingsPanel) {
            roomSettingsPanel.style.display = 'none';
        }
        if (roomSettingsToggle) {
            roomSettingsToggle.classList.remove('expanded');
        }
        
        // Render lights
        this.renderWidgetList('lights', this.currentDevice.widgets?.lights || []);
        
        // Render covers
        this.renderWidgetList('covers', this.currentDevice.widgets?.covers || []);
        
        // Render climate
        this.renderWidgetList('climate', this.currentDevice.widgets?.climate || []);
        
        // Render climate2
        this.renderWidgetList('climate2', this.currentDevice.widgets?.climate2 || []);
        
        // Render tester widgets
        this.renderWidgetList('tests', this.currentDevice.widgets?.tests || []);
        
        // Render art widget (single instance)
        this.renderArtWidget();
        
        // Phase 1: Render cameras in Site Services panel
        this.renderCameras();
        
        // Phase 1: Load Weather Service config
        this.loadWeatherServiceToForm();
        
        // Phase 1: Render CCTV widgets
        this.renderCCTVWidgets();
        
        // Phase 1: Render Alarm Panel widget (single instance)
        this.renderAlarmPanelWidget();
        
        // Phase 1: Render Video Test widget (single instance)
        this.renderVideoTestWidget();
        
        // Phase 1: Render Plasma Protection widget (single instance)
        this.renderPlasmaWidget();
        
        // Phase 1: Render Network Test widget (single instance)
        this.renderNetworkTestWidget();
        
        // Phase 1: Render Weather widget (single instance)
        this.renderWeatherWidget();
        
        // Phase 1: Render ART3 widget (single instance)
        this.renderArt3Widget();
        
        // Load slideshow settings from config
        this.loadSlideshowSettings();
    },
    
    // Load slideshow settings from config into form fields
    loadSlideshowSettings() {
        const slideshow = this.config?.slideshow;
        if (!slideshow) return;
        
        const serverInput = document.getElementById('slideshow-server');
        const streamPortInput = document.getElementById('slideshow-stream-port');
        const httpPortInput = document.getElementById('slideshow-http-port');
        const durationInput = document.getElementById('slideshow-default-duration');
        
        // Only set values if they exist in config AND form fields are currently empty
        // This prevents overwriting user input, but ensures saved values are loaded on fresh page load
        if (serverInput && slideshow.server) serverInput.value = slideshow.server;
        if (streamPortInput && slideshow.stream_port) streamPortInput.value = slideshow.stream_port;
        if (httpPortInput && slideshow.http_port) httpPortInput.value = slideshow.http_port;
        if (durationInput && slideshow.default_duration) durationInput.value = slideshow.default_duration;
    },
    
    // Render art widget (special case - single instance with different structure)
    renderArtWidget() {
        const list = document.getElementById('art-list');
        if (!list) return;
        list.innerHTML = '';
        
        const art = this.currentDevice.widgets?.art;
        if (!art) return;
        
        const template = document.getElementById('art-widget-template');
        if (!template) return;
        
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.widget-card');
        
        // Set values
        card.querySelector('.art-directory').value = art.directory || '/local/art';
        card.querySelector('.art-transition').value = art.transition_time || 5;
        card.querySelector('.art-presence').value = art.presence_aware || 'N';
        card.querySelector('.art-presence-sensor').value = art.presence_sensor || '';
        card.querySelector('.art-images').value = (art.images || []).join('\n');
        
        // Enable/disable presence sensor based on selection
        const presenceSelect = card.querySelector('.art-presence');
        const presenceSensorInput = card.querySelector('.art-presence-sensor');
        const presenceSensorBtn = card.querySelector('.input-with-action button');
        
        presenceSelect.addEventListener('change', () => {
            const isEnabled = presenceSelect.value === 'Y';
            presenceSensorInput.disabled = !isEnabled;
            if (presenceSensorBtn) presenceSensorBtn.disabled = !isEnabled;
        });
        
        list.appendChild(clone);
    },
    
    // =============================================================================
    // PHASE 1: CAMERA SERVICES & WIDGETS
    // =============================================================================
    
    // Add a new camera to services.cameras
    addCamera() {
        if (!this.config.services) {
            this.config.services = { cameras: [] };
        }
        if (!this.config.services.cameras) {
            this.config.services.cameras = [];
        }
        
        const template = document.getElementById('camera-service-template');
        const list = document.getElementById('cameras-list');
        
        if (template && list) {
            const clone = template.content.cloneNode(true);
            const card = clone.querySelector('.widget-card');
            const currentCount = list.querySelectorAll('.widget-card').length;
            
            card.dataset.index = currentCount;
            
            // Set number
            const number = card.querySelector('.widget-number');
            if (number) {
                number.textContent = `#${currentCount + 1}`;
            }
            
            // Add change listener to update count
            const inputs = card.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('change', () => {
                    this.updateCameraCount();
                });
            });
            
            list.appendChild(card);
            this.updateCameraCount();
            
            // Scroll to new camera
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },
    
    // Remove a camera from the list
    removeCamera(button) {
        const card = button.closest('.widget-card');
        if (card) {
            card.remove();
            this.renumberCameras();
            this.updateCameraCount();
        }
    },
    
    // Renumber cameras after removal
    renumberCameras() {
        const list = document.getElementById('cameras-list');
        if (!list) return;
        
        const cards = list.querySelectorAll('.widget-card');
        cards.forEach((card, index) => {
            card.dataset.index = index;
            const number = card.querySelector('.widget-number');
            if (number) {
                number.textContent = `#${index + 1}`;
            }
        });
    },
    
    // Update camera count badge
    updateCameraCount() {
        const list = document.getElementById('cameras-list');
        const count = list ? list.querySelectorAll('.widget-card').length : 0;
        const badge = document.getElementById('cameras-count');
        if (badge) {
            badge.textContent = count;
        }
    },
    
    // Render cameras from config to Site Services panel
    renderCameras() {
        const list = document.getElementById('cameras-list');
        if (!list) return;
        list.innerHTML = '';
        
        const cameras = this.config.services?.cameras || [];
        
        const template = document.getElementById('camera-service-template');
        if (!template) return;
        
        cameras.forEach((camera, index) => {
            const clone = template.content.cloneNode(true);
            const card = clone.querySelector('.widget-card');
            
            card.dataset.index = index;
            card.querySelector('.widget-number').textContent = `#${index + 1}`;
            
            // Set values
            card.querySelector('.cam-id-input').value = camera.id || '';
            card.querySelector('.cam-name-input').value = camera.name || '';
            card.querySelector('.cam-host-input').value = camera.host || '';
            card.querySelector('.cam-port-input').value = camera.port || 8080;
            card.querySelector('.cam-entity-input').value = camera.entity || '';
            
            // Add change listener
            const inputs = card.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('change', () => {
                    this.updateCameraCount();
                });
            });
            
            list.appendChild(card);
        });
        
        this.updateCameraCount();
    },
    
    // Save cameras from form to config
    updateCamerasFromForm() {
        const list = document.getElementById('cameras-list');
        if (!list) return;
        
        const cards = list.querySelectorAll('.widget-card');
        const cameras = [];
        
        cards.forEach(card => {
            const id = card.querySelector('.cam-id-input').value.trim();
            if (!id) return; // Skip empty
            
            cameras.push({
                id: id,
                name: card.querySelector('.cam-name-input').value.trim() || id,
                host: card.querySelector('.cam-host-input').value.trim(),
                port: parseInt(card.querySelector('.cam-port-input').value) || 8080,
                entity: card.querySelector('.cam-entity-input').value.trim()
            });
        });
        
        if (!this.config.services) {
            this.config.services = {};
        }
        this.config.services.cameras = cameras;
    },
    
    // Get available cameras for CCTV dropdown
    getAvailableCameras() {
        return this.config.services?.cameras || [];
    },
    
    // Save weather service config from form
    updateWeatherServiceFromForm() {
        const serverIp = document.getElementById('weather-server-ip');
        const serverPort = document.getElementById('weather-server-port');
        const fps = document.getElementById('weather-fps');
        
        if (!serverIp || !serverPort || !fps) return;
        
        if (!this.config.services) {
            this.config.services = {};
        }
        
        this.config.services.weather = {
            server_ip: serverIp.value || '192.168.1.100',
            server_port: parseInt(serverPort.value) || 8090,
            fps: parseInt(fps.value) || 30,
            mjpeg_files: {
                sunny: document.getElementById('weather-file-sunny')?.value || 'sunny.mjpeg',
                cloudy: document.getElementById('weather-file-cloudy')?.value || 'cloudy.mjpeg',
                rainy: document.getElementById('weather-file-rainy')?.value || 'rainy.mjpeg',
                drizzle: document.getElementById('weather-file-drizzle')?.value || 'drizzle.mjpeg',
                stormy: document.getElementById('weather-file-stormy')?.value || 'stormy.mjpeg',
                windy: document.getElementById('weather-file-windy')?.value || 'windy.mjpeg',
                hot: document.getElementById('weather-file-hot')?.value || 'hot.mjpeg'
            }
        };
    },
    
    // Load weather service config to form
    loadWeatherServiceToForm() {
        const weather = this.config.services?.weather;
        if (!weather) return;
        
        const serverIp = document.getElementById('weather-server-ip');
        const serverPort = document.getElementById('weather-server-port');
        const fps = document.getElementById('weather-fps');
        
        if (serverIp) serverIp.value = weather.server_ip || '192.168.1.100';
        if (serverPort) serverPort.value = weather.server_port || 8090;
        if (fps) fps.value = weather.fps || 30;
        
        const files = weather.mjpeg_files || {};
        const sunny = document.getElementById('weather-file-sunny');
        const cloudy = document.getElementById('weather-file-cloudy');
        const rainy = document.getElementById('weather-file-rainy');
        const drizzle = document.getElementById('weather-file-drizzle');
        const stormy = document.getElementById('weather-file-stormy');
        const windy = document.getElementById('weather-file-windy');
        const hot = document.getElementById('weather-file-hot');
        
        if (sunny) sunny.value = files.sunny || 'sunny.mjpeg';
        if (cloudy) cloudy.value = files.cloudy || 'cloudy.mjpeg';
        if (rainy) rainy.value = files.rainy || 'rainy.mjpeg';
        if (drizzle) drizzle.value = files.drizzle || 'drizzle.mjpeg';
        if (stormy) stormy.value = files.stormy || 'stormy.mjpeg';
        if (windy) windy.value = files.windy || 'windy.mjpeg';
        if (hot) hot.value = files.hot || 'hot.mjpeg';
    },
    
    // =============================================================================
    // PHASE 1: CCTV WIDGET
    // =============================================================================
    
    // Render CCTV widgets for current device
    renderCCTVWidgets() {
        const list = document.getElementById('cctv-list');
        if (!list) return;
        list.innerHTML = '';
        
        const cctvWidgets = this.currentDevice.widgets?.cctv || [];
        const cameras = this.getAvailableCameras();
        
        const template = document.getElementById('cctv-widget-template');
        if (!template) return;
        
        cctvWidgets.forEach((widget, index) => {
            const clone = template.content.cloneNode(true);
            const card = clone.querySelector('.widget-card');
            
            card.dataset.index = index;
            card.querySelector('.widget-number').textContent = `#${index + 1}`;
            
            // Populate camera dropdown
            const cameraSelect = card.querySelector('.camera-id-input');
            cameras.forEach(cam => {
                const option = document.createElement('option');
                option.value = cam.id;
                option.textContent = `${cam.name} (${cam.id})`;
                cameraSelect.appendChild(option);
            });
            cameraSelect.value = widget.id || '';
            
            // Set other values
            card.querySelector('.camera-name-input').value = widget.name || '';
            card.querySelector('.show-cam-entity').value = widget.show_cam_entity || '';
            
            // Add change listener
            const inputs = card.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.addEventListener('change', () => {
                    this.updateWidgetCount('cctv');
                });
            });
            
            list.appendChild(card);
        });
        
        this.updateWidgetCount('cctv');
    },
    
    // =============================================================================
    // PHASE 1: ALARM PANEL WIDGET
    // =============================================================================
    
    // Render Alarm Panel widget (single instance)
    renderAlarmPanelWidget() {
        const list = document.getElementById('alarm-panel-list');
        const addBtn = document.getElementById('add-alarm-panel-btn');
        if (!list) return;
        list.innerHTML = '';
        
        const alarmPanel = this.currentDevice.widgets?.alarm_panel;
        
        // Show/hide add button based on whether alarm panel exists
        if (addBtn) {
            addBtn.style.display = alarmPanel ? 'none' : 'inline-flex';
        }
        
        if (!alarmPanel) return;
        
        const template = document.getElementById('alarm-panel-widget-template');
        if (!template) return;
        
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.widget-card');
        
        // Set values
        card.querySelector('.entity-input').value = alarmPanel.entity || '';
        card.querySelector('.name-input').value = alarmPanel.name || '';
        card.querySelector('.auto-hide-input').value = alarmPanel.auto_hide_sec || 30;
        
        // Add change listener
        const inputs = card.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateWidgetCount('alarm_panel');
            });
        });
        
        list.appendChild(clone);
        this.updateWidgetCount('alarm_panel');
    },
    
    // =============================================================================
    // PHASE 1: SLIDESHOW WIDGET
    // =============================================================================
    // PHASE 1: VIDEO TEST WIDGET
    // =============================================================================
    
    // Render Video Test widget (single instance)
    renderVideoTestWidget() {
        const list = document.getElementById('video-test-list');
        if (!list) return;
        list.innerHTML = '';
        
        const videoTest = this.currentDevice.widgets?.video_test;
        const streams = videoTest?.streams || [];
        
        const template = document.getElementById('video-test-widget-template');
        if (!template) return;
        
        streams.forEach((stream, index) => {
            const clone = template.content.cloneNode(true);
            const card = clone.querySelector('.widget-card');
            
            card.dataset.index = index;
            card.querySelector('.widget-number').textContent = `#${index + 1}`;
            
            card.querySelector('.name-input').value = stream.name || 'Test Stream';
            card.querySelector('.server-ip-input').value = stream.video_server_ip || '192.168.1.100';
            card.querySelector('.server-port-input').value = stream.video_server_port || 8090;
            card.querySelector('.jpeg-filename-input').value = stream.jpeg_filename || '';
            card.querySelector('.jpeg-scale-input').value = stream.jpeg_scale || 0;
            card.querySelector('.mjpeg-filename-input').value = stream.mjpeg_filename || '';
            card.querySelector('.mjpeg-fps-input').value = stream.mjpeg_fps || 30;
            card.querySelector('.mjpeg-loopcnt-input').value = stream.mjpeg_loopcnt || 0;
            card.querySelector('.mjpeg-duration-input').value = stream.mjpeg_duration_secs || 0;
            
            const inputs = card.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.addEventListener('change', () => {
                    this.updateWidgetCount('video_test');
                });
            });
            
            list.appendChild(card);
        });
        
        this.updateWidgetCount('video_test', streams.length);
    },
    
    // =============================================================================
    // PHASE 1: PLASMA PROTECTION WIDGET
    // =============================================================================
    
    // Render Plasma Protection widget (single instance)
    renderPlasmaWidget() {
        const list = document.getElementById('plasma-list');
        const addBtn = document.getElementById('add-plasma-btn');
        if (!list) return;
        list.innerHTML = '';
        
        const plasma = this.currentDevice.widgets?.plasma;
        
        if (addBtn) {
            addBtn.style.display = plasma ? 'none' : 'inline-flex';
        }
        
        if (!plasma) {
            this.updateWidgetCount('plasma', 0);
            return;
        }
        
        const template = document.getElementById('plasma-widget-template');
        if (!template) return;
        
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.widget-card');
        
        // Show green checkmark since widget is enabled
        const validIcon = card.querySelector('.valid');
        if (validIcon) validIcon.style.display = 'inline';
        
        const inputs = card.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateWidgetCount('plasma');
            });
        });
        
        list.appendChild(clone);
        this.updateWidgetCount('plasma', 1);
    },
    
    // =============================================================================
    // PHASE 1: NETWORK TEST WIDGET
    // =============================================================================
    
    // Render Network Test widget (single instance)
    renderNetworkTestWidget() {
        const list = document.getElementById('network-test-list');
        const addBtn = document.getElementById('add-network-test-btn');
        if (!list) return;
        list.innerHTML = '';
        
        const networkTest = this.currentDevice.widgets?.network_test;
        
        if (addBtn) {
            addBtn.style.display = networkTest ? 'none' : 'inline-flex';
        }
        
        if (!networkTest) {
            this.updateWidgetCount('network_test', 0);
            return;
        }
        
        const template = document.getElementById('network-test-widget-template');
        if (!template) return;
        
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.widget-card');
        
        // Show green checkmark since widget is enabled
        const validIcon = card.querySelector('.valid');
        if (validIcon) validIcon.style.display = 'inline';
        
        card.querySelector('.server-ip-input').value = networkTest.server_ip || '192.168.1.100';
        card.querySelector('.server-port-input').value = networkTest.server_port || 8090;
        card.querySelector('.duration-input').value = networkTest.duration_sec || 10;
        card.querySelector('.packet-size-input').value = networkTest.packet_size || 8192;
        
        const inputs = card.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateWidgetCount('network_test');
            });
        });
        
        list.appendChild(clone);
        this.updateWidgetCount('network_test', 1);
    },
    
    // =============================================================================
    // PHASE 1: WEATHER WIDGET
    // =============================================================================
    
    // Render Weather widget (single instance)
    renderWeatherWidget() {
        const list = document.getElementById('weather-list');
        const addBtn = document.getElementById('add-weather-btn');
        if (!list) return;
        list.innerHTML = '';
        
        const weather = this.currentDevice.widgets?.weather;
        
        if (addBtn) {
            addBtn.style.display = weather ? 'none' : 'inline-flex';
        }
        
        if (!weather) {
            this.updateWidgetCount('weather', 0);
            return;
        }
        
        const template = document.getElementById('weather-widget-template');
        if (!template) return;
        
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.widget-card');
        
        // Show green checkmark since widget is enabled
        const validIcon = card.querySelector('.valid');
        if (validIcon) validIcon.style.display = 'inline';
        
        // Populate fields with saved values or defaults
        const weatherEntityInput = card.querySelector('.weather-entity-input');
        const roomTempEntityInput = card.querySelector('.room-temp-entity-input');
        
        weatherEntityInput.value = weather.weather_entity || 'weather.home';
        roomTempEntityInput.value = weather.room_temp_entity || 'sensor.room_temperature';
        
        // Validate entities
        this.validateEntity(weatherEntityInput.value, card);
        
        // Add change listeners for entity validation
        weatherEntityInput.addEventListener('change', () => {
            this.validateEntity(weatherEntityInput.value, card);
            this.updateWeatherWidgetConfig();
        });
        
        roomTempEntityInput.addEventListener('change', () => {
            this.updateWeatherWidgetConfig();
        });
        
        list.appendChild(clone);
        this.updateWidgetCount('weather', 1);
    },
    
    // Update Weather widget config from form fields
    updateWeatherWidgetConfig() {
        if (!this.currentDevice) return;
        
        const list = document.getElementById('weather-list');
        if (!list) return;
        
        const card = list.querySelector('.widget-card');
        if (!card) return;
        
        this.currentDevice.widgets.weather = {
            weather_entity: card.querySelector('.weather-entity-input')?.value || 'weather.home',
            room_temp_entity: card.querySelector('.room-temp-entity-input')?.value || 'sensor.room_temperature'
        };
    },
    
    // =============================================================================
    // PHASE 1: ART3 WIDGET
    // =============================================================================
    
    // Render ART3 widget (single instance)
    renderArt3Widget() {
        const list = document.getElementById('art3-list');
        const addBtn = document.getElementById('add-art3-btn');
        if (!list) return;
        list.innerHTML = '';
        
        const art3 = this.currentDevice.widgets?.art3;
        
        if (addBtn) {
            addBtn.style.display = art3 ? 'none' : 'inline-flex';
        }
        
        if (!art3) {
            this.updateWidgetCount('art3', 0);
            return;
        }
        
        const template = document.getElementById('art3-widget-template');
        if (!template) return;
        
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.widget-card');
        
        // Show green checkmark since widget is enabled
        const validIcon = card.querySelector('.valid');
        if (validIcon) validIcon.style.display = 'inline';
        
        card.querySelector('.presence-aware-input').checked = art3.presence_aware === 'Y';
        card.querySelector('.suppress-screensaver-input').checked = art3.suppress_screensaver === 'Y';
        card.querySelector('.auto-start-input').value = art3.auto_start_after_sec || 0;
        card.querySelector('.start-time-input').value = art3.enabled_start_time || '00:00';
        card.querySelector('.end-time-input').value = art3.enabled_end_time || '23:59';
        card.querySelector('.stream-server-input').value = art3.stream_server || '192.168.1.100';
        card.querySelector('.stream-port-input').value = art3.stream_port || 8090;
        
        const inputs = card.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateWidgetCount('art3');
            });
        });
        
        list.appendChild(clone);
        this.updateWidgetCount('art3', 1);
    },
    
    // Render widget list for a type
    renderWidgetList(type, widgets) {
        const list = document.getElementById(`${type}-list`);
        if (!list) return;
        list.innerHTML = '';
        
        let templateId;
        if (type === 'lights') templateId = 'light-widget-template';
        else if (type === 'covers') templateId = 'cover-widget-template';
        else if (type === 'climate') templateId = 'climate-widget-template';
        else if (type === 'climate2') templateId = 'climate2-widget-template';
        else if (type === 'tests') templateId = 'tests-widget-template';
        else if (type === 'art') templateId = 'art-widget-template';
        else return;
        
        const template = document.getElementById(templateId);
        if (!template) return;
        
        widgets.forEach((widget, index) => {
            const clone = template.content.cloneNode(true);
            const card = clone.querySelector('.widget-card');
            
            card.dataset.index = index;
            card.querySelector('.widget-number').textContent = `#${index + 1}`;
            
            // Set values
            card.querySelector('.entity-input').value = widget.entity;
            card.querySelector('.name-input').value = widget.name;
            
            if (type === 'lights') {
                card.querySelector('.type-input').value = widget.type;
                card.querySelector('.icon-input').value = widget.icon_id || 'downlight';
            } else if (type === 'covers') {
                card.querySelector('.type-input').value = widget.type;
                card.querySelector('.uptime-input').value = widget.up_time_msecs || 14300;
                card.querySelector('.downtime-input').value = widget.down_time_msecs || 11500;
            } else if (type === 'climate') {
                card.querySelector('.presence-deactivate-input').checked = widget.use_presence_for_deactivation || false;
                card.querySelector('.presence-activate-input').checked = widget.use_presence_for_activation || false;
                card.querySelector('.presence-timeout-input').value = widget.presence_deactivation_time || 300;
                card.querySelector('.fan-speed-input').value = widget.default_fan_speed || 'medium';
                card.querySelector('.low-setpoint-input').value = widget.default_low_setpoint || 20;
                card.querySelector('.high-setpoint-input').value = widget.default_high_setpoint || 24;
                card.querySelector('.dehumidify-input').value = widget.auto_dehumidify_setpoint || 60;
                card.querySelector('.simple-ui-input').checked = widget.use_simple_ui || false;
            } else if (type === 'climate2') {
                card.querySelector('.ui-mode-input').value = widget.ui_mode || 'simple';
                card.querySelector('.presence-deactivate-input').checked = widget.use_presence_for_deactivation || false;
                card.querySelector('.presence-activate-input').checked = widget.use_presence_for_activation || false;
                card.querySelector('.presence-timeout-input').value = widget.presence_deactivation_time || 300;
                card.querySelector('.fan-speed-input').value = widget.default_fan_speed || 'medium';
                card.querySelector('.low-setpoint-input').value = widget.default_low_setpoint || 20;
                card.querySelector('.high-setpoint-input').value = widget.default_high_setpoint || 24;
                card.querySelector('.dehumidify-input').value = widget.auto_dehumidify_setpoint || 60;
            } else if (type === 'tests') {
                console.log('Rendering tester widget:', widget);
                card.querySelector('.test-id-input').value = widget.test_id || 'test_1';
                const modeInput = card.querySelector('.mode-input');
                modeInput.value = widget.mode || 'existing_switch';
                // Trigger mode toggle to set correct visibility
                this.toggleTesterMode(modeInput);
                if (widget.mode === 'create_binary_sensor') {
                    card.querySelector('.device-name-input').value = widget.device_name || '';
                    // Show green tick for create_binary_sensor mode
                    const validIcon = card.querySelector('.valid');
                    if (validIcon) validIcon.style.display = 'inline';
                }
            }
            
            // Add validation listener
            const entityInput = card.querySelector('.entity-input');
            if (entityInput) {
                entityInput.addEventListener('blur', () => {
                    // Skip validation for tests in create_binary_sensor mode
                    if (type === 'tests' && widget.mode === 'create_binary_sensor') {
                        return;
                    }
                    this.validateEntity(entityInput.value, card);
                });
            }
            
            // Add change listener to update count
            const inputs = card.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.addEventListener('change', () => {
                    this.updateWidgetCount(type);
                });
            });
            
            // Trigger initial validation (skip for tests in create_binary_sensor mode)
            if (type !== 'tests' || widget.mode !== 'create_binary_sensor') {
                if (entityInput && widget.entity) {
                    this.validateEntity(widget.entity, card);
                }
            }
            
            list.appendChild(card);
        });
        
        this.updateWidgetCount(type);
    },
    
    // Toggle tester widget mode (existing_switch vs create_binary_sensor)
    toggleTesterMode(select) {
        const card = select.closest('.widget-card');
        const mode = select.value;
        const existingGroup = card.querySelector('.existing-switch-group');
        const createGroup = card.querySelector('.create-sensor-group');
        
        if (mode === 'existing_switch') {
            existingGroup.style.display = 'block';
            createGroup.style.display = 'none';
        } else {
            existingGroup.style.display = 'none';
            createGroup.style.display = 'block';
        }
    },
    
    // =============================================================================
    // SLIDESHOW MEDIA MANAGER (Site-Level)
    // =============================================================================
    
    // Open slideshow media manager modal
    openSlideshowManager() {
        const modal = document.getElementById('slideshow-manager-modal');
        if (modal) {
            modal.style.display = 'flex';
            
            // Load server settings from config ONLY if form fields are empty
            // This preserves user-entered values when re-opening the manager
            const slideshow = this.config?.slideshow;
            if (slideshow) {
                const serverInput = document.getElementById('slideshow-server');
                const streamPortInput = document.getElementById('slideshow-stream-port');
                const httpPortInput = document.getElementById('slideshow-http-port');
                const durationInput = document.getElementById('slideshow-default-duration');
                
                if (serverInput && !serverInput.value) serverInput.value = slideshow.server || '192.168.1.100';
                if (streamPortInput && !streamPortInput.value) streamPortInput.value = slideshow.stream_port || 8090;
                if (httpPortInput && !httpPortInput.value) httpPortInput.value = slideshow.http_port || 8050;
                if (durationInput && !durationInput.value) durationInput.value = slideshow.default_duration || 10;
                
                // Map slides and handle field name differences ("file" vs "filename")
                // Also map "effect": "ken_burns" to "ken_burns": true
                this.slideshowPlaylist = (slideshow.slides || []).map(slide => {
                    // For videos with loopcnt > 0, duration should be 0 (loopcnt controls playback)
                    // For videos with loopcnt = 0, use duration or default to 10
                    // For images, use duration or default to 10
                    const isImage = slide.type === 'image';
                    const hasExplicitDuration = slide.duration !== undefined && slide.duration !== null;
                    const defaultDuration = isImage ? 10 : ((slide.loopcnt || 0) > 0 ? 0 : 10);
                    
                    const mappedSlide = {
                        type: slide.type,
                        filename: slide.file || slide.filename,  // Map "file" to "filename"
                        scale: slide.scale || 'crop_center',
                        use_default_duration: slide.use_default_duration || false,
                        duration: hasExplicitDuration ? slide.duration : defaultDuration
                    };
                    
                    if (slide.type === 'image') {
                        // Map "effect": "ken_burns" to "ken_burns": true
                        mappedSlide.ken_burns = (slide.effect === 'ken_burns') || slide.ken_burns || false;
                        mappedSlide.transition = slide.transition || 'fade';
                    } else {
                        mappedSlide.fps = slide.fps || 25;
                        mappedSlide.loopcnt = slide.loopcnt || 0;
                    }
                    
                    return mappedSlide;
                });
            } else {
                this.slideshowPlaylist = [];
            }
            
            this.loadSlideshowFiles();
            this.renderSlideshowPlaylist();
            this.setupSlideshowUpload();
        }
    },
    
    // Close slideshow media manager modal
    closeSlideshowManager() {
        const modal = document.getElementById('slideshow-manager-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    },
    
    // Setup upload drag and drop
    setupSlideshowUpload() {
        const dropZone = document.getElementById('slideshow-drop-zone');
        const fileInput = document.getElementById('slideshow-file-input');
        
        if (!dropZone || !fileInput) return;
        
        // Click to upload
        dropZone.onclick = () => fileInput.click();
        
        // File selection
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                this.uploadSlideshowFiles(e.target.files);
            }
        };
        
        // Drag and drop
        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--primary)';
            dropZone.style.background = 'rgba(59,130,246,0.1)';
        };
        
        dropZone.ondragleave = () => {
            dropZone.style.borderColor = 'var(--border)';
            dropZone.style.background = 'var(--dark)';
        };
        
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border)';
            dropZone.style.background = 'var(--dark)';
            if (e.dataTransfer.files.length > 0) {
                this.uploadSlideshowFiles(e.dataTransfer.files);
            }
        };
    },
    
    // Upload files to server
    async uploadSlideshowFiles(files) {
        const serverIp = document.getElementById('slideshow-server')?.value || '192.168.1.100';
        const httpPort = document.getElementById('slideshow-http-port')?.value || '8050';
        const dropZone = document.getElementById('slideshow-drop-zone');
        const originalContent = dropZone.innerHTML;
        
        dropZone.innerHTML = `<i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i><p>Uploading ${files.length} file(s)...</p>`;
        
        let uploaded = 0;
        let failed = 0;
        
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', file.name.endsWith('.mjpeg') ? 'video' : 'image');
            
            try {
                const response = await fetch(`http://${serverIp}:${httpPort}/api/upload`, {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    uploaded++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error('Upload failed:', error);
                failed++;
            }
        }
        
        dropZone.innerHTML = originalContent;
        this.setupSlideshowUpload(); // Re-setup event listeners
        
        if (uploaded > 0) {
            this.showToast(`Uploaded ${uploaded} file(s)${failed > 0 ? `, ${failed} failed` : ''}`, failed > 0 ? 'warning' : 'success');
            this.loadSlideshowFiles(); // Refresh file list
        } else if (failed > 0) {
            this.showToast('Upload failed. Check server connection.', 'error');
        }
    },
    
    // Load available files from server
    async loadSlideshowFiles() {
        const serverIp = document.getElementById('slideshow-server')?.value || '192.168.1.100';
        const httpPort = document.getElementById('slideshow-http-port')?.value || '8050';
        const statusEl = document.getElementById('slideshow-server-status');
        
        if (statusEl) {
            statusEl.style.background = 'rgba(59,130,246,0.1)';
            statusEl.style.borderLeftColor = 'var(--primary)';
            statusEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Connecting to ${serverIp}:${httpPort}...`;
        }
        
        try {
            const response = await fetch(`http://${serverIp}:${httpPort}/api/files`);
            if (response.ok) {
                const data = await response.json();
                this.slideshowFiles = data;
                if (statusEl) {
                    const imgCount = data.images?.length || 0;
                    const vidCount = data.videos?.length || 0;
                    statusEl.style.background = 'rgba(16,185,129,0.1)';
                    statusEl.style.borderLeftColor = '#10b981';
                    statusEl.innerHTML = `<i class="fas fa-check-circle"></i> Connected to ${serverIp}:${httpPort} (${imgCount} images, ${vidCount} videos)`;
                }
                this.renderSlideshowFiles(serverIp, httpPort);
            } else {
                this.showSlideshowError('Server returned error: ' + response.status);
            }
        } catch (error) {
            console.error('Failed to load slideshow files:', error);
            this.showSlideshowError(`Cannot connect to ${serverIp}:${httpPort}. Check server is running.`);
        }
    },
    
    // Show error in slideshow manager
    showSlideshowError(message) {
        const statusEl = document.getElementById('slideshow-server-status');
        if (statusEl) {
            statusEl.style.background = 'rgba(239,68,68,0.1)';
            statusEl.style.borderLeftColor = '#ef4444';
            statusEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        }
        const imageContainer = document.getElementById('slideshow-image-files');
        const videoContainer = document.getElementById('slideshow-video-files');
        const errorHtml = `<div style="padding: 20px; text-align: center; color: var(--text-muted);"><i class="fas fa-exclamation-triangle"></i> ${message}</div>`;
        if (imageContainer) {
            imageContainer.innerHTML = errorHtml;
        }
        if (videoContainer) {
            videoContainer.innerHTML = errorHtml;
        }
    },
    
    // Format file size from bytes to KB/MB
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const kb = bytes / 1024;
        if (kb < 1024) {
            return `${kb.toFixed(1)} KB`;
        }
        const mb = kb / 1024;
        return `${mb.toFixed(1)} MB`;
    },

    // Render available files list with thumbnails
    renderSlideshowFiles(serverIp, httpPort) {
        const imageContainer = document.getElementById('slideshow-image-files');
        const videoContainer = document.getElementById('slideshow-video-files');
        if (!this.slideshowFiles) return;
        
        const images = this.slideshowFiles.images || [];
        const videos = this.slideshowFiles.videos || [];
        
        // Render images
        if (imageContainer) {
            if (images.length === 0) {
                imageContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);"><i class="fas fa-folder-open"></i> No images found</div>`;
            } else {
                let imagesHtml = '';
                images.forEach(img => {
                    const imageUrl = `http://${serverIp}:${httpPort}/images/${encodeURIComponent(img.filename)}`;
                    const width = img.width || '?';
                    const height = img.height || '?';
                    const tooltip = `${width}×${height} · ${this.formatFileSize(img.size)}`;
                    imagesHtml += `
                        <div class="file-item" onclick="app.addToSlideshowPlaylist('${img.filename}', 'image')" style="cursor: pointer; border-radius: var(--radius); overflow: hidden; background: var(--card); border: 2px solid transparent; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='transparent'" title="${tooltip}">
                            <div style="aspect-ratio: 1; background: var(--dark); display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                <img src="${imageUrl}" alt="${img.filename}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<i class=\'fas fa-image\' style=\'font-size: 32px; color: var(--text-muted);\'></i>'">
                            </div>
                            <div style="padding: 8px; font-size: 11px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${img.filename}</div>
                        </div>
                    `;
                });
                imageContainer.innerHTML = imagesHtml;
            }
        }
        
        // Render videos
        if (videoContainer) {
            if (videos.length === 0) {
                videoContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);"><i class="fas fa-folder-open"></i> No videos found</div>`;
            } else {
                let videosHtml = '';
                videos.forEach(vid => {
                    const thumbnailUrl = `http://${serverIp}:${httpPort}/thumbnails/${encodeURIComponent(vid.filename)}`;
                    const vwidth = vid.width || '?';
                    const vheight = vid.height || '?';
                    const vframes = vid.frames || '?';
                    const tooltip = `${vwidth}×${vheight} · ${vframes} frames · ${this.formatFileSize(vid.size)}`;
                    videosHtml += `
                        <div class="file-item" onclick="app.addToSlideshowPlaylist('${vid.filename}', 'video')" style="cursor: pointer; border-radius: var(--radius); overflow: hidden; background: var(--card); border: 2px solid transparent; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='transparent'" title="${tooltip}">
                            <div style="aspect-ratio: 1; background: var(--dark); display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                <img src="${thumbnailUrl}" alt="${vid.filename}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<i class=\'fas fa-video\' style=\'font-size: 32px; color: var(--text-muted);\'></i>'">
                            </div>
                            <div style="padding: 8px; font-size: 11px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${vid.filename}</div>
                        </div>
                    `;
                });
                videoContainer.innerHTML = videosHtml;
            }
        }
    },
    // Add file to playlist
    addToSlideshowPlaylist(filename, type) {
        if (!this.slideshowPlaylist) {
            this.slideshowPlaylist = [];
        }
        
        // Default settings based on type
        const slide = {
            type: type,
            filename: filename,
            scale: 'crop_center',
            use_default_duration: false,
            duration: type === 'image' ? 10 : 0  // Videos default to 0 (use loopcnt instead)
        };
        
        if (type === 'image') {
            slide.ken_burns = false;
            slide.transition = 'fade';
        } else {
            slide.fps = 25;
            slide.loopcnt = 0;  // When loopcnt is 0, video plays once; when >0, loops that many times
        }
        
        this.slideshowPlaylist.push(slide);
        this.renderSlideshowPlaylist();
    },
    
    // Helper to get filename from slide (handles both "file" and "filename" for backward compatibility)
    getSlideFilename(slide) {
        return slide.filename || slide.file || '';
    },
    
    // Remove item from playlist
    removeFromSlideshowPlaylist(index) {
        if (this.slideshowPlaylist) {
            this.slideshowPlaylist.splice(index, 1);
            this.renderSlideshowPlaylist();
        }
    },
    
    // Open slideshow preview modal
    openSlideshowPreview(index) {
        if (!this.slideshowPlaylist || !this.slideshowPlaylist[index]) return;
        
        const slide = this.slideshowPlaylist[index];
        const serverIp = document.getElementById('slideshow-server')?.value || '192.168.1.100';
        const httpPort = document.getElementById('slideshow-http-port')?.value || '8050';
        
        const modal = document.getElementById('slideshow-preview-modal');
        const img = document.getElementById('slideshow-preview-img');
        const metadata = document.getElementById('slideshow-preview-metadata');
        
        if (!modal || !img || !metadata) return;
        
        const isImage = slide.type === 'image';
        const filename = this.getSlideFilename(slide);
        
        if (isImage) {
            img.src = `http://${serverIp}:${httpPort}/images/${encodeURIComponent(filename)}`;
            img.style.display = 'block';
        } else {
            img.style.display = 'none';
        }
        
        // Build metadata display
        let metaHtml = `<strong>Filename:</strong> ${filename}<br>`;
        metaHtml += `<strong>Type:</strong> ${isImage ? 'Image' : 'Video'}<br>`;
        metaHtml += `<strong>Scale:</strong> ${slide.scale || 'crop_center'}<br>`;
        metaHtml += `<strong>Duration:</strong> ${slide.duration || 10}s<br>`;
        
        if (isImage) {
            metaHtml += `<strong>Transition:</strong> ${slide.transition || 'fade'}<br>`;
            metaHtml += `<strong>Ken Burns:</strong> ${slide.ken_burns ? 'Yes' : 'No'}`;
        } else {
            metaHtml += `<strong>FPS:</strong> ${slide.fps || 25}<br>`;
            metaHtml += `<strong>Loops:</strong> ${slide.loopcnt || 0}`;
        }
        
        metadata.innerHTML = metaHtml;
        modal.classList.add('active');
    },
    
    // Close slideshow preview modal
    closeSlideshowPreview() {
        const modal = document.getElementById('slideshow-preview-modal');
        if (modal) {
            modal.classList.remove('active');
        }
        const img = document.getElementById('slideshow-preview-img');
        if (img) {
            img.src = '';
        }
    },
    
    // Render playlist with grid layout
    renderSlideshowPlaylist() {
        const container = document.getElementById('slideshow-playlist');
        if (!container) return;
        
        if (!this.slideshowPlaylist || this.slideshowPlaylist.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 32px; color: var(--text-muted);">
                    <i class="fas fa-film" style="font-size: 24px; margin-bottom: 8px;"></i>
                    <p>No slides in playlist</p>
                    <p style="font-size: 12px;">Click files above to add them</p>
                </div>
            `;
            return;
        }
        
        const serverIp = document.getElementById('slideshow-server')?.value || '192.168.1.100';
        const httpPort = document.getElementById('slideshow-http-port')?.value || '8050';
        
        // Column headers style
        const headerHtml = `
            <div style="display: grid; grid-template-columns: 30px 70px 1fr 100px 90px 100px 70px 40px; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--border); background: var(--dark); font-size: 11px; font-weight: bold; color: var(--text-muted);">
                <span></span>
                <span>Order</span>
                <span>File</span>
                <span>Scale</span>
                <span>Transition</span>
                <span>Duration</span>
                <span>Ken Burns</span>
                <span></span>
            </div>
        `;
        
        let html = headerHtml;
        
        this.slideshowPlaylist.forEach((slide, index) => {
            const isImage = slide.type === 'image';
            const filename = this.getSlideFilename(slide);
            // Skip rendering thumbnail for missing files (like burnsfio.jpg test file)
            const thumbnail = isImage 
                ? `<img src="http://${serverIp}:${httpPort}/images/${encodeURIComponent(filename)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="app.openSlideshowPreview(${index})" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\'fas fa-image\' style=\'font-size: 20px; color: var(--text-muted);\'></i>'" loading="lazy">`
                : `<img src="http://${serverIp}:${httpPort}/thumbnails/${encodeURIComponent(filename)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\'fas fa-video\' style=\'font-size: 20px; color: var(--text-muted);\'></i>'" loading="lazy">`;
            
            // Duration with styled +/- buttons and boxed number (no spinners)
            // Videos can have duration=0 when using loopcnt to control playback time
            const durationHtml = `
                <div class="duration-control">
                    <button type="button" onclick="app.adjustSlideDuration(${index}, -1)">-</button>
                    <input type="number" class="duration-value" value="${slide.duration !== undefined ? slide.duration : (isImage ? 10 : 0)}" min="0" max="300" onchange="app.setSlideDuration(${index}, this.value)">
                    <button type="button" onclick="app.adjustSlideDuration(${index}, 1)">+</button>
                </div>
            `;
            
            // Scale select (styled like main UI)
            const scaleHtml = `
                <select onchange="app.setSlideOption(${index}, 'scale', this.value)">
                    <option value="crop_center" ${slide.scale === 'crop_center' ? 'selected' : ''}>Crop</option>
                    <option value="stretch" ${slide.scale === 'stretch' ? 'selected' : ''}>Stretch</option>
                    <option value="fit_letterbox" ${slide.scale === 'fit_letterbox' ? 'selected' : ''}>Letterbox</option>
                </select>
            `;
            
            let rowHtml = '';
            
            if (isImage) {
                // Transition select (styled like main UI)
                const transitionHtml = `
                    <select onchange="app.setSlideOption(${index}, 'transition', this.value)">
                        <option value="fade" ${slide.transition === 'fade' ? 'selected' : ''}>Fade</option>
                        <option value="cut" ${slide.transition === 'cut' ? 'selected' : ''}>Cut</option>
                        <option value="slide_right" ${slide.transition === 'slide_right' ? 'selected' : ''}>Slide R</option>
                        <option value="slide_left" ${slide.transition === 'slide_left' ? 'selected' : ''}>Slide L</option>
                    </select>
                `;
                
                // Ken Burns checkbox
                const kenBurnsHtml = `
                    <input type="checkbox" ${slide.ken_burns ? 'checked' : ''} onchange="app.setKenBurns(${index}, this.checked)" style="width: 16px; height: 16px; cursor: pointer;">
                `;
                
                rowHtml = `
                    <div class="slideshow-slide-item" draggable="true" data-index="${index}" style="display: grid; grid-template-columns: 24px 30px 70px 1fr 100px 90px 100px 70px 32px; gap: 8px; padding: 10px; border-bottom: 1px solid var(--border); background: var(--card); align-items: center;">
                        <span class="drag-handle" title="Drag to reorder"><i class="fas fa-grip-vertical"></i></span>
                        <span class="slide-number-circle" style="text-align: center;">${index + 1}</span>
                        <div style="text-align: center;">${thumbnail}</div>
                        <span style="font-family: monospace; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${filename}</span>
                        ${scaleHtml}
                        ${transitionHtml}
                        ${durationHtml}
                        <div style="text-align: center;">${kenBurnsHtml}</div>
                        <button class="btn btn-sm btn-danger btn-trash" onclick="app.removeFromSlideshowPlaylist(${index})" title="Remove">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            } else {
                // Video row - different columns
                const videoOptionsHtml = `
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <input type="number" value="${slide.fps || 25}" min="1" max="60" style="background: var(--dark); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 4px 8px; font-size: 11px; width: 45px; height: 32px; text-align: center; -moz-appearance: textfield;" onchange="app.setSlideOption(${index}, 'fps', this.value)">
                        <span style="font-size: 10px; color: var(--text-muted);">fps</span>
                    </div>
                `;
                
                const loopsHtml = `
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <input type="number" value="${slide.loopcnt || 0}" min="0" style="background: var(--dark); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); padding: 4px 8px; font-size: 11px; width: 45px; height: 32px; text-align: center; -moz-appearance: textfield;" onchange="app.setSlideOption(${index}, 'loopcnt', this.value)">
                        <span style="font-size: 10px; color: var(--text-muted);">loops</span>
                    </div>
                `;
                
                rowHtml = `
                    <div class="slideshow-slide-item" draggable="true" data-index="${index}" style="display: grid; grid-template-columns: 24px 30px 70px 1fr 100px 90px 100px 70px 32px; gap: 8px; padding: 10px; border-bottom: 1px solid var(--border); background: var(--card); align-items: center;">
                        <span class="drag-handle" title="Drag to reorder"><i class="fas fa-grip-vertical"></i></span>
                        <span class="slide-number-circle" style="text-align: center;">${index + 1}</span>
                        <div style="text-align: center;">${thumbnail}</div>
                        <span style="font-family: monospace; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${filename}</span>
                        ${scaleHtml}
                        ${videoOptionsHtml}
                        ${loopsHtml}
                        ${durationHtml}
                        <button class="btn btn-sm btn-danger btn-trash" onclick="app.removeFromSlideshowPlaylist(${index})" title="Remove">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
            }
            
            html += rowHtml;
        });
        
        container.innerHTML = html;
        this.setupSlideshowDragAndDrop();
    },
    
    // Adjust slide duration by delta
    adjustSlideDuration(index, delta) {
        if (this.slideshowPlaylist && this.slideshowPlaylist[index]) {
            const slide = this.slideshowPlaylist[index];
            const currentDuration = slide.duration !== undefined ? slide.duration : (slide.type === 'image' ? 10 : 0);
            const newDuration = Math.max(0, Math.min(300, currentDuration + delta));
            slide.duration = newDuration;
            this.renderSlideshowPlaylist();
        }
    },
    
    // Set Ken Burns option and adjust duration
    setKenBurns(index, enabled) {
        if (this.slideshowPlaylist && this.slideshowPlaylist[index]) {
            this.slideshowPlaylist[index].ken_burns = enabled;
            // When Ken Burns is enabled, set duration to 15 seconds
            if (enabled) {
                this.slideshowPlaylist[index].duration = 15;
            }
            this.renderSlideshowPlaylist();
        }
    },
    

    
    // Set slide duration
    setSlideDuration(index, value) {
        if (this.slideshowPlaylist && this.slideshowPlaylist[index]) {
            const parsed = parseInt(value);
            // Allow 0 for videos (when using loopcnt), default to 10 for invalid values on images
            this.slideshowPlaylist[index].duration = isNaN(parsed) ? 10 : parsed;
        }
    },
    
    // Set slide option
    setSlideOption(index, key, value) {
        if (this.slideshowPlaylist && this.slideshowPlaylist[index]) {
            this.slideshowPlaylist[index][key] = value;
            
            // Handle loopcnt changes for video slides
            if (key === 'loopcnt') {
                const loopcnt = parseInt(value) || 0;
                // When loopcnt is non-zero, set duration to 0 (loopcnt controls playback time)
                // When loopcnt is 0, set duration to 10 (single play with duration control)
                this.slideshowPlaylist[index].duration = loopcnt > 0 ? 0 : 10;
                this.renderSlideshowPlaylist();
            }
        }
    },
    
    // Setup drag and drop for playlist
    setupSlideshowDragAndDrop() {
        const list = document.getElementById('slideshow-playlist');
        if (!list) return;
        
        let draggedItem = null;
        
        list.querySelectorAll('.slideshow-slide-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
            });
            
            item.addEventListener('dragend', () => {
                item.style.opacity = '1';
                draggedItem = null;
                this.updateSlideshowOrder();
            });
            
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                if (draggedItem && draggedItem !== item) {
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    
                    if (e.clientY < midY) {
                        item.parentNode.insertBefore(draggedItem, item);
                    } else {
                        item.parentNode.insertBefore(draggedItem, item.nextSibling);
                    }
                }
            });
        });
    },
    
    // Update playlist order after drag
    updateSlideshowOrder() {
        const list = document.getElementById('slideshow-playlist');
        if (!list || !this.slideshowPlaylist) return;
        
        const newOrder = [];
        list.querySelectorAll('.slideshow-slide-item').forEach(item => {
            const oldIndex = parseInt(item.dataset.index);
            newOrder.push(this.slideshowPlaylist[oldIndex]);
        });
        
        this.slideshowPlaylist = newOrder;
        this.renderSlideshowPlaylist();
    },
    
    // Get slideshow configuration from form fields
    getSlideshowFromForm() {
        return {
            enabled: true,  // CRITICAL: Must be true for mjpeg_sender to process playlist
            server: document.getElementById('slideshow-server')?.value || '192.168.1.100',
            stream_port: parseInt(document.getElementById('slideshow-stream-port')?.value) || 8090,
            http_port: parseInt(document.getElementById('slideshow-http-port')?.value) || 8050,
            default_duration: parseInt(document.getElementById('slideshow-default-duration')?.value) || 10,
            slides: this.slideshowPlaylist || []
        };
    },
    
    // Save slideshow playlist to config
    saveSlideshowPlaylist() {
        // Save to ROOT level slideshow object, not in services
        this.config.slideshow = this.getSlideshowFromForm();
        
        this.closeSlideshowManager();
        this.showToast('Slideshow playlist saved', 'success');
    },
    
    // Show toast notification
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 
                    type === 'error' ? 'exclamation-circle' : 
                    type === 'warning' ? 'exclamation-triangle' : 'info-circle';
        
        toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 4000);
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Auto-generate ID from name
        document.getElementById('device-name')?.addEventListener('input', (e) => {
            const idInput = document.getElementById('device-id');
            if (!idInput.value || idInput.dataset.auto === 'true') {
                idInput.value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
                idInput.dataset.auto = 'true';
            }
        });
        
        document.getElementById('device-id')?.addEventListener('input', (e) => {
            e.target.dataset.auto = 'false';
        });
        
        // Site settings collapse toggle
        const siteSettingsHeader = document.querySelector('.site-settings-panel .section-header');
        if (siteSettingsHeader) {
            siteSettingsHeader.style.cursor = 'pointer';
        }
        
        // Weather Service inputs - auto-save on change
        const weatherInputs = [
            'weather-server-ip', 'weather-server-port', 'weather-fps',
            'weather-file-sunny', 'weather-file-cloudy', 'weather-file-rainy',
            'weather-file-drizzle', 'weather-file-stormy', 'weather-file-windy',
            'weather-file-hot'
        ];
        
        weatherInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', () => {
                    this.updateWeatherServiceFromForm();
                });
            }
        });
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
