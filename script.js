// State Variables
let map;
let drawnItems;
let allPoints = [];
let filteredPoints = [];
let worldGeoJSON = null;
let layerGroup; // To hold the markers
let isFilteringEnabled = true;

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadWorldData();
    setupEventListeners();
});

function initMap() {
    // Initialize Leaflet Map
    map = L.map('map').setView([20, 0], 2); // World view

    // Add OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Initialize FeatureGroup to store editable layers (the selection box)
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Initialize LayerGroup for points
    layerGroup = L.layerGroup().addTo(map);

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

    // Note: This will fail if the server doesn't support CORS
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.text();
        })
        .then(text => {
            // Check if it looks like JSON
            if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
                try {
                    const json = JSON.parse(text);
                    // If array, use directly. If object, look for data property? 
                    // For now assume array of objects
                    if (Array.isArray(json)) {
                        processParsedData(json);
                    } else {
                        alert('JSON format not supported. Expected an array of objects.');
                    }
                } catch (e) {
                    alert('Failed to parse JSON.');
                }
            } else {
                // Assume CSV
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

        // Use first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        processParsedData(jsonData);
    };
    reader.readAsArrayBuffer(file);
}

function processParsedData(data) {
    // Validate and clean data
    const validPoints = data.filter(row => {
        const lat = parseFloat(row.latitude || row.lat || row.Lat || row.Latitude);
        const lng = parseFloat(row.longitude || row.lng || row.lon || row.Long || row.Longitude);
        return !isNaN(lat) && !isNaN(lng);
    }).map(row => {
        // Normalize lat/lng keys for internal use, keep original data
        const lat = parseFloat(row.latitude || row.lat || row.Lat || row.Latitude);
        const lng = parseFloat(row.longitude || row.lng || row.lon || row.Long || row.Longitude);
        return {
            ...row,
            _lat: lat,
            _lng: lng
        };
    });

    if (validPoints.length === 0) {
        alert('No valid data found. Ensure data has "latitude" and "longitude" columns.');
        return;
    }

    allPoints = validPoints;
    pointCountSpan.textContent = allPoints.length;
    dataStatsDiv.classList.remove('hidden');

    // Enable selection section
    selectionSection.classList.remove('opacity-50', 'pointer-events-none');

    plotPoints();

    // If filtering is disabled initially (unlikely default, but possible), update state
    if (!isFilteringEnabled) {
        filteredPoints = [...allPoints];
        updateSelectionUI();
    }
}

function plotPoints() {
    layerGroup.clearLayers();

    // Performance optimization: Don't plot if too many? 
    // For now, just plot them as simple circle markers
    allPoints.forEach(point => {
        L.circleMarker([point._lat, point._lng], {
            radius: 4,
            fillColor: "#3b82f6", // blue-500
            color: "#fff",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(layerGroup);
    });

    // Fit bounds
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

        // Update filtered points with enriched data (removing internal keys if desired, or keeping them)
        // We'll keep them for now but clean up on export
        filteredPoints = enrichedData;

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
