import { state } from "../core/state.js";
import { openImportWizard, preprocessText } from "./import_wizard.js";
import {
    showToast,
    showColumnMappingModal,
    hideColumnMappingModal,
    updateSelectionUI,
    switchViewMode,
    toggleTableVisibility,
    switchTab,
    updateStats,
} from "./ui.js";
import { updateTable } from "./table.js";
import { plotPoints } from "./map.js";
import {
    generateGeoJSON,
    generateKML,
    generateKMZ,
    generateShapefile,
    downloadBlob,
} from "./export_utils.js";
// worldGeoJSON removed (dynamic import)

console.log("DATA MODULE LOADED");

export function handleDataLoad(file, text) {
    if (file) {
        const name = file.name.toLowerCase();
        if (name.endsWith(".geojson") || name.endsWith(".json")) {
            readGeoJsonFile(file);
        } else if (name.endsWith(".kml")) {
            readKmlFile(file);
        } else if (name.endsWith(".kmz")) {
            readKmzFile(file);
        } else {
            // Text or Excel -> Wizard
            openImportWizard(file, null, (options) => {
                finishImport(file, null, options);
            });
        }
    } else if (text) {
        // Try detecting JSON/GeoJSON
        try {
            const json = JSON.parse(text);
            if (json.type === "FeatureCollection" || json.type === "Feature") {
                processGeoJsonData(json);
                return;
            }
        } catch (e) {
            // Not JSON
        }

        // Treat as CSV/Text
        openImportWizard(null, text, (options) => {
            finishImport(null, text, options);
        });
    } else {
        showToast("Please upload a file or paste data.", "error");
    }
}

/**
 * Parses a coordinate string, handling European decimal commas and quoted values.
 * Examples: "48.12" -> 48.12, '"48.12"' -> 48.12, "48,12" -> 48.12,
 *           "1.234,56" -> 1234.56, "1,234.56" -> 1234.56, "48°" -> 48
 */
export function parseCoordinate(val) {
    if (typeof val === 'number') return val;
    if (typeof val !== 'string') return NaN;

    let cleanVal = val.trim();
    if (!cleanVal) return NaN;

    // Strip surrounding literal quote characters some CSV tools leave in
    if ((cleanVal.startsWith('"') && cleanVal.endsWith('"')) ||
        (cleanVal.startsWith("'") && cleanVal.endsWith("'"))) {
        cleanVal = cleanVal.slice(1, -1).trim();
    }

    // Strip degree signs and other non-numeric symbols, preserve - + . ,
    cleanVal = cleanVal.replace(/[°\s]/g, '');
    if (!cleanVal) return NaN;

    const lastComma = cleanVal.lastIndexOf(',');
    const lastPeriod = cleanVal.lastIndexOf('.');

    if (lastComma > -1 && lastPeriod > -1) {
        if (lastComma > lastPeriod) {
            // European: period is thousands separator, comma is decimal
            cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
        } else {
            // US: comma is thousands separator, period is decimal
            cleanVal = cleanVal.replace(/,/g, '');
        }
    } else if (lastComma > -1 && lastPeriod === -1) {
        // Only comma present — treat as decimal separator
        cleanVal = cleanVal.replace(',', '.');
    }

    return parseFloat(cleanVal);
}

// --- GIS Readers ---

function readGeoJsonFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            processGeoJsonData(json);
        } catch (err) {
            showToast("Invalid GeoJSON: " + err.message, "error");
        }
    };
    reader.readAsText(file);
}

function readKmlFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        parseKmlText(e.target.result);
    };
    reader.readAsText(file);
}

async function readKmzFile(file) {
    try {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        // Find first .kml file
        const kmlFile = Object.keys(zip.files).find((n) =>
            n.toLowerCase().endsWith(".kml"),
        );
        if (kmlFile) {
            const kmlText = await zip.file(kmlFile).async("string");
            parseKmlText(kmlText);
        } else {
            showToast("Invalid KMZ: No KML file found inside.", "error");
        }
    } catch (err) {
        showToast("Error reading KMZ: " + err.message, "error");
    }
}

function processGeoJsonData(json) {
    const features =
        json.type === "FeatureCollection"
            ? json.features
            : json.type === "Feature"
                ? [json]
                : [];
    const validPoints = [];
    const rawPreview = [];
    let rejectedCount = 0;
    let flattenedCount = 0;

    features.forEach((f, index) => {
        const type = f.geometry ? f.geometry.type : "Unknown";
        const props = f.properties || {};

        // Add to raw preview
        rawPreview.push({
            _id: index + 1,
            _geometry_type: type,
            ...props,
        });

        if (!f.geometry) {
            rejectedCount++;
            return;
        }

        if (type === "Point") {
            const [lng, lat] = f.geometry.coordinates;
            validPoints.push({
                ...props,
                _lat: lat,
                _lng: lng,
                latitude: lat,
                longitude: lng,
            });
        } else if (type === "MultiPoint") {
            // Flatten MultiPoint
            const coordsArray = f.geometry.coordinates;
            coordsArray.forEach((coords, idx) => {
                const [lng, lat] = coords;
                validPoints.push({
                    ...props,
                    _lat: lat,
                    _lng: lng,
                    latitude: lat,
                    longitude: lng,
                    _multipoint_index: idx + 1,
                });
                flattenedCount++;
            });
        } else {
            // LineString, Polygon, etc.
            rejectedCount++;
        }
    });

    // Prepare GIS Data Object for Wizard
    const gisData = {
        validPoints: validPoints,
        rawPreview: rawPreview,
        validCount: validPoints.length,
        rejectedCount: rejectedCount,
        flattenedCount: flattenedCount,
        type: "GeoJSON",
    };

    // Open Wizard
    openImportWizard(
        null,
        null,
        (confirmed) => {
            if (confirmed) {
                finalizeGisImport(validPoints, "GeoJSON");
            }
        },
        gisData,
    );
}

function parseKmlText(kmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, "text/xml");
    const placemarks = xmlDoc.getElementsByTagName("Placemark");
    const validPoints = [];
    const rawPreview = [];
    let rejectedCount = 0;

    for (let i = 0; i < placemarks.length; i++) {
        const pm = placemarks[i];

        const name = pm.getElementsByTagName("name")[0]?.textContent || "";
        const desc = pm.getElementsByTagName("description")[0]?.textContent || "";

        // Determine type simplisticly
        let type = "Unknown";
        if (pm.getElementsByTagName("Point").length > 0) type = "Point";
        else if (pm.getElementsByTagName("LineString").length > 0)
            type = "LineString";
        else if (pm.getElementsByTagName("Polygon").length > 0) type = "Polygon";
        else if (pm.getElementsByTagName("MultiGeometry").length > 0)
            type = "MultiGeometry";

        rawPreview.push({
            _id: i + 1,
            _geometry_type: type,
            name: name,
            description: desc,
        });

        const points = pm.getElementsByTagName("Point");

        if (points.length > 0) {
            for (let j = 0; j < points.length; j++) {
                const pointNode = points[j];
                const coordNode = pointNode.getElementsByTagName("coordinates")[0];
                if (coordNode) {
                    const txt = coordNode.textContent.trim();
                    const tuples = txt.split(/\s+/);

                    tuples.forEach((tuple) => {
                        const coords = tuple.split(",");
                        if (coords.length >= 2) {
                            const lng = parseFloat(coords[0]);
                            const lat = parseFloat(coords[1]);
                            validPoints.push({
                                name: name,
                                description: desc,
                                _lat: lat,
                                _lng: lng,
                                latitude: lat,
                                longitude: lng,
                            });
                        }
                    });
                }
            }
        } else {
            rejectedCount++;
        }
    }

    const gisData = {
        validPoints: validPoints,
        rawPreview: rawPreview,
        validCount: validPoints.length,
        rejectedCount: rejectedCount,
        flattenedCount: 0,
        type: "KML/KMZ",
    };

    openImportWizard(
        null,
        null,
        (confirmed) => {
            if (confirmed) {
                finalizeGisImport(validPoints, "KML/KMZ");
            }
        },
        gisData,
    );
}

function finalizeGisImport(points, type) {
    if (points.length === 0) {
        showToast(`No valid points imported from ${type}.`, "warning");
        return;
    }

    state.allPoints = points;
    state.rawData = points;
    plotPoints();
    updateStats(state.allPoints.length);
    state.isFilteringEnabled = false;
    state.filteredPoints = [...state.allPoints];
    updateSelectionUI();
    switchViewMode("split");
    setTimeout(() => switchTab("process"), 500);
    showToast(
        `Imported ${points.length} points from ${type} successfully!`,
        "success",
    );
}

export function handleUrlLoad(url) {
    if (!url) {
        showToast("Please enter a URL.", "error");
        return;
    }

    fetch(url)
        .then((response) => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.text();
        })
        .then((text) => {
            if (text.trim().startsWith("[") || text.trim().startsWith("{")) {
                try {
                    const json = JSON.parse(text);
                    if (Array.isArray(json)) {
                        processParsedData(json);
                    } else {
                        showToast(
                            "JSON format not supported. Expected an array of objects.",
                            "error",
                        );
                    }
                } catch (e) {
                    showToast("JSON Parse Error", "error");
                }
            } else {
                openImportWizard(null, text, (options) => {
                    finishImport(null, text, options);
                });
            }
        })
        .catch((error) => {
            showToast(
                "Failed to fetch URL. CORS restrictions may apply. Error: " +
                error.message,
                "error",
            );
        });
}

async function finishImport(file, text, options) {
    console.log("Finishing Import with options:", options);

    if (file) {
        const fileName = file.name.toLowerCase();

        // Explicitly load libraries only when needed
        if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
            const XLSX = await import("xlsx");
            readExcelFile(file, options.sheetName, XLSX, (data) =>
                postParse(data, options),
                options.hasHeaders
            );
        } else {
            const Papa = (await import("papaparse")).default;
            
            const performPreprocessing = options.delimiter === "whitespace" || (options.mergeSpaces && options.delimiter);

            if (performPreprocessing) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const delimToPreprocess = options.delimiter === "whitespace" ? "whitespace" : options.delimiter;
                    const preprocessed = preprocessText(e.target.result, delimToPreprocess);
                    
                    const actualDelim = options.delimiter === "whitespace" ? " " : options.delimiter;

                    Papa.parse(preprocessed, {
                        header: options.hasHeaders,
                        skipEmptyLines: true,
                        delimiter: actualDelim,
                        complete: (results) => {
                            let parsedData = results.data;
                            if (!options.hasHeaders) parsedData = applySyntheticHeaders(parsedData);
                            postParse(parsedData, options);
                        },
                        error: (err) => showToast("Parse Error: " + err.message, "error"),
                    });
                };
                reader.readAsText(file, options.encoding);
            } else {
                Papa.parse(file, {
                    header: options.hasHeaders,
                    skipEmptyLines: true,
                    delimiter: options.delimiter || "",
                    delimitersToGuess: [',', '\t', '|', ';', ' '],
                    encoding: options.encoding,
                    complete: (results) => {
                        let parsedData = results.data;
                        if (!options.hasHeaders) parsedData = applySyntheticHeaders(parsedData);
                        postParse(parsedData, options);
                    },
                    error: (err) => showToast("Parse Error: " + err.message, "error"),
                });
            }
        }
    } else if (text) {
        const Papa = (await import("papaparse")).default;
        
        let processText = text;
        const performPreprocessing = options.delimiter === "whitespace" || (options.mergeSpaces && options.delimiter);

        if (performPreprocessing) {
            const delimToPreprocess = options.delimiter === "whitespace" ? "whitespace" : options.delimiter;
            processText = preprocessText(text, delimToPreprocess);
        }

        const actualDelim = options.delimiter === "whitespace" ? " " : (options.delimiter || "");

        const results = Papa.parse(processText, {
            header: options.hasHeaders,
            skipEmptyLines: true,
            delimiter: actualDelim,
            delimitersToGuess: [',', '\t', '|', ';', ' '],
        });
        
        let parsedData = results.data;
        if (!options.hasHeaders) parsedData = applySyntheticHeaders(parsedData);
        postParse(parsedData, options);
    }
}

async function postParse(data, options) {
    if (!data || data.length === 0) {
        showToast("No data found.", "error");
        return;
    }

    // 1. UTM Conversion (if needed)
    if (options.hasUtm) {
        if (!options.eastingCol || !options.northingCol) {
            showToast(
                "Missing Easting/Northing columns for UTM conversion.",
                "error",
            );
            return;
        }
        data = await convertUtmToLatLng(
            data,
            options.utmZone,
            options.eastingCol,
            options.northingCol,
            options.zoneCol
        );
    }

    // 2. Identify Lat/Lng Columns
    let latCol, lngCol;

    if (options.hasUtm) {
        latCol = "latitude";
        lngCol = "longitude";
    } else {
        latCol = options.latCol;
        lngCol = options.lngCol;
    }

    // 3. Apply Mapping Immediately (Skip UI)
    applyColumnMapping(latCol, lngCol, data);
}

async function convertUtmToLatLng(data, defaultZone, eastCol, northCol, zoneColInput) {
    if (!data || data.length === 0) return data;

    const proj4 = (await import("proj4")).default;
    const headers = Object.keys(data[0]);
    const zoneCol = zoneColInput || headers.find((h) => /zone/i.test(h));

    if (!eastCol || !northCol) {
        showToast(
            "Could not auto-detect Easting/Northing columns during conversion.",
            "error",
        );
        return data;
    }

    let convertedCount = 0;
    const newData = data.map((row) => {
        try {
            const e = parseCoordinate(row[eastCol]);
            const n = parseCoordinate(row[northCol]);
            if (isNaN(e) || isNaN(n)) return row;

            // Overwrite original strings with clean floats for export
            row[eastCol] = e;
            row[northCol] = n;

            // Zone: Row-specific or Default
            let zoneStr = defaultZone;
            if (zoneCol && row[zoneCol]) {
                zoneStr = row[zoneCol];
            }

            // Ensure zoneStr exists before parsing
            if (!zoneStr) return row;

            const match = zoneStr.toString().match(/(\d+)([NS]?)/i);
            if (!match) return row; // Cannot parse zone

            const zoneNum = match[1];
            const hemi = match[2].toUpperCase();
            const isSouth = hemi === "S";

            const def = `+proj=utm +zone=${zoneNum} ${isSouth ? "+south" : ""} +datum=WGS84 +units=m +no_defs`;

            const [lng, lat] = proj4(def, "EPSG:4326", [e, n]);

            convertedCount++;
            return {
                ...row,
                _lat_converted: lat,
                _lng_converted: lng,
                latitude: lat,
                longitude: lng,
            };
        } catch (err) {
            return row;
        }
    });

    if (convertedCount > 0) {
        showToast(`Converted ${convertedCount} UTM points to Lat/Lng`, "success");
    }
    return newData;
}

function applySyntheticHeaders(data) {
    if (!data || data.length === 0) return data;
    return data.map(row => {
        let obj = {};
        const len = Array.isArray(row) ? row.length : Object.keys(row).length;
        for (let i = 0; i < len; i++) {
            obj[`Column ${i + 1}`] = Array.isArray(row) ? row[i] : row[Object.keys(row)[i]];
        }
        return obj;
    });
}

function readExcelFile(file, sheetName = null, XLSX, callback, hasHeaders = true) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        let targetSheet = sheetName;
        if (!targetSheet) {
            targetSheet = workbook.SheetNames[0];
        }

        const worksheet = workbook.Sheets[targetSheet];
        let jsonData = XLSX.utils.sheet_to_json(worksheet, hasHeaders ? {} : { header: 1 });
        
        if (!hasHeaders) {
            jsonData = applySyntheticHeaders(jsonData);
        }

        if (callback) callback(jsonData);
        else processParsedData(jsonData); // Fallback
    };
    reader.readAsArrayBuffer(file);
}

export function processParsedData(data) {
    if (!data || data.length === 0) {
        showToast("No data found.", "error");
        return;
    }
    state.rawData = data;
    const headers = Object.keys(data[0]);
    const defaults = guessColumns(headers);
    showColumnMappingModal(headers, defaults);
}

export function applyColumnMapping(latCol, lngCol, providedData = null) {
    const cleanData = providedData || state.rawData;
    if (!cleanData) return;

    if (!latCol || !lngCol) {
        showToast("Invalid Mapping: Missing Lat/Lng columns.", "error");
        return;
    }

    const validPoints = cleanData
        .filter((row) => {
            const lat = parseCoordinate(row[latCol]);
            const lng = parseCoordinate(row[lngCol]);
            return !isNaN(lat) && !isNaN(lng);
        })
        .map((row) => {
            const lat = parseCoordinate(row[latCol]);
            const lng = parseCoordinate(row[lngCol]);
            
            // Overwrite original strings with clean floats for export
            row[latCol] = lat;
            row[lngCol] = lng;

            return {
                ...row,
                _lat: lat,
                _lng: lng,
            };
        });

    if (validPoints.length === 0) {
        showToast("No valid data found with selected columns.", "error");
        return;
    }

    state.allPoints = validPoints;
    plotPoints();
    updateStats(state.allPoints.length);
    state.isFilteringEnabled = false;
    state.filteredPoints = [...state.allPoints];
    updateSelectionUI();
    hideColumnMappingModal();
    switchViewMode("split");
    showToast(`Loaded ${validPoints.length} points successfully!`, "success");
    setTimeout(() => {
        switchTab("process");
    }, 500);
}

export async function enrichData() {
    // Load World Data dynamically
    const { worldGeoJSON } = await import("../world_data.js");
    const worldData = worldGeoJSON;

    if (!worldData) {
        showToast("World data not loaded yet. Please wait.", "error");
        return;
    }

    // Load Turf dynamically
    const turf = await import("@turf/turf");

    setTimeout(() => {
        let enrichedCount = 0;
        const enrichedData = state.filteredPoints.map((point) => {
            const pt = turf.point([point._lng, point._lat]);
            let countryName = "Unknown";
            for (const feature of worldData.features) {
                if (turf.booleanPointInPolygon(pt, feature)) {
                    countryName =
                        feature.properties.name ||
                        feature.properties.NAME ||
                        feature.properties.admin;
                    enrichedCount++;
                    break;
                }
            }
            return { ...point, country: countryName };
        });

        state.filteredPoints = enrichedData;
        updateTable(state.filteredPoints);
        showToast(`Country names added to ${enrichedCount} points!`, "success");
        switchTab("export");
    }, 100);
}

export async function handleExport() {
    if (state.filteredPoints.length === 0) return;

    const formatSelect = document.getElementById("exportFormat");
    const format = formatSelect ? formatSelect.value : "csv";

    // CSV requires PapaParse
    if (format === "csv") {
        const Papa = (await import("papaparse")).default;
        const cleanData = state.filteredPoints.map((p) => {
            const newObj = {};
            for (const key in p) {
                if (!key.startsWith("_")) newObj[key] = p[key];
            }
            return newObj;
        });
        const csv = Papa.unparse(cleanData);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        downloadBlob(blob, "enriched_data.csv");
        showToast("CSV Download started!", "success");
        return;
    }

    showToast(`Generating ${format.toUpperCase()}...`, "info");

    const cleanPoints = state.filteredPoints.map((p) => {
        const newObj = {};
        for (const key in p) {
            if (!key.startsWith("_")) newObj[key] = p[key];
        }
        return {
            ...newObj,
            lat: p._lat,
            lng: p._lng,
        };
    });

    try {
        const geoJSON = generateGeoJSON(cleanPoints);

        if (format === "geojson") {
            const blob = new Blob([JSON.stringify(geoJSON, null, 2)], {
                type: "application/geo+json",
            });
            downloadBlob(blob, "data.geojson");
            showToast("GeoJSON Download started!", "success");
        } else if (format === "kml") {
            const kml = await generateKML(geoJSON); // AWAIT ADDED
            const blob = new Blob([kml], {
                type: "application/vnd.google-earth.kml+xml",
            });
            downloadBlob(blob, "data.kml");
            showToast("KML Download started!", "success");
        } else if (format === "kmz") {
            const kml = await generateKML(geoJSON); // AWAIT ADDED
            const blob = await generateKMZ(kml);
            downloadBlob(blob, "data.kmz");
            showToast("KMZ Download started!", "success");
        } else if (format === "shapefile") {
            if (cleanPoints.length > 0) {
                const keys = Object.keys(cleanPoints[0]);
                const longKeys = keys.filter((k) => k.length > 10);
                if (longKeys.length > 0) {
                    const confirmTruncation = confirm(
                        `Shapefile field names limit is 10 characters.\n\nThe following columns will be truncated:\n${longKeys.join(", ")}\n\nDo you want to proceed?`,
                    );
                    if (!confirmTruncation) {
                        showToast("Export cancelled.", "info");
                        return;
                    }
                }
            }

            const result = await generateShapefile(geoJSON);
            if (result === "HANDLED_INTERNALLY") {
                showToast("Shapefile generation started!", "success");
            } else {
                downloadBlob(result, "data.zip");
                showToast("Shapefile Download started!", "success");
            }
        }
    } catch (e) {
        console.error("Export Error:", e);
        showToast(`Export Failed: ${e.message}`, "error");
    }
}

export function guessColumns(headers) {
    const safeLat = /latitude/i;
    const safeLng = /longitude/i;
    const riskyLat = /(^|[^a-z])(lat|y)($|[^a-z])/i;
    const riskyLng = /(^|[^a-z])(lng|lon|long|x)($|[^a-z])/i;

    let latCol = null;
    let lngCol = null;

    const safeLatMatch = headers.find((h) => safeLat.test(h));
    if (safeLatMatch) {
        latCol = safeLatMatch;
    } else {
        latCol = headers.find((h) => riskyLat.test(h)) || null;
    }

    const safeLngMatch = headers.find((h) => safeLng.test(h));
    if (safeLngMatch) {
        lngCol = safeLngMatch;
    } else {
        lngCol = headers.find((h) => riskyLng.test(h)) || null;
    }

    return { lat: latCol, lng: lngCol };
}

export function loadSampleData() {
    const sampleData = [
        { id: 1, name: "New York", lat: 40.7128, lng: -74.006, category: "City" },
        { id: 2, name: "London", lat: 51.5074, lng: -0.1278, category: "City" },
        { id: 3, name: "Tokyo", lat: 35.6762, lng: 139.6503, category: "City" },
        { id: 4, name: "Sydney", lat: -33.8688, lng: 151.2093, category: "City" },
        {
            id: 5,
            name: "Rio de Janeiro",
            lat: -22.9068,
            lng: -43.1729,
            category: "City",
        },
        { id: 6, name: "Cape Town", lat: -33.9249, lng: 18.4241, category: "City" },
        { id: 7, name: "Mumbai", lat: 19.076, lng: 72.8777, category: "City" },
        { id: 8, name: "Paris", lat: 48.8566, lng: 2.3522, category: "City" },
    ];
    processParsedData(sampleData);
    showToast("Loaded sample data.", "success");
}

export async function addUTM() {
    if (state.filteredPoints.length === 0) {
        showToast("No points to process", "error");
        return;
    }

    // Dynamic import proj4
    const proj4 = (await import("proj4")).default;

    setTimeout(() => {
        let count = 0;
        const enriched = state.filteredPoints.map((p) => {
            try {
                const lon = p._lng;
                const lat = p._lat;
                const zoneNumber = Math.floor((lon + 180) / 6) + 1;
                const isNorth = lat >= 0;

                const utmProj = `+proj=utm +zone=${zoneNumber} ${!isNorth ? "+south " : ""}+datum=WGS84 +units=m +no_defs`;
                const [easting, northing] = proj4("EPSG:4326", utmProj, [lon, lat]);

                count++;
                return {
                    ...p,
                    utm_zone: `${zoneNumber}${isNorth ? "N" : "S"}`,
                    utm_easting: easting.toFixed(2),
                    utm_northing: northing.toFixed(2),
                };
            } catch (e) {
                console.error("UTM Conversion Error", e);
                return p;
            }
        });

        state.filteredPoints = enriched;
        updateTable(state.filteredPoints);
        showToast(`UTM coordinates added to ${count} points!`, "success");
        switchTab("export");
    }, 50);
}
