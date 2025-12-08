import { state } from './core/state.js';
import { initMap, setSelectionCallback, filterPointsInBounds, getDrawnItems, invalidateMapSize } from './modules/map.js';
import { initTable } from './modules/table.js';
import { switchViewMode, setViewChangeCallback, updateSelectionUI, showToast, switchTab, toggleTableVisibility, updateFilterUIState, hideColumnMappingModal, makeDraggable, toggleSidebar } from './modules/ui.js';
import { handleDataLoad, handleUrlLoad, enrichData, addUTM, handleExport, loadSampleData, applyColumnMapping } from './modules/data.js';
import { worldGeoJSON } from './world_data.js';

console.log('MAIN MODULE LOADED');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded FIRED (Module)');
    console.log('App Initializing...');

    try {
        // Initialize Components
        initMap();
        initTable();
        switchViewMode('map');

        // Load World Data
        // Directly imported now
        state.worldGeoJSON = worldGeoJSON;
        console.log('World Data Loaded via Import');

        setupEventListeners();

        // Default View
        switchViewMode('map');

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

    // Data Loading Listeners
    if (csvFileInput) {
        csvFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleDataLoad(e.target.files[0], null);
            }
        });
    }

    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            const text = csvTextInput ? csvTextInput.value : '';
            if (text.trim()) {
                handleDataLoad(null, text);
            } else {
                showToast('Please paste some data first.', 'error');
            }
        });
    }

    if (urlBtn && urlInput) {
        urlBtn.addEventListener('click', () => {
            const url = urlInput.value.trim();
            if (url) {
                handleUrlLoad(url);
            }
        });
    }

    if (enrichBtn) enrichBtn.addEventListener('click', enrichData);
    const enrichUtmBtn = getEl('enrichUtmBtn');
    if (enrichUtmBtn) enrichUtmBtn.addEventListener('click', addUTM);

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
    if (getEl('tabExport')) getEl('tabExport').addEventListener('click', () => switchTab('export'));

    if (viewModeControls) {
        viewModeControls.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => switchViewMode(btn.dataset.mode));
        });
    }

    // Sidebar listeners

    if (showTableBtn) showTableBtn.addEventListener('click', () => toggleTableVisibility(true));
    // Close Table -> Switch to Full Map View
    if (closeTableBtn) closeTableBtn.addEventListener('click', () => switchViewMode('map'));

    if (sampleBtn) {
        sampleBtn.addEventListener('click', () => {
            loadSampleData();
        });
    }

    if (confirmMappingBtn) confirmMappingBtn.addEventListener('click', () => applyColumnMapping(latColSelect.value, lngColSelect.value));
    if (cancelMappingBtn) cancelMappingBtn.addEventListener('click', hideColumnMappingModal);

    const collapseSidebarBtn = getEl('collapseSidebarBtn');
    if (collapseSidebarBtn) collapseSidebarBtn.addEventListener('click', () => toggleSidebar());
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
