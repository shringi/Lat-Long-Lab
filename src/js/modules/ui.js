
console.log("UI.JS LOADED");

(() => {
    let onViewChanged = null;
    App.setViewChangeCallback = function (callback) { onViewChanged = callback; };

    const getEl = (id) => document.getElementById(id);

    App.switchTab = function (tabName) {
        const tabInput = getEl('tabInput');
        const tabProcess = getEl('tabProcess');
        const tabMap = getEl('tabMap');
        const contentInput = getEl('contentInput');
        const contentProcess = getEl('contentProcess');
        const contentMap = getEl('contentMap');

        [tabInput, tabProcess, tabMap].forEach(btn => {
            btn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            btn.classList.add('text-gray-500');
        });
        [contentInput, contentProcess, contentMap].forEach(content => content.classList.add('hidden'));

        if (tabName === 'input') {
            tabInput.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            tabInput.classList.remove('text-gray-500');
            contentInput.classList.remove('hidden');
        } else if (tabName === 'process') {
            tabProcess.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            tabProcess.classList.remove('text-gray-500');
            contentProcess.classList.remove('hidden');
        } else if (tabName === 'map') {
            tabMap.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            tabMap.classList.remove('text-gray-500');
            contentMap.classList.remove('hidden');
            setTimeout(App.invalidateMapSize, 100); // Ensure map renders correctly
        }
    };

    App.switchViewMode = function (mode) {
        const mainContent = getEl('mainContent');
        const viewModeControls = getEl('viewModeControls');
        const showTableBtn = getEl('showTableBtn');
        const tableContainer = getEl('tableContainer');

        mainContent.classList.remove('view-mode-toggle', 'view-mode-split', 'view-mode-modal');
        mainContent.classList.add(`view-mode-${mode}`);

        viewModeControls.querySelectorAll('button').forEach(btn => {
            if (btn.dataset.mode === mode) btn.classList.add('active-mode');
            else btn.classList.remove('active-mode');
        });

        if (mode === 'toggle') {
            App.toggleTableVisibility(false);
            showTableBtn.classList.remove('hidden');
        } else {
            tableContainer.classList.remove('hidden');
            showTableBtn.classList.add('hidden');
        }

        if (mode === 'split') {
            setTimeout(App.invalidateMapSize, 300);
        }

        if (onViewChanged) setTimeout(onViewChanged, 300);
    };

    App.toggleTableVisibility = function (show) {
        const tableContainer = getEl('tableContainer');
        const closeTableBtn = getEl('closeTableBtn');
        if (show) {
            tableContainer.classList.remove('hidden');
            closeTableBtn.classList.remove('hidden');
        } else {
            tableContainer.classList.add('hidden');
            closeTableBtn.classList.add('hidden');
        }
        if (onViewChanged) setTimeout(onViewChanged, 300);
    };

    App.updateSelectionUI = function () {
        const selectedCountSpan = getEl('selectedCount');
        const enrichBtn = getEl('enrichBtn');

        selectedCountSpan.textContent = App.state.filteredPoints.length;
        enrichBtn.disabled = App.state.filteredPoints.length === 0;

        if (App.state.isFilteringEnabled) {
            App.updateTable(App.state.filteredPoints);
        } else {
            App.updateTable(App.state.allPoints);
        }
    };

    App.updateFilterUIState = function () {
        const filterHelpText = getEl('filterHelpText');
        const enrichBtn = getEl('enrichBtn');
        const filterToggle = getEl('filterToggle');

        if (App.state.isFilteringEnabled) {
            filterHelpText.textContent = "Only points inside the rectangle will be enriched.";
            enrichBtn.textContent = "Add country column";
        } else {
            filterHelpText.textContent = "All loaded points will be enriched.";
            enrichBtn.textContent = "Add country column";
        }
        if (filterToggle) filterToggle.checked = App.state.isFilteringEnabled;
    };

    App.showColumnMappingModal = function (headers, defaults = {}) {
        const columnMappingModal = getEl('columnMappingModal');
        const latColSelect = getEl('latColSelect');
        const lngColSelect = getEl('lngColSelect');

        latColSelect.innerHTML = '';
        lngColSelect.innerHTML = '';

        headers.forEach(header => {
            const option1 = document.createElement('option');
            option1.value = header;
            option1.textContent = header;
            latColSelect.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = header;
            option2.textContent = header;
            lngColSelect.appendChild(option2);
        });

        // Use defaults if provided, otherwise fallback to basic name matching (legacy)
        if (defaults.lat) latColSelect.value = defaults.lat;
        if (defaults.lng) lngColSelect.value = defaults.lng;

        // Fallback logic if no defaults provided (or if defaults failed to match)
        if (!defaults.lat || !defaults.lng) {
            const latCandidates = ['latitude', 'lat', 'Lat', 'LATITUDE'];
            const lngCandidates = ['longitude', 'lng', 'lon', 'long', 'Long', 'LONGITUDE'];

            const foundLat = headers.find(h => latCandidates.includes(h));
            const foundLng = headers.find(h => lngCandidates.includes(h));

            if (foundLat && !defaults.lat) latColSelect.value = foundLat;
            if (foundLng && !defaults.lng) lngColSelect.value = foundLng;
        }

        columnMappingModal.classList.remove('hidden');
    };

    App.hideColumnMappingModal = function () {
        getEl('columnMappingModal').classList.add('hidden');
    };

    App.updateStats = function (count) {
        getEl('pointCount').textContent = count;
        getEl('dataStats').classList.remove('hidden');
        getEl('selectionSection').classList.remove('opacity-50', 'pointer-events-none');
    };

    App.showToast = function (message, type = 'info') {
        const container = getEl('toast-container');

        // Log to debug console
        if (type === 'error') console.error(message);
        else console.info(message);

        // Auto-open debug console on error
        if (type === 'error') {
            const debugConsole = document.getElementById('debugConsole');
            const showDebugBtn = document.getElementById('showDebugBtn');
            if (debugConsole && debugConsole.classList.contains('hidden')) {
                debugConsole.classList.remove('hidden');
                if (showDebugBtn) showDebugBtn.classList.add('hidden');
            }
        }

        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 3000);
    };
})();
