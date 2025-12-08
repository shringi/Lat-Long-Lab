
import proj4 from 'proj4';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import * as turf from '@turf/turf';
import { state } from '../core/state.js';
import { showToast, showColumnMappingModal, hideColumnMappingModal, updateSelectionUI, switchViewMode, toggleTableVisibility, switchTab, updateStats } from './ui.js';
import { updateTable } from './table.js';
import { plotPoints } from './map.js';

console.log("DATA MODULE LOADED");

export function handleDataLoad(file, text) {
    console.log('handleDataLoad called');
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
                error: (err) => showToast('Parse Error: ' + err.message, 'error')
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
        showToast('Please upload a file or paste data.', 'error');
    }
}

export function handleUrlLoad(url) {
    if (!url) {
        showToast('Please enter a URL.', 'error');
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
                        showToast('JSON format not supported. Expected an array of objects.', 'error');
                    }
                } catch (e) {
                    showToast('Failed to parse JSON.', 'error');
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
            showToast('Failed to fetch URL. CORS restrictions may apply. Error: ' + error.message, 'error');
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
        showToast('No data found.', 'error');
        return;
    }
    state.rawData = data;
    const headers = Object.keys(data[0]);

    // Phase 1: Smart Column Detection
    const defaults = guessColumns(headers);
    if (defaults.lat && defaults.lng) {
        showToast('Auto-detected coordinate columns!', 'success');
    }

    showColumnMappingModal(headers, defaults);
}

export function applyColumnMapping(latCol, lngCol) {
    if (!latCol || !lngCol) {
        showToast('Please select both Latitude and Longitude columns.', 'error');
        return;
    }
    const validPoints = state.rawData.filter(row => {
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
        showToast('No valid data found with selected columns.', 'error');
        return;
    }

    state.allPoints = validPoints;

    plotPoints();

    updateStats(state.allPoints.length);

    state.isFilteringEnabled = false;
    state.filteredPoints = [...state.allPoints];

    updateSelectionUI();
    hideColumnMappingModal();

    // Auto-show table when data is loaded
    switchViewMode('split');

    showToast(`Loaded ${validPoints.length} points successfully!`, 'success');

    // Auto-switch to process tab to guide user
    setTimeout(() => {
        switchTab('process');
    }, 500);
}

export function enrichData() {
    const worldData = state.worldGeoJSON;

    if (!worldData) {
        showToast('World data not loaded yet. Please wait.', 'error');
        return;
    }

    setTimeout(() => {
        let enrichedCount = 0;
        const enrichedData = state.filteredPoints.map(point => {
            const pt = turf.point([point._lng, point._lat]);
            let countryName = "Unknown";
            for (const feature of worldData.features) {
                if (turf.booleanPointInPolygon(pt, feature)) {
                    countryName = feature.properties.name || feature.properties.NAME || feature.properties.admin;
                    enrichedCount++;
                    break;
                }
            }
            return { ...point, country: countryName };
        });

        state.filteredPoints = enrichedData;

        updateTable(state.filteredPoints);

        showToast(`Country names added to ${enrichedCount} points!`, 'success');
        switchTab('export');
    }, 100);
}

export function handleExport() {
    if (state.filteredPoints.length === 0) return;
    const cleanData = state.filteredPoints.map(p => {
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
    showToast('Download started!', 'success');
}

export function guessColumns(headers) {
    const safeLat = /latitude/i;
    const safeLng = /longitude/i;
    const riskyLat = /(^|[^a-z])(lat|y)($|[^a-z])/i;
    const riskyLng = /(^|[^a-z])(lng|lon|long|x)($|[^a-z])/i;

    let latCol = null;
    let lngCol = null;

    const safeLatMatch = headers.find(h => safeLat.test(h));
    if (safeLatMatch) {
        latCol = safeLatMatch;
    } else {
        latCol = headers.find(h => riskyLat.test(h)) || null;
    }

    const safeLngMatch = headers.find(h => safeLng.test(h));
    if (safeLngMatch) {
        lngCol = safeLngMatch;
    } else {
        lngCol = headers.find(h => riskyLng.test(h)) || null;
    }

    return { lat: latCol, lng: lngCol };
}

export function loadSampleData() {
    const sampleData = [
        { id: 1, name: "New York", lat: 40.7128, lng: -74.0060, category: "City" },
        { id: 2, name: "London", lat: 51.5074, lng: -0.1278, category: "City" },
        { id: 3, name: "Tokyo", lat: 35.6762, lng: 139.6503, category: "City" },
        { id: 4, name: "Sydney", lat: -33.8688, lng: 151.2093, category: "City" },
        { id: 5, name: "Rio de Janeiro", lat: -22.9068, lng: -43.1729, category: "City" },
        { id: 6, name: "Cape Town", lat: -33.9249, lng: 18.4241, category: "City" },
        { id: 7, name: "Mumbai", lat: 19.0760, lng: 72.8777, category: "City" },
        { id: 8, name: "Paris", lat: 48.8566, lng: 2.3522, category: "City" }
    ];
    processParsedData(sampleData);
    showToast("Loaded sample data.", "success");
}

export function addUTM() {
    if (state.filteredPoints.length === 0) {
        showToast('No points to process', 'error');
        return;
    }

    setTimeout(() => {
        let count = 0;
        const enriched = state.filteredPoints.map(p => {
            try {
                // Determine Zone
                const lon = p._lng;
                const lat = p._lat;
                const zoneNumber = Math.floor((lon + 180) / 6) + 1;
                const isNorth = lat >= 0;

                // Construct proj4 string (WGS84 -> UTM)
                // We use auto-zone detection string for proj4
                const utmProj = `+proj=utm +zone=${zoneNumber} ${!isNorth ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`;

                const [easting, northing] = proj4('EPSG:4326', utmProj, [lon, lat]);

                count++;
                return {
                    ...p,
                    utm_zone: `${zoneNumber}${isNorth ? 'N' : 'S'}`,
                    utm_easting: easting.toFixed(2),
                    utm_northing: northing.toFixed(2)
                };
            } catch (e) {
                console.error("UTM Conversion Error", e);
                return p;
            }
        });

        state.filteredPoints = enriched;
        updateTable(state.filteredPoints);
        showToast(`UTM coordinates added to ${count} points!`, 'success');
        switchTab('export');

    }, 50);
}
