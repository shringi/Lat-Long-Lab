import { showToast } from "./ui.js";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import L from "leaflet";

// State for the wizard
let wizardState = {
    file: null,
    text: null,
    format: "csv", // 'csv' or 'excel'
    workbook: null, // For Excel
    previewData: [],
    delimiter: "",
    encoding: "UTF-8",
    hasUtm: false,
    utmZone: "",
    onConfirm: null,
    pickerMap: null,
    pickerLayer: null,
    tempZone: null,
};

export function initImportWizard() {
    console.log("Import Wizard Initialized");
    // Bind Event Listeners
    const getEl = (id) => document.getElementById(id);

    getEl("wizardCloseBtn").addEventListener("click", closeWizard);
    getEl("wizardCancelBtn").addEventListener("click", closeWizard);
    getEl("wizardConfirmBtn").addEventListener("click", handleConfirm);

    getEl("wizardDelimiter").addEventListener("change", (e) => {
        wizardState.delimiter = e.target.value;
        updatePreview();
    });

    getEl("wizardEncoding").addEventListener("change", (e) => {
        wizardState.encoding = e.target.value;
        updatePreview();
    });

    getEl("wizardSheet").addEventListener("change", (e) => {
        updateExcelPreview(e.target.value);
    });

    getEl("wizardHasUtm").addEventListener("change", (e) => {
        wizardState.hasUtm = e.target.checked;
        const latLonGroup = getEl("wizardLatLonGroup");
        const utmGroup = getEl("wizardUtmGroup");

        if (wizardState.hasUtm) {
            latLonGroup.classList.add("hidden");
            utmGroup.classList.remove("hidden");

            // Re-run guess logic to ensure fields are populated if possible
            if (wizardState.previewData && wizardState.previewData.length > 0) {
                const headers = wizardState.previewData[0]; // Assuming first row is headers
                // Headers might be array or object depending on parse mode. 
                // In handleCSVPreload we passed isArrayMode=true to renderPreviewTable, but Papa parse results.data is array of arrays if header:false (default).
                // Wait, handleCSVPreload defaults header:false? explicit header option isn't set, so it returns array of arrays.
                // So headers is indeed results.data[0]. 
                // However, we need to be careful if it's an object array (header:true). 
                // Let's check how populateColumnSelectors handles it. It expects array of strings.

                // If previewData is array of objects (header:true), keys are headers.
                let headerKeys = [];
                if (Array.isArray(headers)) {
                    headerKeys = headers;
                } else if (typeof headers === 'object') {
                    headerKeys = Object.keys(headers);
                }

                const guess = guessColumns(headerKeys);
                if (guess.easting && !getEl("wizardEastingCol").value) getEl("wizardEastingCol").value = guess.easting;
                if (guess.northing && !getEl("wizardNorthingCol").value) getEl("wizardNorthingCol").value = guess.northing;
            }

        } else {
            latLonGroup.classList.remove("hidden");
            utmGroup.classList.add("hidden");
        }
    });

    // UTM Picker
    getEl("wizardMapPickerBtn").addEventListener("click", openUtmPicker);
    getEl("utmPickerCloseBtn").addEventListener("click", closeUtmPicker);
    getEl("utmPickerConfirmBtn").addEventListener("click", confirmUtmPicker);
}

export function openImportWizard(
    file,
    text = null,
    onConfirmCallback,
    gisData = null,
) {
    const modal = document.getElementById("importWizardModal");
    if (!modal) return;

    // Reset State
    wizardState = {
        file,
        text,
        format: "csv", // 'csv', 'excel', or 'gis'
        workbook: null,
        previewData: [],
        delimiter: "",
        encoding: "UTF-8",
        hasUtm: false,
        utmZone: "",
        onConfirm: onConfirmCallback,
        pickerMap: wizardState.pickerMap, // Keep map instance if exists
        pickerLayer: wizardState.pickerLayer,
        tempZone: null,
    };

    // Reset UI visibility (Hide all specific groups first)
    document.getElementById("wizardDelimiterGroup").classList.add("hidden");
    document.getElementById("wizardSheetGroup").classList.add("hidden");
    document.getElementById("wizardGisGroup").classList.add("hidden");
    document.getElementById("wizardWarning").classList.add("hidden");

    // Reset inputs
    document.getElementById("wizardDelimiter").value = "";
    document.getElementById("wizardEncoding").value = "UTF-8";
    document.getElementById("wizardHasUtm").checked = false;
    document.getElementById("wizardUtmZone").value = "";

    // Clear Selectors
    [
        "wizardLatCol",
        "wizardLngCol",
        "wizardEastingCol",
        "wizardNorthingCol",
    ].forEach((id) => {
        document.getElementById(id).innerHTML = "";
    });

    // Show Modal
    modal.classList.remove("hidden");

    // Handle GIS Mode
    if (gisData) {
        wizardState.format = "gis";

        // Hide standard column mapping UI & Encoding
        document.getElementById("wizardEncodingGroup").classList.add("hidden");
        document.getElementById("wizardCoordConfigGroup").classList.add("hidden");

        // Show GIS Summary
        document.getElementById("wizardGisGroup").classList.remove("hidden");

        // Populate Stats
        document.getElementById("gisValidCount").textContent =
            gisData.validCount || 0;
        document.getElementById("gisFlattenedCount").textContent =
            gisData.flattenedCount || 0;
        document.getElementById("gisIgnoredCount").textContent =
            gisData.rejectedCount || 0;

        // Show warning if things were ignored
        if ((gisData.rejectedCount || 0) > 0) {
            document.getElementById("gisIgnoredWarning").classList.remove("hidden");
        } else {
            document.getElementById("gisIgnoredWarning").classList.add("hidden");
        }

        // Preview Raw Data (All Features)
        const previewRows = (gisData.rawPreview || []).slice(0, 5);
        renderPreviewTable(previewRows, false);
        return;
    }

    // Standard CSV/Excel Mode
    document.getElementById("wizardEncodingGroup").classList.remove("hidden");
    document.getElementById("wizardCoordConfigGroup").classList.remove("hidden");

    document.getElementById("wizardLatLonGroup").classList.remove("hidden");
    document.getElementById("wizardUtmGroup").classList.add("hidden"); // Default hidden

    // Detect Type & Preview
    if (file) {
        const name = file.name.toLowerCase();
        if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
            wizardState.format = "excel";
            handleExcelPreload(file);
        } else {
            wizardState.format = "csv";
            document
                .getElementById("wizardDelimiterGroup")
                .classList.remove("hidden");
            handleCSVPreload(file);
        }
    } else if (text) {
        wizardState.format = "csv";
        document.getElementById("wizardDelimiterGroup").classList.remove("hidden");
        handleTextPreload(text);
    }
}

function closeWizard() {
    document.getElementById("importWizardModal").classList.add("hidden");
}

function handleConfirm() {
    if (wizardState.format === "gis") {
        if (wizardState.onConfirm) wizardState.onConfirm(true);
        closeWizard();
        return;
    }

    // Gather Options for CSV/Excel
    const options = {
        delimiter: wizardState.delimiter,
        encoding: wizardState.encoding,
        sheetName: document.getElementById("wizardSheet").value,
        hasUtm: document.getElementById("wizardHasUtm").checked,
        utmZone: document.getElementById("wizardUtmZone").value.trim(),
        // Column Mapping
        latCol: document.getElementById("wizardLatCol").value,
        lngCol: document.getElementById("wizardLngCol").value,
        eastingCol: document.getElementById("wizardEastingCol").value,
        northingCol: document.getElementById("wizardNorthingCol").value,
    };

    if (wizardState.onConfirm) {
        wizardState.onConfirm(options);
    }
    closeWizard();
}

// --- Preview Logic ---

function handleCSVPreload(file) {
    // Hide Excel UI, Show CSV UI
    document.getElementById("wizardDelimiterGroup").classList.remove("hidden");
    document.getElementById("wizardSheetGroup").classList.add("hidden");

    // Read first chunk
    Papa.parse(file, {
        preview: 5,
        encoding: wizardState.encoding,
        delimiter: wizardState.delimiter || "", // Use empty string to trigger auto-detect if not set
        complete: (results) => {
            // Auto-detect delimiter update UI
            if (results.meta.delimiter) {
                const delimSelect = document.getElementById("wizardDelimiter");
                // Only update if we are in auto-detect mode (value is empty) or if we want to reflect detection
                // Better UX: Always show what was detected if the user hasn't explicitly chosen one (and state is empty)
                if (wizardState.delimiter === "") {
                    delimSelect.value = results.meta.delimiter;
                    // If the detected delimiter isn't in our list (e.g. pipe), we might want to add it or just set value
                    // Check if value stuck
                    if (delimSelect.value !== results.meta.delimiter) {
                        // Option doesn't exist, maybe add custom? Or just let standard ones work.
                        // For now, assume standard.
                    }
                    wizardState.delimiter = results.meta.delimiter;
                }
            }

            wizardState.previewData = results.data;
            // Render with isArrayMode=true to use first row as headers
            renderPreviewTable(results.data, true);

            // Populate Columns & Guess using the first row as headers
            const headers = results.data.length > 0 ? results.data[0] : [];
            populateColumnSelectors(headers);

            // Heuristic Nudge for UTM
            checkForUtmNudge(headers);
        },
        error: (err) => {
            showToast("Preview Error: " + err.message, "error");
        },
    });
}

function handleTextPreload(text) {
    const results = Papa.parse(text, {
        preview: 5,
        delimiter: wizardState.delimiter || "",
    });

    // Auto-detect delimiter update UI for text too
    if (results.meta.delimiter && wizardState.delimiter === "") {
        const delimSelect = document.getElementById("wizardDelimiter");
        delimSelect.value = results.meta.delimiter;
        wizardState.delimiter = results.meta.delimiter;
    }

    wizardState.previewData = results.data;
    renderPreviewTable(results.data, true);

    // Populate Columns
    const headers = results.data.length > 0 ? results.data[0] : [];
    populateColumnSelectors(headers);

    checkForUtmNudge(headers);
}

function handleExcelPreload(file) {
    // Show Excel UI, Hide Delimiter
    document.getElementById("wizardDelimiterGroup").classList.add("hidden");

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array", bookDeps: true });
        wizardState.workbook = workbook;

        const sheetNames = workbook.SheetNames;

        const sheetSelect = document.getElementById("wizardSheet");
        sheetSelect.innerHTML = "";
        sheetNames.forEach((name) => {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            sheetSelect.appendChild(opt);
        });

        // Single Sheet Optimization (Skip Selector if only 1)
        if (sheetNames.length > 1) {
            document.getElementById("wizardSheetGroup").classList.remove("hidden");
        }

        updateExcelPreview(sheetNames[0]);
    };
    reader.readAsArrayBuffer(file);
}

function updateExcelPreview(sheetName) {
    if (!wizardState.workbook) return;
    const worksheet = wizardState.workbook.Sheets[sheetName];
    // Preview 5 rows
    const json = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        range: 0,
        defval: "",
    }); // Array of arrays
    const snippet = json.slice(0, 6); // Header + 5 rows
    renderPreviewTable(snippet, true);

    // Populate Columns from first row (headers)
    const headers = json.length > 0 ? json[0] : [];
    populateColumnSelectors(headers);
    checkForUtmNudge(headers);
}

function updatePreview() {
    // If CSV, re-parse with new delimiter/encoding
    if (wizardState.format === "csv" && wizardState.file) {
        Papa.parse(wizardState.file, {
            preview: 5,
            delimiter: wizardState.delimiter,
            encoding: wizardState.encoding,
            complete: (results) => {
                renderPreviewTable(results.data);
            },
        });
    }
}

function renderPreviewTable(data, isArrayMode = false) {
    const tableHead = document.querySelector("#wizardPreviewTable thead");
    const tableBody = document.querySelector("#wizardPreviewTable tbody");
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    if (!data || data.length === 0) {
        document.getElementById("wizardPreviewEmpty").classList.remove("hidden");
        return;
    }
    document.getElementById("wizardPreviewEmpty").classList.add("hidden");

    // Headers
    const headers = isArrayMode ? data[0] : Object.keys(data[0]);
    const headerRow = document.createElement("tr");
    headers.forEach((h) => {
        const th = document.createElement("th");
        th.className =
            "px-4 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b";
        th.textContent = h;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Body
    const rows = isArrayMode ? data.slice(1) : data;
    rows.forEach((row) => {
        const tr = document.createElement("tr");
        if (isArrayMode) {
            row.forEach((cell) => {
                const td = document.createElement("td");
                td.className = "px-4 py-1 whitespace-nowrap border-b text-gray-700";
                td.textContent = cell;
                tr.appendChild(td);
            });
        } else {
            headers.forEach((h) => {
                const td = document.createElement("td");
                td.className = "px-4 py-1 whitespace-nowrap border-b text-gray-700";
                td.textContent = row[h] || "";
                tr.appendChild(td);
            });
        }
        tableBody.appendChild(tr);
    });
}

// --- Column Mapping Logic ---

function populateColumnSelectors(headers) {
    if (!headers || headers.length === 0) return;

    const createOpt = (val) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = val;
        return opt;
    };

    const selects = [
        "wizardLatCol",
        "wizardLngCol",
        "wizardEastingCol",
        "wizardNorthingCol",
    ];
    selects.forEach((id) => {
        const el = document.getElementById(id);
        el.innerHTML = "";
        headers.forEach((h) => el.appendChild(createOpt(h)));
    });

    // Auto-Guess
    const guess = guessColumns(headers);

    // Set Lat/Lon defaults
    if (guess.lat) document.getElementById("wizardLatCol").value = guess.lat;
    if (guess.lng) document.getElementById("wizardLngCol").value = guess.lng;

    // Set UTM defaults
    if (guess.easting)
        document.getElementById("wizardEastingCol").value = guess.easting;
    if (guess.northing)
        document.getElementById("wizardNorthingCol").value = guess.northing;
}

function guessColumns(headers) {
    const safeLat = /latitude/i;
    const safeLng = /longitude/i;
    const riskyLat = /(^|[^a-z])(lat|y)($|[^a-z])/i;
    const riskyLng = /(^|[^a-z])(lng|lon|long|x)($|[^a-z])/i;

    const utmEast = /easting|utm_e|^x$/i; // X is also easting (exact match)
    const utmNorth = /northing|utm_n|^y$/i; // Y is also northing (exact match)

    let latCol =
        headers.find((h) => safeLat.test(h)) ||
        headers.find((h) => riskyLat.test(h));
    let lngCol =
        headers.find((h) => safeLng.test(h)) ||
        headers.find((h) => riskyLng.test(h));

    let eastCol = headers.find((h) => utmEast.test(h));
    let northCol = headers.find((h) => utmNorth.test(h));

    return { lat: latCol, lng: lngCol, easting: eastCol, northing: northCol };
}

function checkForUtmNudge(headersOrRow) {
    // Simple Heuristic
    if (!headersOrRow) return;

    let foundUtm = false;
    let keys = Array.isArray(headersOrRow)
        ? headersOrRow
        : Object.keys(headersOrRow);

    // Check if keys contain utm-like words
    const utmRegex = /utm|easting|northing|^x$|^y$/i;
    // We only nudge if the user hasn't already checked it (although this fn runs on init)

    if (keys.some((k) => utmRegex.test(k))) foundUtm = true;

    if (foundUtm) {
        const warning = document.getElementById("wizardWarning");
        const text = document.getElementById("wizardWarningText");
        warning.classList.remove("hidden");
        text.textContent =
            "It looks like your data contains UTM coordinates. You can configure them below.";
    }
}

// --- UTM Picker Logic ---

function openUtmPicker() {
    document.getElementById("utmPickerModal").classList.remove("hidden");

    // Initialize Map if needed
    // Slight delay to ensure DOM is visible
    setTimeout(() => {
        if (!wizardState.pickerMap) {
            initUtmMap();
        } else {
            wizardState.pickerMap.invalidateSize();
        }
    }, 100);
}

function closeUtmPicker() {
    document.getElementById("utmPickerModal").classList.add("hidden");
}

function confirmUtmPicker() {
    if (wizardState.tempZone) {
        document.getElementById("wizardUtmZone").value = wizardState.tempZone;
    }
    closeUtmPicker();
}

function initUtmMap() {
    const map = L.map("utmPickerMap", {
        center: [20, 0],
        zoom: 2,
        minZoom: 1,
        maxZoom: 5,
        zoomControl: true, // Allow zoom
        attributionControl: false,
    });

    // Optional Base Layer (Carto Light for context)
    L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
        {
            opacity: 0.3,
        },
    ).addTo(map);

    // Generate UTM Grid
    const gridLayer = L.geoJSON(generateUtmGrid(), {
        style: {
            color: "#3b82f6",
            weight: 1,
            fillOpacity: 0.05,
            fillColor: "#3b82f6",
        },
        onEachFeature: (feature, layer) => {
            layer.on("click", (e) => {
                selectZone(feature.properties.zone, layer);
            });
            layer.bindTooltip(`Zone ${feature.properties.zone}`, {
                sticky: true,
                direction: "center",
            });
        },
    }).addTo(map);

    wizardState.pickerMap = map;
    wizardState.pickerLayer = gridLayer;
}

function selectZone(zone, layer) {
    wizardState.tempZone = zone;

    // UI Update
    document.getElementById("utmPickerSelectedZone").textContent = `Zone ${zone}`;
    const confirmBtn = document.getElementById("utmPickerConfirmBtn");
    confirmBtn.disabled = false;
    document.getElementById("utmPickerConfirmText").textContent = zone;

    // Highlight logic
    // Reset all
    wizardState.pickerLayer.eachLayer((l) => {
        wizardState.pickerLayer.resetStyle(l);
    });
    // Highlight selected
    layer.setStyle({
        fillOpacity: 0.4,
        color: "#1d4ed8", // Darker blue
        weight: 2,
    });
}

function generateUtmGrid() {
    const features = [];

    // 60 Zones, 6 degrees each. Starts at -180.
    for (let i = 1; i <= 60; i++) {
        const west = -180 + (i - 1) * 6;
        const east = west + 6;

        // North Hemisphere
        features.push({
            type: "Feature",
            properties: { zone: `${i}N` },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [west, 0],
                        [east, 0],
                        [east, 84],
                        [west, 84],
                        [west, 0],
                    ],
                ],
            },
        });

        // South Hemisphere
        features.push({
            type: "Feature",
            properties: { zone: `${i}S` },
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        [west, -80],
                        [east, -80],
                        [east, 0],
                        [west, 0],
                        [west, -80],
                    ],
                ],
            },
        });
    }

    return { type: "FeatureCollection", features: features };
}
