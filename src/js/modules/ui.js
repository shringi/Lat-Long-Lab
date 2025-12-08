
import { state } from '../core/state.js';
import { updateTable } from './table.js';

console.log("UI MODULE LOADED");

let onViewChanged = null;
const getEl = (id) => document.getElementById(id);

export function setViewChangeCallback(callback) {
    onViewChanged = callback;
}

export function switchTab(tabName) {
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
        // We need to access invalidateMapSize. 
        // Ideally we import it, but to avoid circular deps if map imports UI later (less likely but possible),
        // we can check if it's imported or on global (Strangler).
        // Best practice: Import it from map.js since map doesn't depend on UI.
        // I will add import at top later, but for now rely on global or add TODO.
        // ACTUALLY, I will import it now.
        if (window.App && window.App.invalidateMapSize) {
            setTimeout(window.App.invalidateMapSize, 100);
        }
    }
}

export function switchViewMode(mode) {
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
        toggleTableVisibility(false);
        showTableBtn.classList.remove('hidden');
    } else {
        tableContainer.classList.remove('hidden');
        showTableBtn.classList.add('hidden');
    }

    if (mode === 'split') {
        if (window.App && window.App.invalidateMapSize) {
            setTimeout(window.App.invalidateMapSize, 300);
        }
    }

    if (onViewChanged) setTimeout(onViewChanged, 300);
}

export function toggleTableVisibility(show) {
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
}

export function updateSelectionUI() {
    const selectedCountSpan = getEl('selectedCount');
    const enrichBtn = getEl('enrichBtn');

    const section = getEl('selectionSection');

    selectedCountSpan.textContent = state.filteredPoints.length;
    enrichBtn.disabled = state.filteredPoints.length === 0;

    if (state.allPoints.length > 0) {
        section.classList.remove('opacity-50', 'pointer-events-none');
    } else {
        section.classList.add('opacity-50', 'pointer-events-none');
    }

    if (state.isFilteringEnabled) {
        updateTable(state.filteredPoints);
    } else {
        updateTable(state.allPoints);
    }
}

export function updateFilterUIState() {
    const filterHelpText = getEl('filterHelpText');
    const enrichBtn = getEl('enrichBtn');
    const filterToggle = getEl('filterToggle');

    if (state.isFilteringEnabled) {
        filterHelpText.textContent = "Only points inside the rectangle will be enriched.";
        enrichBtn.textContent = "Add country column";
    } else {
        filterHelpText.textContent = "All loaded points will be enriched.";
        enrichBtn.textContent = "Add country column";
    }
    if (filterToggle) filterToggle.checked = state.isFilteringEnabled;
}

export function showColumnMappingModal(headers, defaults = {}) {
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
}

export function hideColumnMappingModal() {
    getEl('columnMappingModal').classList.add('hidden');
}

export function updateStats(count) {
    getEl('pointCount').textContent = count;
    getEl('dataStats').classList.remove('hidden');
    getEl('selectionSection').classList.remove('opacity-50', 'pointer-events-none');
}

export function showToast(message, type = 'info') {
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
}


