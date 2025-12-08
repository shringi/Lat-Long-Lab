import { state } from '../core/state.js';
import { updateTable, adjustTableColumns } from './table.js';
import { invalidateMapSize } from './map.js';

console.log("UI MODULE LOADED");

let onViewChanged = null;
const getEl = (id) => document.getElementById(id);

export function setViewChangeCallback(callback) {
    onViewChanged = callback;
}

export function switchTab(tabName) {
    // Auto-expand on tab click if collapsed
    const body = document.body;
    if (body.classList.contains('sidebar-collapsed')) {
        toggleSidebar(true);
    }

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
        if (invalidateMapSize) {
            setTimeout(invalidateMapSize, 100);
        }
    }
}

export function switchViewMode(mode) {
    const mainContent = getEl('mainContent');
    const viewModeControls = getEl('viewModeControls');
    const tableContainer = getEl('tableContainer');

    // Reset classes
    mainContent.classList.remove('view-mode-map', 'view-mode-split', 'view-mode-table', 'view-mode-toggle', 'view-mode-modal');

    // Apply new mode
    mainContent.classList.add(`view-mode-${mode}`);

    // Update active button state
    viewModeControls.querySelectorAll('button').forEach(btn => {
        if (btn.dataset.mode === mode) btn.classList.add('active-mode', 'bg-gray-100', 'font-bold');
        else btn.classList.remove('active-mode', 'bg-gray-100', 'font-bold');
    });

    // Handle visibility logic
    const closeTableBtn = getEl('closeTableBtn');
    if (mode === 'map') {
        tableContainer.classList.add('hidden');
        if (closeTableBtn) closeTableBtn.classList.add('hidden');
    } else {
        tableContainer.classList.remove('hidden');
        // Show close button in split or table mode
        if (closeTableBtn) closeTableBtn.classList.remove('hidden');
    }

    // Trigger map invalidation for resizing
    setTimeout(invalidateMapSize, 100);

    // Fix table header alignment if table is visible
    if (mode === 'split' || mode === 'table') {
        setTimeout(adjustTableColumns, 400); // Wait for transition (300ms) + buffer
    }

    if (onViewChanged) setTimeout(onViewChanged, 300);
}

export function toggleTableVisibility(show) {
    const tableContainer = getEl('tableContainer');
    // We allow switchViewMode('map') to handle closing, so this might be redundant, 
    // but kept for compatibility.
    if (show) {
        tableContainer.classList.remove('hidden');
        setTimeout(adjustTableColumns, 400);
    } else {
        tableContainer.classList.add('hidden');
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

export function makeDraggable(element) {
    if (!element) return;

    let isMouseDown = false;
    let hasMoved = false;
    let startX, startY, initialLeft, initialTop;

    const onMouseDown = (e) => {
        isMouseDown = true;
        hasMoved = false; // Reset flag
        startX = e.clientX;
        startY = e.clientY;
        const rect = element.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        element.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        // e.preventDefault(); // Don't prevent default here, lets click happen if no move
    };

    const onMouseMove = (e) => {
        if (!isMouseDown) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Threshold check to avoid sensitivity (3px)
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            hasMoved = true;
        }

        if (hasMoved) {
            // Use fixed positioning coordinates
            element.style.left = `${initialLeft + dx}px`;
            element.style.top = `${initialTop + dy}px`;
            element.style.bottom = 'auto';
            element.style.right = 'auto';
        }
    };

    const onMouseUp = () => {
        isMouseDown = false;
        element.style.cursor = 'move';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // hasMoved will act as a guard in the click listener below
        // We reset it after a short delay so the immediate click event sees it as true
        setTimeout(() => {
            hasMoved = false;
        }, 50);
    };

    // Capture click event and stop it if we dragged
    element.addEventListener('click', (e) => {
        if (hasMoved) {
            console.log("Drag detected, preventing click.");
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }, { capture: true });

    element.style.cursor = 'move';
    element.addEventListener('mousedown', onMouseDown);
}

// --- Phase 6: Sidebar & View Mode Redesign ---

export function toggleSidebar(show) {
    const body = document.body;
    const btn = document.getElementById('collapseSidebarBtn');

    // If show is undefined, toggle
    if (show === undefined) {
        body.classList.toggle('sidebar-collapsed');
    } else if (show) {
        body.classList.remove('sidebar-collapsed');
    } else {
        body.classList.add('sidebar-collapsed');
    }

    // Update Tooltip
    if (body.classList.contains('sidebar-collapsed')) {
        if (btn) btn.setAttribute('title', 'Expand Sidebar');
    } else {
        if (btn) btn.setAttribute('title', 'Collapse Sidebar');
    }

    // Map needs resize after transition
    setTimeout(invalidateMapSize, 305);
}
