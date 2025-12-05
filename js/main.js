
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded FIRED');
    console.log('App Initializing...');

    try {
        // Initialize Components
        App.initMap();
        App.initTable();
        App.switchViewMode('toggle');

        // Load World Data
        if (window.worldGeoJSON) {
            App.state.worldGeoJSON = window.worldGeoJSON;
        } else {
            console.warn('World data not found in window.worldGeoJSON');
        }

        setupEventListeners();

        // Default View
        App.switchViewMode('toggle');

        // Callbacks
        App.setSelectionCallback(App.updateSelectionUI);
        App.setViewChangeCallback(App.invalidateMapSize);

        console.log('App Initialization COMPLETE');
    } catch (e) {
        console.error('CRITICAL INITIALIZATION ERROR:', e);
        App.showToast('Initialization Error: ' + e.message, 'error');
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

    loadBtn.addEventListener('click', () => App.handleDataLoad(csvFileInput.files[0], csvTextInput.value.trim()));
    if (urlBtn) urlBtn.addEventListener('click', () => App.handleUrlLoad(urlInput.value.trim()));

    // Reset value on click to ensure change event fires even if same file is selected
    csvFileInput.addEventListener('click', () => {
        csvFileInput.value = '';
    });

    csvFileInput.addEventListener('change', () => {
        if (csvFileInput.files.length > 0) {
            App.handleDataLoad(csvFileInput.files[0], null);
        }
    });

    enrichBtn.addEventListener('click', App.enrichData);
    exportBtn.addEventListener('click', App.handleExport);
    if (downloadTableBtn) downloadTableBtn.addEventListener('click', App.handleExport);

    if (filterToggle) {
        filterToggle.addEventListener('change', (e) => {
            App.state.isFilteringEnabled = e.target.checked;
            App.updateFilterUIState();

            if (App.state.isFilteringEnabled) {
                const layers = App.getDrawnItems().getLayers();
                if (layers.length > 0 && layers[0] instanceof L.Rectangle) {
                    App.filterPointsInBounds(layers[0].getBounds());
                } else {
                    App.state.filteredPoints = [];
                    App.updateSelectionUI();
                }
            } else {
                App.state.filteredPoints = [...App.state.allPoints];
                App.updateSelectionUI();
            }
        });
    }

    tabInput.addEventListener('click', () => App.switchTab('input'));
    tabProcess.addEventListener('click', () => App.switchTab('process'));
    tabMap.addEventListener('click', () => App.switchTab('map'));

    viewModeControls.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => App.switchViewMode(btn.dataset.mode));
    });

    showTableBtn.addEventListener('click', () => App.toggleTableVisibility(true));
    closeTableBtn.addEventListener('click', () => App.toggleTableVisibility(false));

    const sampleBtn = document.getElementById('sampleBtn');
    if (sampleBtn) {
        sampleBtn.addEventListener('click', () => {
            App.loadSampleData();
        });
    }

    confirmMappingBtn.addEventListener('click', () => App.applyColumnMapping(latColSelect.value, lngColSelect.value));
    cancelMappingBtn.addEventListener('click', App.hideColumnMappingModal);
}

// ==========================================
// Loading Overlay
// ==========================================
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
