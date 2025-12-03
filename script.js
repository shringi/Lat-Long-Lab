// State Variables
let map;
let drawnItems;
let allPoints = [];
let filteredPoints = [];
let worldGeoJSON = null;
let layerGroup; // To hold the markers
let isFilteringEnabled = true;
let rawData = []; // Store raw data for re-mapping
let table; // Tabulator instance

// DOM Elements
const csvFileInput = document.getElementById('csvFile');
const csvTextInput = document.getElementById('csvInput');
const loadBtn = document.getElementById('loadBtn');
const urlInput = document.getElementById('urlInput');
const urlBtn = document.getElementById('urlBtn');
const pointCountSpan = document.getElementById('pointCount');
const dataStatsDiv = document.getElementById('dataStats');
const selectionSection = document.getElementById('selectionSection');
const selectedCountSpan = document.getElementById('selectedCount');
const enrichBtn = document.getElementById('enrichBtn');
const exportSection = document.getElementById('exportSection');
const exportBtn = document.getElementById('exportBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const filterToggle = document.getElementById('filterToggle');
const filterHelpText = document.getElementById('filterHelpText');
const downloadTableBtn = document.getElementById('downloadTableBtn');

// Tabs
const tabInput = document.getElementById('tabInput');
const tabMap = document.getElementById('tabMap');
const tabTable = document.getElementById('tabTable');
const contentInput = document.getElementById('contentInput');
const contentMap = document.getElementById('contentMap');
const contentTable = document.getElementById('contentTable');

// Column Mapping Modal
const columnMappingModal = document.getElementById('columnMappingModal');
const latColSelect = document.getElementById('latColSelect');
const lngColSelect = document.getElementById('lngColSelect');
const confirmMappingBtn = document.getElementById('confirmMappingBtn');
const cancelMappingBtn = document.getElementById('cancelMappingBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initTable();
    loadWorldData();
    setupEventListeners();
});

function initMap() {
    // Initialize Leaflet Map
    map = L.map('map').setView([20, 0], 2); // World view

    // Basemaps
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    const satellite = L.tileLayer.provider('Esri.WorldImagery');
    const topo = L.tileLayer.provider('OpenTopoMap');
    const dark = L.tileLayer.provider('CartoDB.DarkMatter');

    // Add default
    osm.addTo(map);

    // Layer Control
    const baseMaps = {
        "OpenStreetMap": osm,
        "Satellite (Esri)": satellite,
        "Topographic": topo,
        "Dark Mode": dark
    };

    // Initialize FeatureGroup to store editable layers (the selection box)
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Initialize LayerGroup for points
    layerGroup = L.layerGroup().addTo(map);

    const overlayMaps = {
        "Points": layerGroup,
        "Selection": drawnItems
    };

    L.control.layers(baseMaps, overlayMaps).addTo(map);

    // Initialize Draw Control
    const drawControl = new L.Control.Draw({
        draw: {
            polyline: false,
            polygon: false,
            circle: false,
            circlemarker: false,
            marker: false,
            rectangle: {
                shapeOptions: {
                    color: '#4f46e5', // indigo-600
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

    // Handle Draw Events
    map.on(L.Draw.Event.CREATED, function (e) {
        // Remove existing selection if any (single selection mode)
        drawnItems.clearLayers();

        const layer = e.layer;
        drawnItems.addLayer(layer);

        if (isFilteringEnabled) {
            filterPointsInBounds(layer.getBounds());
        }
    });

    map.on(L.Draw.Event.DELETED, function () {
        if (isFilteringEnabled) {
            filteredPoints = [];
            updateSelectionUI();
        }
    });
}

function initTable() {
    table = new Tabulator("#dataTable", {
        height: "100%",
        layout: "fitColumns",
        pagination: "local",
        paginationSize: 50,
        placeholder: "No Data Loaded",
        columns: [
            { title: "No Data", field: "id" }
        ],
    });
}

async function loadWorldData() {
    // Data is loaded via script tag (world_data.js) to avoid CORS on file://
    if (window.worldGeoJSON) {
        worldGeoJSON = window.worldGeoJSON;
        console.log('World GeoJSON loaded:', worldGeoJSON.features.length, 'features');
    } else {
        console.error('World data not found in window.worldGeoJSON');
        alert('Error: world_data.js not loaded. Please ensure the file exists.');
    }
}

function setupEventListeners() {
    loadBtn.addEventListener('click', handleDataLoad);
    enrichBtn.addEventListener('click', handleEnrichment);
    exportBtn.addEventListener('click', handleExport);
    if (urlBtn) urlBtn.addEventListener('click', handleUrlLoad);
    if (downloadTableBtn) downloadTableBtn.addEventListener('click', () => table.download("csv", "data_table.csv"));

    // Auto-load on file selection
    csvFileInput.addEventListener('change', () => {
        if (csvFileInput.files.length > 0) {
            handleDataLoad();
        }
    });

    // Filter Toggle
    if (filterToggle) {
        filterToggle.addEventListener('change', (e) => {
            isFilteringEnabled = e.target.checked;
            updateFilterState();
        });
    }

    // Tabs
    tabInput.addEventListener('click', () => switchTab('input'));
    tabMap.addEventListener('click', () => switchTab('map'));
    tabTable.addEventListener('click', () => {
        switchTab('table');
        table.redraw(); // Redraw table to fix layout issues
    });

    // Modal
    confirmMappingBtn.addEventListener('click', applyColumnMapping);
    cancelMappingBtn.addEventListener('click', () => {
        columnMappingModal.classList.add('hidden');
    });
}

function switchTab(tabName) {
    // Reset classes
    [tabInput, tabMap, tabTable].forEach(btn => {
        btn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        btn.classList.add('text-gray-500');
    });
    [contentInput, contentMap, contentTable].forEach(content => content.classList.add('hidden'));

    // Activate selected
    if (tabName === 'input') {
        tabInput.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
        tabInput.classList.remove('text-gray-500');
        contentInput.classList.remove('hidden');
    } else if (tabName === 'map') {
        tabMap.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
        tabMap.classList.remove('text-gray-500');
        contentMap.classList.remove('hidden');
    } else if (tabName === 'table') {
        tabTable.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
        tabTable.classList.remove('text-gray-500');
        contentTable.classList.remove('hidden');
    }
}

function updateFilterState() {
    if (isFilteringEnabled) {
        filterHelpText.textContent = "Only points inside the rectangle will be enriched.";
        enrichBtn.textContent = "Enrich Selection (Local)";

        // Re-apply filter based on existing box
        const layers = drawnItems.getLayers();
        if (layers.length > 0 && layers[0] instanceof L.Rectangle) {
            filterPointsInBounds(layers[0].getBounds());
        } else {
            filteredPoints = [];
            updateSelectionUI();
        }
    } else {
        filterHelpText.textContent = "All loaded points will be enriched.";
        enrichBtn.textContent = "Enrich All (Local)";

        // Select all points
        filteredPoints = [...allPoints];
        updateSelectionUI();
    }
}

function handleDataLoad() {
    const file = csvFileInput.files[0];
    const text = csvTextInput.value.trim();

    if (file) {
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            readExcelFile(file);
        } else {
            // Assume CSV/TSV/TXT
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                delimiter: "", // Auto-detect
                complete: (results) => processParsedData(results.data),
                error: (err) => alert('Parse Error: ' + err.message)
            });
        }
    } else if (text) {
        const results = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            delimiter: "" // Auto-detect
        });
        if (results.errors.length > 0) {
            console.warn('CSV Parse Warnings:', results.errors);
        }
        processParsedData(results.data);
    } else {
        alert('Please upload a file or paste data.');
    }
}

function handleUrlLoad() {
    const url = urlInput.value.trim();
    if (!url) {
        alert('Please enter a URL.');
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
                        alert('JSON format not supported. Expected an array of objects.');
                    }
                } catch (e) {
                    alert('Failed to parse JSON.');
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
            alert('Failed to fetch URL. CORS restrictions may apply. Error: ' + error.message);
        });
}

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
        alert('No data found.');
        return;
    }

    rawData = data; // Store raw data

    // Get headers from first row
    const headers = Object.keys(data[0]);

    // Populate dropdowns
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

    // Try to auto-select
    const latCandidates = ['latitude', 'lat', 'Lat', 'LATITUDE'];
    const lngCandidates = ['longitude', 'lng', 'lon', 'long', 'Long', 'LONGITUDE'];

    const foundLat = headers.find(h => latCandidates.includes(h));
    const foundLng = headers.find(h => lngCandidates.includes(h));

    if (foundLat) latColSelect.value = foundLat;
    if (foundLng) lngColSelect.value = foundLng;

    // Show Modal
    columnMappingModal.classList.remove('hidden');
}

function applyColumnMapping() {
    const latCol = latColSelect.value;
    const lngCol = lngColSelect.value;

    if (!latCol || !lngCol) {
        alert('Please select both Latitude and Longitude columns.');
        return;
    }

    // Validate and clean data
    const validPoints = rawData.filter(row => {
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
        alert('No valid data found with selected columns.');
        return;
    }

    allPoints = validPoints;
    pointCountSpan.textContent = allPoints.length;
    dataStatsDiv.classList.remove('hidden');

    // Enable selection section
    selectionSection.classList.remove('opacity-50', 'pointer-events-none');

    columnMappingModal.classList.add('hidden');

    // Update Table
    updateTable(allPoints);

    plotPoints();

    if (!isFilteringEnabled) {
        filteredPoints = [...allPoints];
        updateSelectionUI();
    }
}

function updateTable(data) {
    if (!table) return;

    // Clean data for table (remove internal keys if desired, or keep them)
    // We'll keep them but maybe hide them in columns? 
    // Tabulator auto-columns is easiest for dynamic data
    table.setData(data);
    table.setColumns("auto");
}

function plotPoints() {
    layerGroup.clearLayers();

    allPoints.forEach(point => {
        // Create popup content
        let popupContent = '<div class="text-xs"><table class="table-auto">';
        for (const [key, value] of Object.entries(point)) {
            if (key !== '_lat' && key !== '_lng') {
                popupContent += `<tr><td class="font-bold pr-2">${key}:</td><td>${value}</td></tr>`;
            }
        }
        popupContent += '</table></div>';

        L.circleMarker([point._lat, point._lng], {
            radius: 4,
            fillColor: "#3b82f6", // blue-500
            color: "#fff",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        })
            .bindPopup(popupContent)
            .addTo(layerGroup);
    });

    if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints.map(p => [p._lat, p._lng]));
        map.fitBounds(bounds);
    }
}

function filterPointsInBounds(bounds) {
    if (!isFilteringEnabled) return;

    filteredPoints = allPoints.filter(p => {
        const latLng = L.latLng(p._lat, p._lng);
        return bounds.contains(latLng);
    });

    updateSelectionUI();
}

function updateSelectionUI() {
    selectedCountSpan.textContent = filteredPoints.length;
    enrichBtn.disabled = filteredPoints.length === 0;

    // Update table to show filtered points? 
    // Or should table always show all points? 
    // Let's update table to show filtered points if filtering is active, or maybe just highlight them?
    // For simplicity, let's just show filtered points in the table if filtering is enabled.
    if (isFilteringEnabled && filteredPoints.length > 0) {
        updateTable(filteredPoints);
    } else if (!isFilteringEnabled) {
        updateTable(allPoints);
    }
}

function handleEnrichment() {
    if (!worldGeoJSON) {
        alert('World data not loaded yet. Please wait.');
        return;
    }

    loadingOverlay.classList.remove('hidden');

    // Use setTimeout to allow UI to render the loading state
    setTimeout(() => {
        const enrichedData = filteredPoints.map(point => {
            const pt = turf.point([point._lng, point._lat]); // Turf uses [lng, lat]
            let countryName = "Unknown";

            // Simple linear search - Point in Polygon
            // Optimization: In a real app with huge GeoJSON, use spatial index.
            for (const feature of worldGeoJSON.features) {
                if (turf.booleanPointInPolygon(pt, feature)) {
                    countryName = feature.properties.name || feature.properties.NAME || feature.properties.admin;
                    break;
                }
            }

            return {
                ...point,
                country_name: countryName
            };
        });

        // Update filtered points with enriched data
        filteredPoints = enrichedData;

        // Update table with enriched data
        updateTable(filteredPoints);

        loadingOverlay.classList.add('hidden');
        exportSection.classList.remove('hidden');

        alert(`Enriched ${filteredPoints.length} points!`);
    }, 100);
}

function handleExport() {
    if (filteredPoints.length === 0) return;

    // Clean up internal keys (_lat, _lng)
    const cleanData = filteredPoints.map(({ _lat, _lng, ...rest }) => rest);

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
}
