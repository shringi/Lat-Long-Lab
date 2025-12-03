
// Global Namespace
window.App = window.App || {};

// ==========================================
// Geo-Filter & Enrich - Main Script
// ==========================================
// state.js
// ==========================================
App.state = {
    allPoints: [],
    filteredPoints: [],
    isFilteringEnabled: false, // Default off
    rawData: [],
    worldGeoJSON: null,
};

// ==========================================
// map.js
// ==========================================
(() => {
    let map;
    let drawnItems;
    let layerGroup;
    let onSelectionChanged = null;

    App.setSelectionCallback = function (callback) {
        onSelectionChanged = callback;
    };

    App.initMap = function () {
        map = L.map('map').setView([20, 0], 2);
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        });
        const satellite = L.tileLayer.provider('Esri.WorldImagery');
        const topo = L.tileLayer.provider('OpenTopoMap');
        const dark = L.tileLayer.provider('CartoDB.DarkMatter');

        // Default to Satellite
        satellite.addTo(map);

        const baseMaps = {
            "OpenStreetMap": osm,
            "Satellite (Esri)": satellite,
            "Topographic": topo,
            "Dark Mode": dark
        };

        drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);
        layerGroup = L.layerGroup().addTo(map);

        const overlayMaps = {
            "Points": layerGroup,
            "Selection": drawnItems
        };

        L.control.layers(baseMaps, overlayMaps).addTo(map);

        const drawControl = new L.Control.Draw({
            draw: {
                polyline: false,
                polygon: false,
                circle: false,
                circlemarker: false,
                marker: false,
                rectangle: {
                    shapeOptions: {
                        color: '#4f46e5',
                        weight: 2
                    }
                }
            },
            edit: {
                featureGroup: drawnItems,
                remove: true
            }
        });
        map.addControl(drawControl);

        map.on(L.Draw.Event.CREATED, function (e) {
            drawnItems.clearLayers();
            const layer = e.layer;
            drawnItems.addLayer(layer);
            if (App.state.isFilteringEnabled) {
                App.filterPointsInBounds(layer.getBounds());
            }
        });

        map.on(L.Draw.Event.DELETED, function () {
            if (App.state.isFilteringEnabled) {
                App.state.filteredPoints = [];
                if (onSelectionChanged) onSelectionChanged();
            }
        });

        return map;
    };

    App.plotPoints = function () {
        layerGroup.clearLayers();
        App.state.allPoints.forEach(point => {
            let popupContent = '<div class="text-xs"><table class="table-auto">';
            for (const [key, value] of Object.entries(point)) {
                if (!key.startsWith('_')) {
                    popupContent += `<tr><td class="font-bold pr-2">${key}:</td><td>${value}</td></tr>`;
                }
            }
            popupContent += '</table></div>';

            L.circleMarker([point._lat, point._lng], {
                radius: 4,
                fillColor: "#3b82f6",
                color: "#fff",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            })
                .bindPopup(popupContent)
                .addTo(layerGroup);
        });

        if (App.state.allPoints.length > 0) {
            const bounds = L.latLngBounds(App.state.allPoints.map(p => [p._lat, p._lng]));
            map.fitBounds(bounds);
        }
    };

    App.filterPointsInBounds = function (bounds) {
        if (!App.state.isFilteringEnabled) return;
        App.state.filteredPoints = App.state.allPoints.filter(p => {
            const latLng = L.latLng(p._lat, p._lng);
            return bounds.contains(latLng);
        });
        if (onSelectionChanged) onSelectionChanged();
    };

    App.getDrawnItems = function () {
        return drawnItems;
    };

    App.invalidateMapSize = function () {
        if (map) map.invalidateSize();
    };
})();

// ==========================================
// table.js
// ==========================================
(() => {
    let gridInstance = null;

    App.initTable = function () {
        gridInstance = new gridjs.Grid({
            columns: [{ name: "No Data" }],
            data: [],
            pagination: { limit: 20, summary: true },
            search: true,
            sort: true,
            resizable: true,
            fixedHeader: true,
            height: '100%',
            style: {
                table: { 'font-size': '12px' },
                th: { 'background-color': '#f3f4f6', 'color': '#374151', 'font-weight': '600' }
            },
            className: {
                table: 'w-full',
                td: 'p-2 border-b border-gray-100',
                th: 'p-2 text-left'
            }
        }).render(document.getElementById("dataTable"));
    };

    App.updateTable = function (data) {
        if (!gridInstance) return;
        if (!data || data.length === 0) {
            gridInstance.updateConfig({ columns: ["No Data"], data: [] }).forceRender();
            return;
        }
        const sample = data[0];
        // Ensure we have valid columns. Filter out internal keys and ensure ID is present.
        const columns = Object.keys(sample)
            .filter(k => !k.startsWith('_'))
            .map(k => ({
                name: k || "Untitled",
                id: k
            }));

        if (columns.length === 0) {
            console.warn('App.updateTable: No columns found', sample);
            gridInstance.updateConfig({ columns: ["No Columns"], data: [] }).forceRender();
            return;
        }


        try {
            gridInstance.updateConfig({ columns: columns, data: data }).forceRender();
        } catch (e) {
            console.error('App.updateTable: Grid.js error', e);
        }
    };
})();

// ==========================================
// ui.js
// ==========================================
(() => {
    let onViewChanged = null;
    App.setViewChangeCallback = function (callback) { onViewChanged = callback; };

    // DOM Elements (Scoped to this IIFE, but we need to access them in event listeners)
    // We will query them inside functions or expose them if needed. 
    // Actually, for simplicity, we'll query them on demand or cache them here.

    const getEl = (id) => document.getElementById(id);

    App.switchTab = function (tabName) {
        const tabInput = getEl('tabInput');
        const tabMap = getEl('tabMap');
        const contentInput = getEl('contentInput');
        const contentMap = getEl('contentMap');

        [tabInput, tabMap].forEach(btn => {
            btn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            btn.classList.add('text-gray-500');
        });
        [contentInput, contentMap].forEach(content => content.classList.add('hidden'));

        if (tabName === 'input') {
            tabInput.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            tabInput.classList.remove('text-gray-500');
            contentInput.classList.remove('hidden');
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
            enrichBtn.textContent = "Enrich Selection (Local)";
        } else {
            filterHelpText.textContent = "All loaded points will be enriched.";
            enrichBtn.textContent = "Enrich All (Local)";
        }
        if (filterToggle) filterToggle.checked = App.state.isFilteringEnabled;
    };

    App.showColumnMappingModal = function (headers) {
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

        const latCandidates = ['latitude', 'lat', 'Lat', 'LATITUDE'];
        const lngCandidates = ['longitude', 'lng', 'lon', 'long', 'Long', 'LONGITUDE'];

        const foundLat = headers.find(h => latCandidates.includes(h));
        const foundLng = headers.find(h => lngCandidates.includes(h));

        if (foundLat) latColSelect.value = foundLat;
        if (foundLng) lngColSelect.value = foundLng;

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

// ==========================================
// data.js
// ==========================================
(() => {
    App.handleDataLoad = function (file, text) {
        if (file) {
            const fileName = file.name.toLowerCase();
            if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                readExcelFile(file);
            } else {
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    delimiter: "",
                    complete: (results) => processParsedData(results.data),
                    error: (err) => App.showToast('Parse Error: ' + err.message, 'error')
                });
            }
        } else if (text) {
            const results = Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                delimiter: ""
            });
            processParsedData(results.data);
        } else {
            App.showToast('Please upload a file or paste data.', 'error');
        }
    };

    App.handleUrlLoad = function (url) {
        if (!url) {
            App.showToast('Please enter a URL.', 'error');
            return;
        }
        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.text();
            })
            .then(text => {
                if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
                    try {
                        const json = JSON.parse(text);
                        if (Array.isArray(json)) {
                            processParsedData(json);
                        } else {
                            App.showToast('JSON format not supported. Expected an array of objects.', 'error');
                        }
                    } catch (e) {
                        App.showToast('Failed to parse JSON.', 'error');
                    }
                } else {
                    const results = Papa.parse(text, {
                        header: true,
                        skipEmptyLines: true,
                        delimiter: ""
                    });
                    processParsedData(results.data);
                }
            })
            .catch(error => {
                App.showToast('Failed to fetch URL. CORS restrictions may apply. Error: ' + error.message, 'error');
            });
    };

    function readExcelFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            processParsedData(jsonData);
        };
        reader.readAsArrayBuffer(file);
    }

    function processParsedData(data) {
        if (!data || data.length === 0) {
            App.showToast('No data found.', 'error');
            return;
        }
        App.state.rawData = data;
        const headers = Object.keys(data[0]);
        App.showColumnMappingModal(headers);
    }

    App.applyColumnMapping = function (latCol, lngCol) {
        if (!latCol || !lngCol) {
            App.showToast('Please select both Latitude and Longitude columns.', 'error');
            return;
        }
        const validPoints = App.state.rawData.filter(row => {
            const lat = parseFloat(row[latCol]);
            const lng = parseFloat(row[lngCol]);
            return !isNaN(lat) && !isNaN(lng);
        }).map(row => {
            return {
                ...row,
                _lat: parseFloat(row[latCol]),
                _lng: parseFloat(row[lngCol])
            };
        });

        if (validPoints.length === 0) {
            App.showToast('No valid data found with selected columns.', 'error');
            return;
        }

        App.state.allPoints = validPoints;
        App.updateStats(App.state.allPoints.length);
        App.plotPoints();
        App.state.isFilteringEnabled = false;
        App.state.filteredPoints = [...App.state.allPoints];
        App.updateSelectionUI();
        App.hideColumnMappingModal();
        // Auto-show table when data is loaded
        App.switchViewMode('toggle');
        App.toggleTableVisibility(true);
        App.showToast(`Loaded ${validPoints.length} points successfully!`, 'success');
    };

    App.enrichData = function () {
        if (!App.state.worldGeoJSON) {
            App.showToast('World data not loaded yet. Please wait.', 'error');
            return;
        }

        App.showToast('Enriching data...', 'info');

        setTimeout(() => {
            let enrichedCount = 0;
            const enrichedData = App.state.filteredPoints.map(point => {
                const pt = turf.point([point._lng, point._lat]);
                let countryName = "Unknown";
                for (const feature of App.state.worldGeoJSON.features) {
                    if (turf.booleanPointInPolygon(pt, feature)) {
                        countryName = feature.properties.name || feature.properties.NAME || feature.properties.admin;
                        enrichedCount++;
                        break;
                    }
                }
                return { ...point, country: countryName }; // Changed key to 'country' for clarity
            });

            App.state.filteredPoints = enrichedData;

            // Force table update with new columns
            // We need to ensure the new 'country' key is picked up by App.updateTable

            App.updateTable(App.state.filteredPoints);

            App.showToast(`Country names added to ${enrichedCount} points!`, 'success');
            document.getElementById('exportSection').classList.remove('hidden');
            document.getElementById('loadingOverlay').classList.add('hidden');
        }, 100);
    };

    App.handleExport = function () {
        if (App.state.filteredPoints.length === 0) return;
        const cleanData = App.state.filteredPoints.map(p => {
            const newObj = {};
            for (const key in p) {
                if (!key.startsWith('_')) newObj[key] = p[key];
            }
            return newObj;
        });
        const csv = Papa.unparse(cleanData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "enriched_data.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        App.showToast('Download started!', 'success');
    };
})();

// ==========================================
// main.js
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('App Initializing...');

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
    tabMap.addEventListener('click', () => App.switchTab('map'));

    viewModeControls.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => App.switchViewMode(btn.dataset.mode));
    });

    showTableBtn.addEventListener('click', () => App.toggleTableVisibility(true));
    closeTableBtn.addEventListener('click', () => App.toggleTableVisibility(false));

    confirmMappingBtn.addEventListener('click', () => App.applyColumnMapping(latColSelect.value, lngColSelect.value));
    cancelMappingBtn.addEventListener('click', App.hideColumnMappingModal);
}
