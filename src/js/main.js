
import { state } from './core/state.js';
import { initMap, setSelectionCallback, filterPointsInBounds, getDrawnItems, invalidateMapSize } from './modules/map.js';
import { initTable } from './modules/table.js';
import { switchViewMode, setViewChangeCallback, updateSelectionUI, showToast, switchTab, toggleTableVisibility, updateFilterUIState, hideColumnMappingModal, makeDraggable } from './modules/ui.js';
import { handleDataLoad, handleUrlLoad, enrichData, handleExport, loadSampleData, applyColumnMapping } from './modules/data.js';
import { worldGeoJSON } from './world_data.js';

// Import Internal Dependencies that were global
// world_data is imported by being on window from world_data.js (which is a module now but bridges)
// We can also import it if we want, but sticking to existing pattern for now.

console.log('MAIN MODULE LOADED');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded FIRED (Module)');
    console.log('App Initializing...');

    try {
        // Initialize Components
        initMap();
        initTable();
        switchViewMode('toggle');

        // Load World Data
        // Directly imported now
        state.worldGeoJSON = worldGeoJSON;
        console.log('World Data Loaded via Import');

        setupEventListeners();

        // Default View
        switchViewMode('toggle');

        // Callbacks
        setSelectionCallback(updateSelectionUI);
        setViewChangeCallback(invalidateMapSize);

        // Initialize Draggable Debug Button
        makeDraggable(document.getElementById('showDebugBtn'));

        console.log('App Initialization COMPLETE');
    } catch (e) {
        console.error('CRITICAL INITIALIZATION ERROR:', e);
        showToast('Initialization Error: ' + e.message, 'error');
    }
});

function setupEventListeners() {
    const getEl = (id) => document.getElementById(id);

    const csvFileInput = getEl('csvFile');
    const csvTextInput = getEl('csvInput');
    const loadBtn = getEl('loadBtn');
    const urlInput = getEl('urlInput');
    const urlBtn = getEl('urlBtn');
    const enrichBtn = getEl('enrichBtn');
    const exportBtn = getEl('exportBtn');
    const filterToggle = getEl('filterToggle');
    const downloadTableBtn = getEl('downloadTableBtn');
    const tabInput = getEl('tabInput');
    const tabProcess = getEl('tabProcess');
    const tabMap = getEl('tabMap');
    const viewModeControls = getEl('viewModeControls');
    const showTableBtn = getEl('showTableBtn');
    const closeTableBtn = getEl('closeTableBtn');
    const confirmMappingBtn = getEl('confirmMappingBtn');
    const cancelMappingBtn = getEl('cancelMappingBtn');
    const latColSelect = getEl('latColSelect');
    const lngColSelect = getEl('lngColSelect');
    const sampleBtn = getEl('sampleBtn');

    if (loadBtn) loadBtn.addEventListener('click', () => handleDataLoad(csvFileInput.files[0], csvTextInput.value.trim()));
    if (urlBtn) urlBtn.addEventListener('click', () => handleUrlLoad(urlInput.value.trim()));

    if (csvFileInput) {
        csvFileInput.addEventListener('click', () => {
            csvFileInput.value = '';
        });
        csvFileInput.addEventListener('change', () => {
            if (csvFileInput.files.length > 0) {
                handleDataLoad(csvFileInput.files[0], null);
            }
        });
    }

    if (enrichBtn) enrichBtn.addEventListener('click', enrichData);
    if (exportBtn) exportBtn.addEventListener('click', handleExport);
    if (downloadTableBtn) downloadTableBtn.addEventListener('click', handleExport);

    if (filterToggle) {
        filterToggle.addEventListener('change', (e) => {
            state.isFilteringEnabled = e.target.checked;
            updateFilterUIState();

            if (state.isFilteringEnabled) {
                const drawnItems = getDrawnItems();
                if (drawnItems) {
                    const layers = drawnItems.getLayers();
                    if (layers.length > 0 && layers[0] instanceof L.Rectangle) {
                        filterPointsInBounds(layers[0].getBounds());
                    } else {
                        state.filteredPoints = [];
                        updateSelectionUI();
                    }
                }
            } else {
                state.filteredPoints = [...state.allPoints];
                updateSelectionUI();
            }
        });
    }

    if (tabInput) tabInput.addEventListener('click', () => switchTab('input'));
    if (tabProcess) tabProcess.addEventListener('click', () => switchTab('process'));
    if (tabMap) tabMap.addEventListener('click', () => switchTab('map'));

    if (viewModeControls) {
        viewModeControls.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => switchViewMode(btn.dataset.mode));
        });
    }

    if (showTableBtn) showTableBtn.addEventListener('click', () => toggleTableVisibility(true));
    if (closeTableBtn) closeTableBtn.addEventListener('click', () => toggleTableVisibility(false));

    if (sampleBtn) {
        sampleBtn.addEventListener('click', () => {
            loadSampleData();
        });
    }

    if (confirmMappingBtn) confirmMappingBtn.addEventListener('click', () => applyColumnMapping(latColSelect.value, lngColSelect.value));
    if (cancelMappingBtn) cancelMappingBtn.addEventListener('click', hideColumnMappingModal);
}

// Loading Overlay Logic
window.addEventListener('load', () => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        setTimeout(() => {
            overlay.classList.add('opacity-0');
            setTimeout(() => {
                overlay.remove();
            }, 500);
        }, 800);
    }
});
