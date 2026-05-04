/**
 * Smartpanel Controller - Real-time device control
 */

const controller = {
    devices: [],
    selectedDevice: null,
    eqEnabled: false,
    activeProfile: 'music',
    profiles: {
        music:    { enabled: true, bands: [] },
        intercom: { enabled: true, bands: [] },
        pa:       { enabled: true, bands: [] }
    },
    bands: [],
    referenceCurve: [],
    sampleRate: 48000,
    dbMin: -24,
    dbMax: 24,

    // Filter type mapping
    filterTypes: [
        { id: 'PEAK', name: 'Peaking' },
        { id: 'LOW_SHELF', name: 'Low Shelf' },
        { id: 'HIGH_SHELF', name: 'High Shelf' },
        { id: 'LOW_PASS', name: 'Low Pass' },
        { id: 'HIGH_PASS', name: 'High Pass' }
    ],

    async init() {
        await this.loadProfiles();
        this.loadDevices();
        this.setupEventListeners();
        this.setupFacilitySwitching();
        this.applyProfileToUI();
        this.renderBands();
        this.drawCanvas();
    },

    // Derive ESPHome entity base from MAC (matches firmware name_add_mac_suffix)
    deriveEntityBase(mac) {
        if (!mac) return '';
        const clean = mac.toLowerCase().replace(/[:\-]/g, '');
        const suffix = clean.slice(-6);
        if (suffix.length === 6 && /^[0-9a-f]+$/.test(suffix)) {
            return `smartpanel_${suffix}`;
        }
        return '';
    },

    async loadProfiles() {
        try {
            const response = await fetch('./api/eq_profiles');
            const data = await response.json();
            if (data.success) {
                this.profiles = data.eq_profiles || this.profiles;
                this.activeProfile = data.eq_active_profile || 'music';
                this.eqEnabled = data.eq_enabled || false;
                // Update profile select
                const select = document.getElementById('eq-profile-select');
                if (select) select.value = this.activeProfile;
                // Update master enable
                const enableCb = document.getElementById('eq-master-enable');
                if (enableCb) enableCb.checked = this.eqEnabled;
            }
        } catch (error) {
            console.error('Failed to load EQ profiles:', error);
            // Fallback: init default bands for music profile
            this.initDefaultBands();
        }
    },

    initDefaultBands() {
        const defaults = [
            { band: 0, type: 'PEAK', freq: 505, q: 1.0, gain_db: -3.4, enabled: true },
            { band: 1, type: 'PEAK', freq: 730, q: 1.0, gain_db: -9.5, enabled: true },
            { band: 2, type: 'HIGH_SHELF', freq: 3000, q: 0.7, gain_db: -4.0, enabled: true },
            { band: 3, type: 'PEAK', freq: 5000, q: 1.0, gain_db: -2.0, enabled: true },
            { band: 4, type: 'PEAK', freq: 7000, q: 1.0, gain_db: -3.0, enabled: true },
            { band: 5, type: 'LOW_SHELF', freq: 570, q: 0.5, gain_db: 8.9, enabled: true }
        ];
        this.profiles.music.bands = JSON.parse(JSON.stringify(defaults));
        this.profiles.intercom.bands = JSON.parse(JSON.stringify(defaults));
        this.profiles.pa.bands = JSON.parse(JSON.stringify(defaults));
    },

    applyProfileToUI() {
        const profile = this.profiles[this.activeProfile];
        if (profile && profile.bands) {
            this.bands = JSON.parse(JSON.stringify(profile.bands));
            this.eqEnabled = profile.enabled;
        } else {
            this.initDefaultBands();
            this.bands = JSON.parse(JSON.stringify(this.profiles[this.activeProfile].bands));
        }
        const enableCb = document.getElementById('eq-master-enable');
        if (enableCb) enableCb.checked = this.eqEnabled;
    },

    switchProfile(profileName) {
        // Save current bands back to the outgoing profile
        this.updateBandFromUI();
        this.profiles[this.activeProfile].bands = JSON.parse(JSON.stringify(this.bands));
        this.profiles[this.activeProfile].enabled = this.eqEnabled;

        // Switch to new profile
        this.activeProfile = profileName;
        this.applyProfileToUI();
        this.renderBands();
        this.drawCanvas();
    },

    setupFacilitySwitching() {
        const items = document.querySelectorAll('.facility-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                if (item.classList.contains('disabled')) return;
                const facilityId = item.dataset.facility;
                this.switchFacility(facilityId);
            });
        });
    },

    switchFacility(facilityId) {
        // Update sidebar
        document.querySelectorAll('.facility-item').forEach(el => {
            el.classList.toggle('active', el.dataset.facility === facilityId);
        });
        // Update panels
        document.querySelectorAll('.facility-panel').forEach(el => {
            el.classList.toggle('active', el.dataset.facility === facilityId);
        });
        // Redraw canvas if switching to EQ
        if (facilityId === 'eq') {
            this.drawCanvas();
        }
    },

    async loadDevices() {
        try {
            const response = await fetch('./api/devices');
            const data = await response.json();
            this.devices = data.devices || [];
            this.renderDeviceSelector();
        } catch (error) {
            console.error('Failed to load devices:', error);
            this.showToast('Failed to load devices', 'error');
        }
    },

    renderDeviceSelector() {
        const select = document.getElementById('device-select');
        select.innerHTML = '<option value="">Select a panel...</option>';
        this.devices.forEach(dev => {
            const opt = document.createElement('option');
            opt.value = dev.ip;
            opt.textContent = `${dev.name} (${dev.ip})`;
            select.appendChild(opt);
        });
    },

    setupEventListeners() {
        document.getElementById('device-select').addEventListener('change', async (e) => {
            this.selectedDevice = this.devices.find(d => d.ip === e.target.value) || null;
            this.updateDeviceStatus();
            if (this.selectedDevice) {
                await this.loadDeviceHaState();
            }
        });

        document.getElementById('eq-profile-select').addEventListener('change', (e) => {
            this.switchProfile(e.target.value);
        });

        document.getElementById('eq-master-enable').addEventListener('change', (e) => {
            this.eqEnabled = e.target.checked;
            this.drawCanvas();
        });

        document.getElementById('btn-send-eq').addEventListener('click', () => this.sendEqToDevice());
        document.getElementById('btn-save-eq').addEventListener('click', () => this.saveEqToConfig());
        document.getElementById('btn-load-ref').addEventListener('click', () => {
            document.getElementById('ref-file-input').click();
        });
        document.getElementById('ref-file-input').addEventListener('change', (e) => this.loadReferenceCurve(e));

        this.setupCanvasTooltip();
    },

    async loadDeviceHaState() {
        if (!this.selectedDevice) return;
        const deviceId = this.selectedDevice.id;
        const mac = this.selectedDevice.mac;
        const base = this.deriveEntityBase(mac) || deviceId.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');

        try {
            // Read active profile
            const profileResp = await fetch(`./api/ha_state/sensor.${base}_eq_active_profile`);
            const profileData = await profileResp.json();
            if (profileData.success && ['music', 'intercom', 'pa'].includes(profileData.state)) {
                this.activeProfile = profileData.state;
                document.getElementById('eq-profile-select').value = this.activeProfile;
            }

            // Read enabled state
            const enabledResp = await fetch(`./api/ha_state/binary_sensor.${base}_eq_enabled`);
            const enabledData = await enabledResp.json();
            if (enabledData.success) {
                this.eqEnabled = enabledData.state === 'on';
                document.getElementById('eq-master-enable').checked = this.eqEnabled;
            }

            // Read bands for the active profile (from native ESPHome text_sensor state)
            const bandsResp = await fetch(`./api/ha_state/sensor.${base}_eq_bands`);
            const bandsData = await bandsResp.json();
            const bandsState = bandsData.state;
            if (bandsData.success && bandsState && bandsState !== 'unknown' && bandsState !== 'unavailable') {
                try {
                    const bands = JSON.parse(bandsState);
                    if (Array.isArray(bands) && bands.length > 0) {
                        // Support both compact (e/t/f/q/g) and legacy full field names
                        const typeMap = { LS: 'LOW_SHELF', HS: 'HIGH_SHELF', PK: 'PEAK', LP: 'LOW_PASS', HP: 'HIGH_PASS' };
                        this.profiles[this.activeProfile].bands = bands.map((b, i) => ({
                            band: i,
                            type: typeMap[b.t] || b.type || 'PEAK',
                            freq: b.f !== undefined ? b.f : (b.freq || 1000),
                            q: b.q !== undefined ? b.q : (b.q || 1.0),
                            gain_db: b.g !== undefined ? b.g : (b.gain_db || 0.0),
                            enabled: b.e !== undefined ? !!b.e : (b.enabled !== false)
                        }));
                    }
                } catch (e) {
                    console.warn('Failed to parse HA bands state:', e);
                }
            }

            this.applyProfileToUI();
            this.renderBands();
            this.drawCanvas();
            this.showToast('Loaded live EQ state from HA', 'info');
        } catch (error) {
            console.warn('Failed to load HA state:', error);
            // Keep config defaults, don't show error toast
        }
    },

    setupCanvasTooltip() {
        const canvas = document.getElementById('eq-canvas');
        const tooltip = document.getElementById('eq-tooltip');
        let savedImageData = null;

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const mouseX = (e.clientX - rect.left) * scaleX;
            const mouseY = (e.clientY - rect.top) * scaleY;

            // Only active inside the plot area (x >= 50, x <= width-10)
            if (mouseX < 50 || mouseX > canvas.width - 10) {
                tooltip.style.display = 'none';
                if (savedImageData) {
                    const ctx = canvas.getContext('2d');
                    ctx.putImageData(savedImageData, 0, 0);
                    savedImageData = null;
                }
                return;
            }

            const freq = this.xToFreq(mouseX, canvas.width, 20, 20000);
            if (freq < 20 || freq > 20000) {
                tooltip.style.display = 'none';
                return;
            }

            // Compute exact dB values at this frequency
            const eqDb = this.evaluateEqAtFreq(freq);
            const refDb = this.referenceCurve.length > 0 ? this.interpolateReference([freq])[0] : null;
            const netDb = refDb !== null ? eqDb + refDb : eqDb;

            // Build tooltip HTML
            let html = `<div class="tt-freq">${freq >= 1000 ? (freq / 1000).toFixed(2) + ' kHz' : freq.toFixed(0) + ' Hz'}</div>`;
            html += `<div class="tt-row"><span class="tt-label">EQ:</span><span class="tt-val tt-eq">${(eqDb > 0 ? '+' : '') + eqDb.toFixed(1)} dB</span></div>`;
            if (refDb !== null) {
                html += `<div class="tt-row"><span class="tt-label">Ref:</span><span class="tt-val tt-ref">${(refDb > 0 ? '+' : '') + refDb.toFixed(1)} dB</span></div>`;
                html += `<div class="tt-row"><span class="tt-label">Net:</span><span class="tt-val tt-net">${(netDb > 0 ? '+' : '') + netDb.toFixed(1)} dB</span></div>`;
            }
            tooltip.innerHTML = html;

            // Position tooltip near mouse but keep inside viewport
            const tooltipRect = tooltip.getBoundingClientRect();
            let left = e.clientX + 16;
            let top = e.clientY - 10;
            if (left + tooltipRect.width > window.innerWidth - 10) {
                left = e.clientX - tooltipRect.width - 16;
            }
            if (top + tooltipRect.height > window.innerHeight - 10) {
                top = e.clientY - tooltipRect.height - 10;
            }
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
            tooltip.style.display = 'block';

            // Draw crosshair
            const ctx = canvas.getContext('2d');
            if (!savedImageData) {
                savedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            } else {
                ctx.putImageData(savedImageData, 0, 0);
            }
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(mouseX, 0);
            ctx.lineTo(mouseX, canvas.height - 30);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw dot on each active curve at this frequency
            const plotYeq = this.dbToY(eqDb, canvas.height, this.dbMin, this.dbMax);
            this.drawTooltipDot(ctx, mouseX, plotYeq, '#4488ff');
            if (refDb !== null) {
                const plotYref = this.dbToY(refDb, canvas.height, this.dbMin, this.dbMax);
                const plotYnet = this.dbToY(netDb, canvas.height, this.dbMin, this.dbMax);
                this.drawTooltipDot(ctx, mouseX, plotYref, '#888888');
                this.drawTooltipDot(ctx, mouseX, plotYnet, '#00ff88');
            }
        });

        canvas.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
            if (savedImageData) {
                const ctx = canvas.getContext('2d');
                ctx.putImageData(savedImageData, 0, 0);
                savedImageData = null;
            }
        });
    },

    drawTooltipDot(ctx, x, y, color) {
        if (y < 0 || y > ctx.canvas.height) return;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
    },

    xToFreq(x, w, fMin, fMax) {
        const t = (x - 50) / (w - 60);
        return fMin * Math.pow(fMax / fMin, t);
    },

    evaluateEqAtFreq(freq) {
        if (!this.eqEnabled) return 0;
        let totalDb = 0;
        this.bands.forEach(band => {
            if (!band.enabled) return;
            const coeffs = this.computeBiquadCoefficients(band.type, band.freq, band.q, band.gain_db);
            totalDb += this.evaluateMagnitude(coeffs, freq, this.sampleRate);
        });
        return totalDb;
    },

    updateDeviceStatus() {
        const status = document.getElementById('device-status');
        if (this.selectedDevice) {
            status.textContent = 'Selected';
            status.className = 'status-indicator online';
        } else {
            status.textContent = 'Offline';
            status.className = 'status-indicator offline';
        }
    },

    renderBands() {
        const container = document.getElementById('bands-container');
        container.innerHTML = '';

        this.bands.forEach((band, idx) => {
            const card = document.createElement('div');
            card.className = 'band-card';
            card.innerHTML = `
                <div class="band-header">
                    <span class="band-number">Band ${idx + 1}</span>
                    <label class="band-enable">
                        <input type="checkbox" data-idx="${idx}" class="band-enabled" ${band.enabled ? 'checked' : ''}>
                        <span>On</span>
                    </label>
                </div>
                <div class="band-controls">
                    <div class="control-group">
                        <label>Type</label>
                        <select data-idx="${idx}" class="band-type">
                            ${this.filterTypes.map(t => `<option value="${t.id}" ${band.type === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="control-group">
                        <label>Freq (Hz)</label>
                        <input type="number" data-idx="${idx}" class="band-freq" value="${band.freq}" min="20" max="20000" step="1">
                    </div>
                    <div class="control-group">
                        <label>Q</label>
                        <input type="number" data-idx="${idx}" class="band-q" value="${band.q}" min="0.1" max="10" step="0.01">
                    </div>
                    <div class="control-group">
                        <label>Gain (dB)</label>
                        <input type="number" data-idx="${idx}" class="band-gain" value="${band.gain_db}" min="-20" max="20" step="0.1">
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        // Attach listeners
        container.querySelectorAll('.band-enabled, .band-type, .band-freq, .band-q, .band-gain').forEach(el => {
            el.addEventListener('change', () => this.updateBandFromUI());
            el.addEventListener('input', () => { this.updateBandFromUI(); this.drawCanvas(); });
        });
    },

    updateBandFromUI() {
        const container = document.getElementById('bands-container');
        this.bands.forEach((band, idx) => {
            band.enabled = container.querySelector(`.band-enabled[data-idx="${idx}"]`).checked;
            band.type = container.querySelector(`.band-type[data-idx="${idx}"]`).value;
            band.freq = parseFloat(container.querySelector(`.band-freq[data-idx="${idx}"]`).value) || 1000;
            band.q = parseFloat(container.querySelector(`.band-q[data-idx="${idx}"]`).value) || 1.0;
            band.gain_db = parseFloat(container.querySelector(`.band-gain[data-idx="${idx}"]`).value) || 0.0;
        });
    },

    // ========================================================================
    // Biquad Math (RBJ Audio EQ Cookbook)
    // ========================================================================

    computeBiquadCoefficients(type, freq, q, gain_db) {
        const fs = this.sampleRate;
        const A = Math.pow(10, gain_db / 40);
        const w0 = 2 * Math.PI * freq / fs;
        const cosw0 = Math.cos(w0);
        const sinw0 = Math.sin(w0);
        let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;

        if (type === 'PEAK') {
            const alpha = sinw0 / (2 * q);
            b0 = 1 + alpha * A;
            b1 = -2 * cosw0;
            b2 = 1 - alpha * A;
            a0 = 1 + alpha / A;
            a1 = -2 * cosw0;
            a2 = 1 - alpha / A;
        } else if (type === 'LOW_SHELF') {
            const alpha = sinw0 / 2 * Math.sqrt((A + 1 / A) * (1 / q - 1) + 2);
            const sqrtA2alpha = 2 * Math.sqrt(A) * alpha;
            b0 = A * ((A + 1) - (A - 1) * cosw0 + sqrtA2alpha);
            b1 = 2 * A * ((A - 1) - (A + 1) * cosw0);
            b2 = A * ((A + 1) - (A - 1) * cosw0 - sqrtA2alpha);
            a0 = (A + 1) + (A - 1) * cosw0 + sqrtA2alpha;
            a1 = -2 * ((A - 1) + (A + 1) * cosw0);
            a2 = (A + 1) + (A - 1) * cosw0 - sqrtA2alpha;
        } else if (type === 'HIGH_SHELF') {
            const alpha = sinw0 / 2 * Math.sqrt((A + 1 / A) * (1 / q - 1) + 2);
            const sqrtA2alpha = 2 * Math.sqrt(A) * alpha;
            b0 = A * ((A + 1) + (A - 1) * cosw0 + sqrtA2alpha);
            b1 = -2 * A * ((A - 1) + (A + 1) * cosw0);
            b2 = A * ((A + 1) + (A - 1) * cosw0 - sqrtA2alpha);
            a0 = (A + 1) - (A - 1) * cosw0 + sqrtA2alpha;
            a1 = 2 * ((A - 1) - (A + 1) * cosw0);
            a2 = (A + 1) - (A - 1) * cosw0 - sqrtA2alpha;
        } else if (type === 'LOW_PASS') {
            const alpha = sinw0 / (2 * q);
            b0 = (1 - cosw0) / 2;
            b1 = 1 - cosw0;
            b2 = (1 - cosw0) / 2;
            a0 = 1 + alpha;
            a1 = -2 * cosw0;
            a2 = 1 - alpha;
        } else if (type === 'HIGH_PASS') {
            const alpha = sinw0 / (2 * q);
            b0 = (1 + cosw0) / 2;
            b1 = -(1 + cosw0);
            b2 = (1 + cosw0) / 2;
            a0 = 1 + alpha;
            a1 = -2 * cosw0;
            a2 = 1 - alpha;
        }

        return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
    },

    evaluateMagnitude(coeffs, f, fs) {
        const w = 2 * Math.PI * f / fs;
        const cosw = Math.cos(w);
        const sinw = Math.sin(w);
        const cos2w = Math.cos(2 * w);
        const sin2w = Math.sin(2 * w);

        // Numerator: b0 + b1*e^(-jw) + b2*e^(-j2w)
        const num_re = coeffs.b0 + coeffs.b1 * cosw + coeffs.b2 * cos2w;
        const num_im = -coeffs.b1 * sinw - coeffs.b2 * sin2w;

        // Denominator: 1 + a1*e^(-jw) + a2*e^(-j2w)
        const den_re = 1 + coeffs.a1 * cosw + coeffs.a2 * cos2w;
        const den_im = -coeffs.a1 * sinw - coeffs.a2 * sin2w;

        const num_mag_sq = num_re * num_re + num_im * num_im;
        const den_mag_sq = den_re * den_re + den_im * den_im;

        if (den_mag_sq === 0) return 0;
        const mag = Math.sqrt(num_mag_sq / den_mag_sq);
        return 20 * Math.log10(mag + 1e-15);
    },

    computeEqResponse(freqs) {
        if (!this.eqEnabled) return freqs.map(() => 0);

        let totalResponse = new Array(freqs.length).fill(0);

        this.bands.forEach(band => {
            if (!band.enabled) return;
            const coeffs = this.computeBiquadCoefficients(band.type, band.freq, band.q, band.gain_db);
            freqs.forEach((f, i) => {
                totalResponse[i] += this.evaluateMagnitude(coeffs, f, this.sampleRate);
            });
        });

        return totalResponse;
    },

    // ========================================================================
    // Canvas Drawing
    // ========================================================================

    drawCanvas() {
        const canvas = document.getElementById('eq-canvas');
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        // Generate log-spaced frequencies
        const numPoints = 400;
        const fMin = 20;
        const fMax = 20000;
        const freqs = [];
        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            freqs.push(fMin * Math.pow(fMax / fMin, t));
        }

        const eqResponse = this.computeEqResponse(freqs);
        const refResponse = this.referenceCurve.length > 0 ? this.interpolateReference(freqs) : null;
        const netResponse = refResponse ? eqResponse.map((eq, i) => eq + refResponse[i]) : eqResponse;

        // Auto-scale Y-axis to fit all visible data
        this.autoScaleRange(eqResponse, refResponse, netResponse);

        // Clear
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);

        // Grid
        this.drawGrid(ctx, w, h, fMin, fMax);

        // Plot reference
        if (refResponse) {
            this.drawCurve(ctx, w, h, freqs, refResponse, '#888888', 1.5, [5, 5]);
        }

        // Plot EQ
        this.drawCurve(ctx, w, h, freqs, eqResponse, '#4488ff', 2.5, null);

        // Plot net
        if (refResponse) {
            this.drawCurve(ctx, w, h, freqs, netResponse, '#00ff88', 2, null);
        }
    },

    autoScaleRange(eqResponse, refResponse, netResponse) {
        // Collect all visible data points
        let allValues = [...eqResponse];
        if (refResponse) {
            allValues = allValues.concat(refResponse);
            allValues = allValues.concat(netResponse);
        }

        let dataMin = Math.min(...allValues);
        let dataMax = Math.max(...allValues);

        // If everything is flat at 0 dB (no EQ, no ref), use a sensible default
        if (dataMin === 0 && dataMax === 0) {
            this.dbMin = -6;
            this.dbMax = 6;
            return;
        }

        // Add padding (10% of range or 3 dB, whichever is larger)
        const range = dataMax - dataMin;
        const pad = Math.max(range * 0.1, 3);
        let minVal = dataMin - pad;
        let maxVal = dataMax + pad;

        // Ensure minimum 12 dB of visible range for readability
        if (maxVal - minVal < 12) {
            const centre = (minVal + maxVal) / 2;
            minVal = centre - 6;
            maxVal = centre + 6;
        }

        // Choose a nice step size based on the range
        const rawRange = maxVal - minVal;
        let step;
        if (rawRange <= 12) step = 2;
        else if (rawRange <= 30) step = 5;
        else if (rawRange <= 60) step = 10;
        else step = 20;

        // Round min down and max up to nice step boundaries
        this.dbMin = Math.floor(minVal / step) * step;
        this.dbMax = Math.ceil(maxVal / step) * step;
    },

    drawGrid(ctx, w, h, fMin, fMax) {
        ctx.strokeStyle = '#333355';
        ctx.lineWidth = 1;
        ctx.font = '11px monospace';
        ctx.fillStyle = '#8888aa';

        const dbMin = this.dbMin;
        const dbMax = this.dbMax;
        const range = dbMax - dbMin;

        // Choose step to get ~8-10 horizontal grid lines
        let step;
        if (range <= 12) step = 2;
        else if (range <= 20) step = 3;
        else if (range <= 40) step = 5;
        else if (range <= 80) step = 10;
        else step = 20;

        // Vertical freq lines
        const freqTicks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        freqTicks.forEach(f => {
            const x = this.freqToX(f, w, fMin, fMax);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h - 30);
            ctx.stroke();
            ctx.fillText(f >= 1000 ? (f / 1000) + 'k' : f.toString(), x - 10, h - 10);
        });

        // Horizontal dB lines
        const startDb = Math.ceil(dbMin / step) * step;
        for (let db = startDb; db <= dbMax; db += step) {
            const y = this.dbToY(db, h, dbMin, dbMax);
            ctx.beginPath();
            ctx.moveTo(50, y);
            ctx.lineTo(w, y);
            ctx.stroke();
            ctx.fillText(db + 'dB', 5, y + 4);
        }
    },

    drawCurve(ctx, w, h, freqs, response, color, width, dash) {
        const dbMin = this.dbMin;
        const dbMax = this.dbMax;

        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        if (dash) ctx.setLineDash(dash);
        else ctx.setLineDash([]);
        ctx.beginPath();

        let started = false;
        freqs.forEach((f, i) => {
            const x = this.freqToX(f, w, 20, 20000);
            const y = this.dbToY(response[i], h, dbMin, dbMax);
            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        ctx.setLineDash([]);
    },

    freqToX(f, w, fMin, fMax) {
        const t = Math.log(f / fMin) / Math.log(fMax / fMin);
        return 50 + t * (w - 60);
    },

    dbToY(db, h, dbMin, dbMax) {
        const t = (db - dbMin) / (dbMax - dbMin);
        return (h - 30) - t * (h - 40);
    },

    // ========================================================================
    // Reference Curve
    // ========================================================================

    loadReferenceCurve(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            this.parseReferenceCurve(text);
            this.drawCanvas();
            this.showToast('Reference curve loaded', 'success');
        };
        reader.readAsText(file);
    },

    parseReferenceCurve(text) {
        const points = [];
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('//')) continue;
            // Try REW format: "Freq(Hz)   SPL(dB)   ..."
            // or simple CSV: "100, -5.2"
            const parts = trimmed.split(/[\s,;]+/).filter(p => p.length > 0);
            if (parts.length >= 2) {
                const f = parseFloat(parts[0]);
                const db = parseFloat(parts[1]);
                if (!isNaN(f) && !isNaN(db) && f > 0) {
                    points.push({ f, db });
                }
            }
        }
        points.sort((a, b) => a.f - b.f);

        // Detect absolute SPL exports (e.g. REW raw SPL 15-110 dB)
        // and normalize to relative response for EQ design context
        if (points.length > 0) {
            const values = points.map(p => p.db);
            const sorted = [...values].sort((a, b) => a - b);
            const medianVal = sorted[Math.floor(sorted.length / 2)];

            // Heuristic: if median is well above 0 dB, treat as absolute SPL
            // and normalize so median = 0 dB for EQ visualization
            if (medianVal > 20) {
                const offset = medianVal;
                points.forEach(p => p.db -= offset);
                this.showToast(`Normalized absolute SPL (median ${offset.toFixed(1)} dB → 0 dB)`, 'info');
            }
        }

        this.referenceCurve = points;
    },

    interpolateReference(freqs) {
        const result = [];
        const pts = this.referenceCurve;
        if (pts.length === 0) return freqs.map(() => 0);

        freqs.forEach(f => {
            if (f <= pts[0].f) { result.push(pts[0].db); return; }
            if (f >= pts[pts.length - 1].f) { result.push(pts[pts.length - 1].db); return; }
            for (let i = 0; i < pts.length - 1; i++) {
                if (f >= pts[i].f && f <= pts[i + 1].f) {
                    const t = (f - pts[i].f) / (pts[i + 1].f - pts[i].f);
                    result.push(pts[i].db + t * (pts[i + 1].db - pts[i].db));
                    return;
                }
            }
            result.push(pts[pts.length - 1].db);
        });
        return result;
    },

    // ========================================================================
    // Actions
    // ========================================================================

    async sendEqToDevice() {
        if (!this.selectedDevice) {
            this.showToast('Select a panel first', 'warning');
            return;
        }

        this.updateBandFromUI();
        // Save current bands back to active profile before sending
        this.profiles[this.activeProfile].bands = JSON.parse(JSON.stringify(this.bands));
        this.profiles[this.activeProfile].enabled = this.eqEnabled;

        const payload = {
            profile: this.activeProfile,
            eq_enabled: this.eqEnabled,
            bands: this.bands.map(b => ({
                band: b.band,
                enabled: b.enabled,
                type: b.type,
                freq: b.freq,
                q: b.q,
                gain_db: b.gain_db
            }))
        };

        try {
            const btn = document.getElementById('btn-send-eq');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

            const deviceId = this.selectedDevice.id;
            const response = await fetch(`./api/device/${deviceId}/eq`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok && data.success) {
                this.showToast(`EQ sent to ${this.selectedDevice.name} — ${this.activeProfile}`, 'success');
            } else {
                this.showToast(data.error || 'Failed to send EQ', 'error');
            }
        } catch (error) {
            this.showToast(`Network error: ${error.message}`, 'error');
        } finally {
            const btn = document.getElementById('btn-send-eq');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send to Panel';
        }
    },

    async saveEqToConfig() {
        this.updateBandFromUI();
        // Save current bands back to active profile
        this.profiles[this.activeProfile].bands = JSON.parse(JSON.stringify(this.bands));
        this.profiles[this.activeProfile].enabled = this.eqEnabled;

        // Build clean profile payload (strip band index)
        const cleanProfiles = {};
        for (const [name, prof] of Object.entries(this.profiles)) {
            cleanProfiles[name] = {
                enabled: prof.enabled,
                bands: (prof.bands || []).map(b => ({
                    enabled: b.enabled,
                    type: b.type,
                    freq: b.freq,
                    q: b.q,
                    gain_db: b.gain_db
                }))
            };
        }

        const payload = {
            eq_enabled: this.eqEnabled,
            eq_active_profile: this.activeProfile,
            eq_profiles: cleanProfiles
        };

        try {
            const btn = document.getElementById('btn-save-eq');
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

            const response = await fetch('./api/config/eq', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok && data.success) {
                this.showToast(data.message || 'EQ profiles saved to config', 'success');
            } else {
                this.showToast(data.error || 'Failed to save EQ config', 'error');
            }
        } catch (error) {
            this.showToast(`Network error: ${error.message}`, 'error');
        } finally {
            const btn = document.getElementById('btn-save-eq');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Save to Config';
        }
    },

    // ========================================================================
    // Toast Notifications
    // ========================================================================

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => controller.init());
