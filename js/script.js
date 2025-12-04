
console.log("SCRIPT.JS STARTING EXECUTION");

// Global Namespace
window.App = window.App || {};

// ==========================================
// debug.js
// ==========================================
(() => {
    const MAX_LOGS = 1000;
    const logs = [];

    // UI Elements
    let consoleEl, outputEl, showBtn;

    function initDebugUI() {
        consoleEl = document.getElementById('debugConsole');
        outputEl = document.getElementById('debugOutput');
        showBtn = document.getElementById('showDebugBtn');

        if (!consoleEl) return;

        document.getElementById('closeDebugBtn').addEventListener('click', () => toggleConsole(false));
        document.getElementById('showDebugBtn').addEventListener('click', () => toggleConsole(true));
        document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);
        document.getElementById('copyLogsBtn').addEventListener('click', copyLogs);

        // Initial render of any logs captured before UI init
        renderLogs();
    }

    function toggleConsole(show) {
        if (show) {
            consoleEl.classList.remove('hidden');
            showBtn.classList.add('hidden');
            scrollToBottom();
        } else {
            consoleEl.classList.add('hidden');
            showBtn.classList.remove('hidden');
        }
    }

    function addLog(type, args) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return '[Object]';
                }
            }
            return String(arg);
        }).join(' ');

        logs.push({ timestamp, type, message });
        if (logs.length > MAX_LOGS) logs.shift();

        if (outputEl) {
            const row = document.createElement('div');
            row.className = `font-mono text-xs border-b border-gray-800 pb-0.5 mb-0.5 ${getColorForType(type)}`;
            row.innerHTML = `<span class="opacity-50 mr-2">[${timestamp}]</span><span>${escapeHtml(message)}</span>`;
            outputEl.appendChild(row);
            scrollToBottom();
        }
    }

    function renderLogs() {
        if (!outputEl) return;
        outputEl.innerHTML = '';
        logs.forEach(l => {
            const row = document.createElement('div');
            row.className = `font-mono text-xs border-b border-gray-800 pb-0.5 mb-0.5 ${getColorForType(l.type)}`;
            row.innerHTML = `<span class="opacity-50 mr-2">[${l.timestamp}]</span><span>${escapeHtml(l.message)}</span>`;
            outputEl.appendChild(row);
        });
        scrollToBottom();
    }

    function getColorForType(type) {
        switch (type) {
            case 'error': return 'text-red-400';
            case 'warn': return 'text-yellow-400';
            case 'info': return 'text-blue-400';
            default: return 'text-green-400';
        }
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function scrollToBottom() {
        if (outputEl) outputEl.scrollTop = outputEl.scrollHeight;
    }

    function clearLogs() {
        logs.length = 0;
        if (outputEl) outputEl.innerHTML = '';
    }

    function copyLogs() {
        const text = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            alert('Logs copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy logs:', err);
        });
    }

    // Override Console
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    console.log = function (...args) {
        originalLog.apply(console, args);
        addLog('log', args);
    };

    console.warn = function (...args) {
        originalWarn.apply(console, args);
        addLog('warn', args);
    };

    console.error = function (...args) {
        originalError.apply(console, args);
        addLog('error', args);
    };

    console.info = function (...args) {
        originalInfo.apply(console, args);
        addLog('info', args);
    };

    // Initialize UI on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDebugUI);
    } else {
        initDebugUI();
    }
})();

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
        console.log('App.initMap starting...');
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

        console.log('App.initMap completed.');
        return map;
    };

    App.plotPoints = function (dataOverride) {
        const pointsToPlot = dataOverride || (App.state.isFilteringEnabled ? App.state.filteredPoints : App.state.allPoints);
        console.log('App.plotPoints called. Points to plot:', pointsToPlot ? pointsToPlot.length : 'undefined');

        layerGroup.clearLayers();

        if (!pointsToPlot || !Array.isArray(pointsToPlot)) {
            console.error('App.plotPoints: Invalid data provided', pointsToPlot);
            return;
        }

        pointsToPlot.forEach(point => {
            // Ensure we have coordinates
            if (point._lat === undefined || point._lng === undefined) {
                // console.warn('Point missing coordinates:', point); // Reduce noise
                return;
            }

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

        if (pointsToPlot.length > 0) {
            const bounds = L.latLngBounds(pointsToPlot.map(p => [p._lat, p._lng]));
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
    let dataTable = null;

    App.initTable = function () {
        console.log('App.initTable starting...');
        // Initial empty table
        const table = $('#dataTable');
        table.empty();

        dataTable = table.DataTable({
            data: [],
            columns: [{ title: "No Data" }],
            dom: 'Bfrtip',
            buttons: ['colvis'],
            responsive: true,
            language: {
                emptyTable: "No data available in table",
                zeroRecords: "No matching records found"
            }
        });
        console.log('App.initTable completed.');
    };

    App.updateTable = function (data) {
        console.log('App.updateTable called with data:', data ? data.length : 0);
        if (!dataTable) return;

        if (!data || data.length === 0) {
            dataTable.clear().draw();
            return;
        }

        const sample = data[0];

        // Generate columns from sample data
        const columns = Object.keys(sample).map(k => {
            if (k.startsWith('_')) {
                return {
                    title: k,
                    data: k,
                    visible: false,
                    searchable: false
                };
            }
            return {
                title: k,
                data: k,
                defaultContent: "<em>(empty)</em>",
                render: function (data, type, row) {
                    return (data === null || data === undefined) ? "" : data;
                }
            };
        });

        if (!sample.hasOwnProperty('_lat') || !sample.hasOwnProperty('_lng')) {
            console.error('CRITICAL: Data passed to updateTable is missing _lat or _lng!', sample);
            App.showToast('Data missing coordinates. Check console.', 'error');
        }

        if (columns.length === 0) {
            console.warn('App.updateTable: No columns found');
            return;
        }

        // Destroy and re-init
        if (dataTable) {
            dataTable.destroy();
            $('#dataTable').empty();
        }

        const table = $('#dataTable');

        // Initialize DataTable with ColumnControl
        dataTable = table.DataTable({
            data: data,
            columns: columns,
            paging: true,
            searching: true,
            ordering: true,
            fixedHeader: true,
            responsive: true,
            info: true,
            scrollY: '50vh',
            scrollCollapse: true,
            scrollX: true,
            scroller: false,
            columnControl: ['order', ['search', 'searchList']],
            ordering: {
                indicators: false,
                handler: false
            },
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
            autoWidth: false
        });

        // Re-attach listener
        dataTable.on('draw', function () {
            if (!App.state.isFilteringEnabled) {
                const filteredData = dataTable.rows({ search: 'applied' }).data().toArray();
                console.log('DataTable Draw - Filtered Data Count:', filteredData.length);

                App.state.filteredPoints = filteredData;
                App.plotPoints(filteredData);
            }
        });

        // Trigger initial plot
        if (!App.state.isFilteringEnabled) {
            const filteredData = dataTable.rows({ search: 'applied' }).data().toArray();
            console.log('Initial Table Load - Data Count:', filteredData.length);
            App.state.filteredPoints = filteredData;
            App.plotPoints(filteredData);
        }
    };
})();

// ==========================================
// ui.js
// ==========================================
(() => {
    let onViewChanged = null;
    App.setViewChangeCallback = function (callback) { onViewChanged = callback; };

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

// ==========================================
// data.js
// ==========================================
(() => {
    App.handleDataLoad = function (file, text) {
        console.log('App.handleDataLoad called');
        if (file) {
            const fileName = file.name.toLowerCase();
            if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                readExcelFile(file);
            } else {
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    delimiter: "",
                    complete: (results) => {
                        console.log('Papa Parse Complete. Rows:', results.data.length);
                        processParsedData(results.data);
                    },
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
