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
            site_meta: { version: '1.0', last_updated: new Date().toISOString().split('T')[0] },
            site_info: { site_name: 'My Home', guest_ssid: '', guest_wifi_password: '' },
            defaults: { cover_opening_time: '08:00', cover_closing_time: '19:00', site_cover_up_time: 14300, site_cover_down_time: 11500 },
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
        window.open(`/api/config/export/${filename}`, '_blank');
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
                tests: []
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
        const voiceEnabled = document.getElementById('voice-assistant-enabled');
        const usePresence = document.getElementById('use-presence-for-screen');
        const screenTimeout = document.getElementById('screen-timeout');
        const screenBrightness = document.getElementById('screen-brightness');
        const volume = document.getElementById('volume');
        
        if (presenceEntity) this.currentDevice.presence_entity = presenceEntity.value;
        if (voiceEnabled) this.currentDevice.voice_assistant_enabled = voiceEnabled.checked;
        if (usePresence) this.currentDevice.use_presence_for_screen = usePresence.checked;
        if (screenTimeout) this.currentDevice.screen_timeout = parseInt(screenTimeout.value) || 30;
        if (screenBrightness) this.currentDevice.screen_brightness = parseInt(screenBrightness.value) || 80;
        if (volume) this.currentDevice.volume = parseInt(volume.value) || 50;
        
        // Update widget data from cards
        this.updateWidgetsFromCards('lights');
        this.updateWidgetsFromCards('covers');
        this.updateWidgetsFromCards('climate');
        this.updateWidgetsFromCards('tests');
    },
    
    // Update widget array from card forms
    updateWidgetsFromCards(type) {
        const container = document.getElementById(`${type}-list`);
        if (!container) return;
        
        const cards = container.querySelectorAll('.widget-card');
        const widgets = [];
        
        cards.forEach(card => {
            const entity = card.querySelector('.entity-input').value;
            const name = card.querySelector('.name-input').value;
            
            if (!entity) return; // Skip empty
            
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
            } else if (type === 'tests') {
                widgets.push({
                    entity,
                    name: name || entity
                });
            }
        });
        
        this.currentDevice.widgets[type] = widgets;
        
        // Update badge immediately
        this.updateWidgetCount(type);
    },
    
    // Add new widget
    addWidget(type) {
        if (!this.currentDevice) {
            this.showToast('Select a room first', 'warning');
            return;
        }
        
        if (!this.currentDevice.widgets[type]) {
            this.currentDevice.widgets[type] = [];
        }
        
        const list = document.getElementById(`${type}-list`);
        
        // Get template ID based on type
        let templateId;
        if (type === 'lights') templateId = 'light-widget-template';
        else if (type === 'covers') templateId = 'cover-widget-template';
        else if (type === 'climate') templateId = 'climate-widget-template';
        else if (type === 'tests') templateId = 'tests-widget-template';
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
            
            // Add entity validation
            const entityInput = card.querySelector('.entity-input');
            entityInput.addEventListener('blur', () => {
                this.validateEntity(entityInput.value, card);
            });
            
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
            
            // Scroll to new widget
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },
    
    // Remove widget
    removeWidget(button) {
        const card = button.closest('.widget-card');
        const type = card.dataset.type + 's';
        const list = document.getElementById(`${type}-list`);
        
        card.remove();
        
        // Renumber remaining cards
        const cards = list.querySelectorAll('.widget-card');
        cards.forEach((c, i) => {
            c.dataset.index = i;
            const number = c.querySelector('.widget-number');
            if (number) {
                number.textContent = `#${i + 1}`;
            }
        });
        
        this.updateWidgetCount(type);
    },
    
    // Update widget count badge
    updateWidgetCount(type) {
        // Get count from DOM
        const list = document.getElementById(`${type}-list`);
        const count = list ? list.querySelectorAll('.widget-card').length : 0;
        
        // Badge IDs are plural: lights-count, covers-count
        const badge = document.getElementById(`${type}-count`);
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
            const input = this.currentEntityButton.closest('.input-with-action').querySelector('.entity-input');
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
        if (!panel) return;
        
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
        } else {
            panel.style.display = 'none';
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
            'mdi:curtains': '<svg class="mdi-icon" viewBox="0 0 24 24"><path d="M12 2C12 2 8 4 8 9C8 11 9 13 10 14V16C10 17 9 18 8 19C7 20 6 21 6 22H18C18 21 17 20 16 19C15 18 14 17 14 16V14C15 13 16 11 16 9C16 4 12 2 12 2M12 4.5C12.5 5 13 6 13 9C13 10.5 12.5 11.5 12 12.5C11.5 11.5 11 10.5 11 9C11 6 11.5 5 12 4.5Z"/></svg>',
            'mdi:test-tube': '<svg class="mdi-icon" viewBox="0 0 24 24"><path d="M7 2V4H9V12.5C9 13.88 7.88 15 6.5 15C5.12 15 4 13.88 4 12.5V4H6V2H2V4H3V12.5C3 14.43 4.57 16 6.5 16C8.43 16 10 14.43 10 12.5V4H11V2H7M16.5 2C14.57 2 13 3.57 13 5.5C13 7.43 14.57 9 16.5 9C18.43 9 20 7.43 20 5.5C20 3.57 18.43 2 16.5 2M16.5 7C15.67 7 15 6.33 15 5.5C15 4.67 15.67 4 16.5 4C17.33 4 18 4.67 18 5.5C18 6.33 17.33 7 16.5 7M16.5 10C14.57 10 13 11.57 13 13.5C13 15.43 14.57 17 16.5 17C18.43 17 20 15.43 20 13.5C20 11.57 18.43 10 16.5 10M16.5 15C15.67 15 15 14.33 15 13.5C15 12.67 15.67 12 16.5 12C17.33 12 18 12.67 18 13.5C18 14.33 17.33 15 16.5 15Z"/></svg>',
            'mdi:lightbulb': '<i class="fas fa-lightbulb"></i>',
            'mdi:thermostat': '<i class="fas fa-temperature-half"></i>',
            'mdi:weather-partly-cloudy': '<i class="fas fa-cloud-sun"></i>',
            'mdi:shield-home': '<i class="fas fa-shield-alt"></i>',
            'mdi:music': '<i class="fas fa-music"></i>',
            'mdi:image': '<i class="fas fa-image"></i>',
            'mdi:phone': '<i class="fas fa-phone"></i>',
            'mdi:bullhorn': '<i class="fas fa-bullhorn"></i>',
            'mdi:microphone': '<i class="fas fa-microphone"></i>'
        };
        
        this.widgetTypes.forEach(type => {
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
        const voiceEnabled = document.getElementById('voice-assistant-enabled');
        const usePresence = document.getElementById('use-presence-for-screen');
        const screenTimeout = document.getElementById('screen-timeout');
        const screenBrightness = document.getElementById('screen-brightness');
        const volume = document.getElementById('volume');
        
        if (presenceEntity) presenceEntity.value = this.currentDevice.presence_entity || '';
        if (voiceEnabled) voiceEnabled.checked = this.currentDevice.voice_assistant_enabled || false;
        if (usePresence) usePresence.checked = this.currentDevice.use_presence_for_screen || false;
        if (screenTimeout) screenTimeout.value = this.currentDevice.screen_timeout || 30;
        if (screenBrightness) screenBrightness.value = this.currentDevice.screen_brightness || 80;
        if (volume) volume.value = this.currentDevice.volume || 50;
        
        // Render lights
        this.renderWidgetList('lights', this.currentDevice.widgets?.lights || []);
        
        // Render covers
        this.renderWidgetList('covers', this.currentDevice.widgets?.covers || []);
        
        // Render climate
        this.renderWidgetList('climate', this.currentDevice.widgets?.climate || []);
        
        // Render tester widgets
        this.renderWidgetList('tests', this.currentDevice.widgets?.tests || []);
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
        else if (type === 'tests') templateId = 'tests-widget-template';
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
            }
            // Note: tests widgets only have entity and name fields, already set above
            
            // Add validation listener
            const entityInput = card.querySelector('.entity-input');
            entityInput.addEventListener('blur', () => {
                this.validateEntity(entityInput.value, card);
            });
            
            // Add change listener to update count
            const inputs = card.querySelectorAll('input, select');
            inputs.forEach(input => {
                input.addEventListener('change', () => {
                    this.updateWidgetCount(type);
                });
            });
            
            // Trigger initial validation
            this.validateEntity(widget.entity, card);
            
            list.appendChild(card);
        });
        
        this.updateWidgetCount(type);
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
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
