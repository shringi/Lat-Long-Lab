import { showToast } from "./ui.js";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import L from "leaflet";
import { parseCoordinate } from "./data.js";

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
    mergeSpaces: false,
    hasHeaders: true,
    userToggledHeaders: false,
    onConfirm: null,
    pickerMap: null,
    pickerLayer: null,
    tempZone: null,
};

function guessHasHeaders(data) {
    if (!data || data.length < 2) return true;
    const row1 = data[0];
    const row2 = data[1];

    const arr1 = Array.isArray(row1) ? row1 : Object.values(row1);
    const arr2 = Array.isArray(row2) ? row2 : Object.values(row2);

    // Check if rows contain valid numbers (or space-separated numbers if auto-split failed)
    const isNum = (v) => {
        if (v === null || v === undefined || v === "") return false;
        const str = String(v).trim();
        if (str === "") return false;
        // Allows numbers, dots, minus, plus, e/E for scientific, and spaces/tabs
        return /^[\d\.\-\+eE\s\t]+$/.test(str);
    };
    const row1HasNumbers = arr1.some(isNum);
    const row2HasNumbers = arr2.some(isNum);

    if (!row1HasNumbers && row2HasNumbers) return true; // Row 1 is strings, Row 2 has numbers -> Header!
    if (row1HasNumbers && row2HasNumbers) return false; // Both rows have numbers -> Coordinate list, No Header!

    return true; // Default
}

export function initImportWizard() {
    console.log("Import Wizard Initialized");
    // Bind Event Listeners
    const getEl = (id) => document.getElementById(id);

    // Initialize Custom UTM Zone Autocomplete
    const utmZoneInput = getEl("wizardUtmZone");
    const utmZoneList = getEl("wizardUtmAutocomplete");
    if (utmZoneInput && utmZoneList) {
        const validZones = [];
        for (let i = 1; i <= 60; i++) {
            validZones.push(`${i}N`);
            validZones.push(`${i}S`);
        }

        utmZoneInput.addEventListener("input", (e) => {
            const val = e.target.value.toUpperCase();
            utmZoneInput.value = val; // Force uppercase visually
            utmZoneList.innerHTML = "";

            if (!val) {
                utmZoneList.classList.add("hidden");
                return;
            }

            const matches = validZones.filter((z) => z.startsWith(val));
            if (matches.length > 0 && matches[0] !== val) {
                utmZoneList.classList.remove("hidden");
                matches.forEach((m) => {
                    const li = document.createElement("li");
                    li.className = "px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-gray-700 border-b border-gray-100 last:border-0";
                    li.textContent = m;
                    li.addEventListener("click", () => {
                        utmZoneInput.value = m;
                        utmZoneList.classList.add("hidden");
                    });
                    utmZoneList.appendChild(li);
                });
            } else {
                utmZoneList.classList.add("hidden");
            }
        });

        // Hide autocomplete when clicking elsewhere
        document.addEventListener("click", (e) => {
            if (e.target !== utmZoneInput) {
                utmZoneList.classList.add("hidden");
            }
        });
    }

    getEl("wizardCloseBtn").addEventListener("click", closeWizard);
    getEl("wizardCancelBtn").addEventListener("click", closeWizard);
    getEl("wizardConfirmBtn").addEventListener("click", handleConfirm);
    getEl("wizardBackBtn").addEventListener("click", goBackToStep1);

    const wizardCustomDelimiter = getEl("wizardCustomDelimiter");
    const customContainer = getEl("wizardCustomDelimiterContainer");
    const mergeContainer = getEl("wizardMergeSpacesContainer");

    let debounceTimer;

    getEl("wizardDelimiter").addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "custom") {
            customContainer.classList.remove("hidden");
            wizardState.delimiter = wizardCustomDelimiter.value;
        } else if (val === "whitespace") {
            customContainer.classList.add("hidden");
            wizardState.delimiter = "whitespace";
        } else {
            customContainer.classList.add("hidden");
            wizardState.delimiter = val;
        }

        if (val === " " || val === "\t" || val === "custom" || val === "whitespace") {
            mergeContainer.classList.remove("hidden");
        } else {
            mergeContainer.classList.add("hidden");
        }
        updatePreview();
    });

    wizardCustomDelimiter.addEventListener("input", (e) => {
        if (getEl("wizardDelimiter").value === "custom") {
            wizardState.delimiter = e.target.value;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => updatePreview(), 300);
        }
    });

    getEl("wizardMergeSpaces").addEventListener("change", (e) => {
        wizardState.mergeSpaces = e.target.checked;
        updatePreview();
    });

    getEl("wizardEncoding").addEventListener("change", (e) => {
        wizardState.encoding = e.target.value;
        updatePreview();
    });

    getEl("wizardHasHeaders").addEventListener("change", (e) => {
        wizardState.hasHeaders = e.target.checked;
        wizardState.userToggledHeaders = true;
        updatePreview();
    });

    getEl("wizardSheet").addEventListener("change", (e) => {
        updateExcelPreview(e.target.value);
    });

    getEl("wizardHasUtm").addEventListener("change", (e) => {
        wizardState.hasUtm = e.target.checked;
        const confirmBtnText = getEl("wizardConfirmBtnText");
        
        // Hide warning instantly when toggled
        if (wizardState.hasUtm) {
            const warningEl = document.getElementById("wizardWarning");
            if (warningEl) warningEl.classList.add("hidden");
        }

        if (wizardState.hasUtm) {
            confirmBtnText.textContent = "Continue to UTM Config \u2192";
        } else {
            confirmBtnText.textContent = "Import Data";
        }
    });

    // Dynamic Validation Clearance
    const clearUtmErrorIfValid = () => {
        const warning = document.getElementById("wizardWarning");
        const warningText = document.getElementById("wizardWarningText");
        
        // Only clear if the current error is specifically the UTM Zone error
        if (warningText.innerHTML.includes("Invalid Global UTM Zone")) {
            const tempZone = getEl("wizardUtmZone").value.trim().toUpperCase();
            const tempCol = getEl("wizardZoneCol").value;
            const validPattern = /^([1-9]|[1-5][0-9]|60)[NS]$/;
            
            if (tempCol || validPattern.test(tempZone)) {
                warning.classList.add("hidden");
            }
        }
    };
    getEl("wizardUtmZone").addEventListener("input", clearUtmErrorIfValid);
    getEl("wizardZoneCol").addEventListener("change", clearUtmErrorIfValid);

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
        mergeSpaces: false,
        hasHeaders: true,
        userToggledHeaders: false,
        onConfirm: onConfirmCallback,
        pickerMap: wizardState.pickerMap, // Keep map instance if exists
        pickerLayer: wizardState.pickerLayer,
        tempZone: null,
        step: 1, // Manage UI Steps
    };

    // Reset UI visibility (Hide all specific groups first)
    document.getElementById("wizardStep1").classList.remove("hidden");
    document.getElementById("wizardStepUtm").classList.add("hidden");
    document.getElementById("wizardBackBtn").classList.add("hidden");
    document.getElementById("wizardConfirmBtnText").textContent = "Import Data";
    document.getElementById("wizardDelimiterGroup").classList.add("hidden");
    document.getElementById("wizardSheetGroup").classList.add("hidden");
    document.getElementById("wizardGisGroup").classList.add("hidden");
    document.getElementById("wizardWarning").classList.add("hidden");
    document.getElementById("wizardCustomDelimiterContainer").classList.add("hidden");
    document.getElementById("wizardMergeSpacesContainer").classList.add("hidden");
    document.getElementById("wizardDelimiterWarning").classList.add("hidden");
    document.getElementById("wizardFormatToggles").classList.add("hidden");

    // Reset inputs
    document.getElementById("wizardDelimiter").value = "";
    document.getElementById("wizardCustomDelimiter").value = "";
    document.getElementById("wizardMergeSpaces").checked = false;
    document.getElementById("wizardEncoding").value = "UTF-8";
    document.getElementById("wizardHasUtm").checked = false;
    document.getElementById("wizardHasHeaders").checked = true;
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
    document.getElementById("wizardFormatToggles").classList.remove("hidden");
    document.getElementById("wizardFooterUtmToggleGroup").classList.remove("hidden");

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
    const warningEl = document.getElementById("wizardWarning");
    if (warningEl) warningEl.classList.add("hidden");
}

function goBackToStep1() {
    wizardState.step = 1;
    document.getElementById("wizardStepUtm").classList.add("hidden");
    document.getElementById("wizardStep1").classList.remove("hidden");
    document.getElementById("wizardBackBtn").classList.add("hidden");
    document.getElementById("wizardFooterUtmToggleGroup").classList.remove("hidden");
    document.getElementById("wizardConfirmBtnText").textContent = "Continue to UTM Config \u2192";
    
    // Clear warning when going back
    const warningEl = document.getElementById("wizardWarning");
    if (warningEl) warningEl.classList.add("hidden");
}

function handleConfirm() {
    if (wizardState.format === "gis") {
        if (wizardState.onConfirm) wizardState.onConfirm(true);
        closeWizard();
        return;
    }

    // Two-step logic for standard parsing
    if (wizardState.step === 1 && wizardState.hasUtm) {
        wizardState.step = 2;
        document.getElementById("wizardStep1").classList.add("hidden");
        document.getElementById("wizardStepUtm").classList.remove("hidden");
        document.getElementById("wizardBackBtn").classList.remove("hidden");
        document.getElementById("wizardFooterUtmToggleGroup").classList.add("hidden");
        document.getElementById("wizardConfirmBtnText").textContent = "Process UTM Data";
        
        // Clear warning on step change
        const warningEl = document.getElementById("wizardWarning");
        if (warningEl) warningEl.classList.add("hidden");

        // Auto-populate UTM Guess if possible
        if (wizardState.previewData && wizardState.previewData.length > 0) {
            const headers = wizardState.previewData[0];
            let headerKeys = Array.isArray(headers) ? headers : Object.keys(headers);
            const guess = guessColumns(headerKeys);
            if (guess.easting && !document.getElementById("wizardEastingCol").value) document.getElementById("wizardEastingCol").value = guess.easting;
            if (guess.northing && !document.getElementById("wizardNorthingCol").value) document.getElementById("wizardNorthingCol").value = guess.northing;
        }

        return; // Break out, wait for next confirm click
    }

    const warning = document.getElementById("wizardWarning");
    const warningText = document.getElementById("wizardWarningText");
    warning.classList.add("hidden");

    // Validation for Step 1 (Lat/Lng) Out-of-bounds
    if (wizardState.step === 1 && !wizardState.hasUtm) {
        const latCol = document.getElementById("wizardLatCol").value;
        const lngCol = document.getElementById("wizardLngCol").value;
        const hasHeaders = document.getElementById("wizardHasHeaders").checked;

        if (latCol && lngCol && wizardState.previewData && wizardState.previewData.length > 0) {

            // Map column names to array indices
            let latIndex = -1;
            let lngIndex = -1;
            const headerRow = hasHeaders ? wizardState.previewData[0] : null;

            if (hasHeaders && headerRow) {
                latIndex = headerRow.indexOf(latCol);
                lngIndex = headerRow.indexOf(lngCol);
            } else {
                if (latCol.startsWith("Column ")) latIndex = parseInt(latCol.replace("Column ", "")) - 1;
                if (lngCol.startsWith("Column ")) lngIndex = parseInt(lngCol.replace("Column ", "")) - 1;
            }

            if (latIndex >= 0 && lngIndex >= 0) {
                let firstRow = null;
                // Start from index 1 if hasHeaders is true, else index 0
                const startIndex = hasHeaders ? 1 : 0;
                for (let i = startIndex; i < Math.min(startIndex + 3, wizardState.previewData.length); i++) {
                    const row = wizardState.previewData[i];
                    if (!row) continue;
                    const latV = parseCoordinate(row[latIndex]);
                    const lngV = parseCoordinate(row[lngIndex]);
                    if (!isNaN(latV) && !isNaN(lngV)) {
                        firstRow = row;
                        break;
                    }
                }
                if (firstRow) {
                    const latVal = parseCoordinate(firstRow[latIndex]);
                    const lngVal = parseCoordinate(firstRow[lngIndex]);
                    if (latVal > 90 || latVal < -90 || lngVal > 180 || lngVal < -180) {
                        warning.classList.remove("hidden");
                        warningText.innerHTML = "<strong>Out of Bounds:</strong> Values exceed valid Latitude (-90 to 90) or Longitude (-180 to 180). Check 'Data has UTM coordinates' if needed.";
                        return; // Prevent import
                    }
                }
            }
        }
    }

    // Validation for Step 2 (UTM Zone)
    if (wizardState.step === 2 && wizardState.hasUtm) {
        const zoneCol = document.getElementById("wizardZoneCol").value;
        const zone = document.getElementById("wizardUtmZone").value.trim().toUpperCase();
        
        if (!zoneCol) {
            const validPattern = /^([1-9]|[1-5][0-9]|60)[NS]$/;
            if (!validPattern.test(zone)) {
                warning.classList.remove("hidden");
                warningText.innerHTML = "<strong>Invalid Global UTM Zone:</strong> Please provide a valid zone (e.g. 18N, 32S) or select a Zone Column.";
                return; // Prevent import
            }
        }
    }

    // Gather Options for CSV/Excel
    const options = {
        format: wizardState.format,
        encoding: document.getElementById("wizardEncoding").value,
        delimiter: document.getElementById("wizardDelimiter").value,
        mergeSpaces: document.getElementById("wizardMergeSpaces").checked,
        hasHeaders: document.getElementById("wizardHasHeaders").checked,
        sheetName: document.getElementById("wizardSheet").value,
        hasUtm: document.getElementById("wizardHasUtm").checked,
        latCol: document.getElementById("wizardLatCol").value,
        lngCol: document.getElementById("wizardLngCol").value,
        utmZone: document.getElementById("wizardUtmZone").value,
        eastingCol: document.getElementById("wizardEastingCol").value,
        northingCol: document.getElementById("wizardNorthingCol").value,
        zoneCol: document.getElementById("wizardZoneCol").value,
    };

    if (wizardState.onConfirm) {
        wizardState.onConfirm(options);
    }
    closeWizard();
}

// --- Preview Logic ---

export function preprocessText(text, delimiter) {
    if (!text || !delimiter) return text;
    if (delimiter === "whitespace") {
        return text.replace(/[ \t]+/g, " ");
    }
    const escaped = delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped + "+", "g");
    return text.replace(regex, delimiter);
}

function handleCSVPreload(file) {
    // Hide Excel UI, Show CSV UI
    document.getElementById("wizardDelimiterGroup").classList.remove("hidden");
    document.getElementById("wizardSheetGroup").classList.add("hidden");

    if (wizardState.delimiter === "whitespace" || (wizardState.mergeSpaces && wizardState.delimiter)) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const delimToPreprocess = wizardState.delimiter === "whitespace" ? "whitespace" : wizardState.delimiter;
            const preprocessed = preprocessText(e.target.result, delimToPreprocess);

            const PapaConfigDelim = wizardState.delimiter === "whitespace" ? " " : wizardState.delimiter;

            Papa.parse(preprocessed, {
                preview: 5,
                delimiter: PapaConfigDelim,
                complete: onCsvPreviewComplete,
                error: onCsvPreviewError
            });
        };
        reader.readAsText(file.slice(0, 1024 * 100), wizardState.encoding);
    } else {
        Papa.parse(file, {
            preview: 5,
            encoding: wizardState.encoding,
            delimiter: wizardState.delimiter || "",
            delimitersToGuess: [',', '\t', '|', ';', ' '],
            complete: onCsvPreviewComplete,
            error: onCsvPreviewError
        });
    }
}

function onCsvPreviewComplete(results) {
    const delimWarning = document.getElementById("wizardDelimiterWarning");
    if (delimWarning) delimWarning.classList.add("hidden");

    // Auto-detect delimiter update UI
    if (results.meta.delimiter) {
        const delimSelect = document.getElementById("wizardDelimiter");
        // Only override the UI if the dropdown is currently set to "Auto-Detect" (value is "").
        if (delimSelect.value === "") {
            // We no longer toggle the warning immediately here, validatePreview will handle it
            if (results.data && results.data.length > 0) {
                // (kept for structure, but removed warning display direct call)
            }

            const validOptions = Array.from(delimSelect.options).map(o => o.value);
            if (validOptions.includes(results.meta.delimiter)) {
                delimSelect.value = results.meta.delimiter;
            } else {
                delimSelect.value = "custom";
                document.getElementById("wizardCustomDelimiter").value = results.meta.delimiter;
                document.getElementById("wizardCustomDelimiterContainer").classList.remove("hidden");
                document.getElementById("wizardMergeSpacesContainer").classList.remove("hidden");
            }
            wizardState.delimiter = results.meta.delimiter;
        }
    }

    wizardState.previewData = results.data;

    // Apply auto-detect override for headers if untouched
    if (!wizardState.userToggledHeaders) {
        wizardState.hasHeaders = guessHasHeaders(results.data);
        document.getElementById("wizardHasHeaders").checked = wizardState.hasHeaders;
    }

    let customHeaders = null;
    let computedHeaders = [];

    if (!wizardState.hasHeaders) {
        let numCols = 0;
        if (results.data && results.data.length > 0) {
            const firstRow = results.data[0];
            numCols = Array.isArray(firstRow) ? firstRow.length : Object.keys(firstRow).length;
        }
        customHeaders = Array.from({ length: numCols }, (_, i) => `Column ${i + 1}`);
        computedHeaders = customHeaders;
    } else {
        computedHeaders = results.data.length > 0 ? (Array.isArray(results.data[0]) ? results.data[0] : Object.keys(results.data[0])) : [];
    }

    renderPreviewTable(results.data, true, customHeaders);
    populateColumnSelectors(computedHeaders);
    checkForUtmNudge(computedHeaders);
}

function onCsvPreviewError(err) {
    showToast("Preview Error: " + err.message, "error");
}

function handleTextPreload(text) {
    if (!text) return;

    // Auto-detect Whitespace if the user pasted raw coordinates (no commas)
    if (wizardState.delimiter === "") {
        const lines = text.trim().split('\n').filter(l => l.trim() !== "");
        if (lines.length > 0 && !lines[0].includes(",")) {
            // If line contains spaces OR tabs, and fits our numeric coordinate heuristic
            if ((lines[0].includes(" ") || lines[0].includes("\t")) && /^[\d\.\-\+eE\s\t]+$/.test(lines[0])) {
                wizardState.delimiter = "whitespace";
                document.getElementById("wizardDelimiter").value = "whitespace";
            }
        }
    }

    let processText = text;
    if (wizardState.delimiter === "whitespace") {
        processText = preprocessText(text, "whitespace");
    } else if (wizardState.mergeSpaces && wizardState.delimiter) {
        processText = preprocessText(text, wizardState.delimiter);
    }

    const PapaConfigDelim = wizardState.delimiter === "whitespace" ? " " : (wizardState.delimiter || "");

    const results = Papa.parse(processText, {
        preview: 5,
        delimiter: PapaConfigDelim,
        delimitersToGuess: [',', '\t', '|', ';', ' '],
    });

    onCsvPreviewComplete(results);
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
    wizardState.previewData = snippet;

    if (!wizardState.userToggledHeaders) {
        wizardState.hasHeaders = guessHasHeaders(snippet);
        document.getElementById("wizardHasHeaders").checked = wizardState.hasHeaders;
    }

    let customHeaders = null;
    let computedHeaders = [];

    if (!wizardState.hasHeaders) {
        let numCols = 0;
        if (snippet && snippet.length > 0) {
            numCols = snippet[0].length;
        }
        customHeaders = Array.from({ length: numCols }, (_, i) => `Column ${i + 1}`);
        computedHeaders = customHeaders;
    } else {
        computedHeaders = snippet.length > 0 ? snippet[0] : [];
    }

    renderPreviewTable(snippet, true, customHeaders);
    populateColumnSelectors(computedHeaders);
    checkForUtmNudge(computedHeaders);
}

function updatePreview() {
    // If CSV, re-parse with new delimiter/encoding
    if (wizardState.format === "csv") {
        if (wizardState.file) {
            handleCSVPreload(wizardState.file);
        } else if (wizardState.text) {
            handleTextPreload(wizardState.text);
        }
    }
}

function renderPreviewTable(data, isArrayMode = false, customHeaders = null) {
    const tableHead = document.querySelector("#wizardPreviewTable thead");
    const tableBody = document.querySelector("#wizardPreviewTable tbody");
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    if (!data || data.length === 0) {
        document.getElementById("wizardPreviewEmpty").classList.remove("hidden");
        return;
    }
    document.getElementById("wizardPreviewEmpty").classList.add("hidden");

    let headers = customHeaders;
    let rowsToRender = data;

    if (!headers) {
        headers = isArrayMode ? data[0] : Object.keys(data[0]);
        rowsToRender = isArrayMode ? data.slice(1) : data;
    }

    // Headers
    const headerRow = document.createElement("tr");
    headers.forEach((h) => {
        const th = document.createElement("th");
        th.className =
            "px-4 py-2 bg-gray-50 text-left text-xs font-medium text-gray-500 border-b";
        th.textContent = h;
        headerRow.appendChild(th);
    });
    tableHead.appendChild(headerRow);

    // Rows
    rowsToRender.forEach((row) => {
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

    validatePreview(data, headers);
}

function validatePreview(data, computedHeaders) {
    const confirmBtn = document.getElementById("wizardConfirmBtn");
    const warningEl = document.getElementById("wizardDelimiterWarning");
    const warningText = warningEl.querySelector("span");

    let numCols = computedHeaders ? computedHeaders.length : 0;

    // Rule 1: Must have >= 2 columns
    if (numCols < 2) {
        warningEl.classList.remove("hidden");
        warningText.textContent = "Cannot proceed. Please select the correct delimiter to split your data into at least 2 columns.";
        confirmBtn.disabled = true;
        return;
    }

    // Rule 2: If headers are OFF, but row 1 looks completely like non-numeric text
    if (!wizardState.hasHeaders && data && data.length > 0) {
        const firstRow = data[0];
        const cells = Array.isArray(firstRow) ? firstRow : Object.values(firstRow);
        // Clean out spaces to just check if characters are present
        const numericCells = cells.filter(c => /^[\d\.\-\+eE\s\t]+$/.test(String(c).trim())).length;
        if (numericCells < 2) {
            warningEl.classList.remove("hidden");
            warningText.textContent = "Validation Warning: Row 1 contains text. If your data has a header row, please check the 'My data has a header row' box below to avoid mapping text as coordinates.";
            // Don't hard-block, but show the severe warning
            confirmBtn.disabled = false;
            return;
        }
    }

    // All clear
    warningEl.classList.add("hidden");
    confirmBtn.disabled = false;
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
        "wizardZoneCol"
    ];
    
    selects.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = "";
        
        if (id === "wizardZoneCol") {
            const defaultOpt = document.createElement("option");
            defaultOpt.value = "";
            defaultOpt.textContent = "-- Use Global --";
            el.appendChild(defaultOpt);
        }
        
        headers.forEach((h) => el.appendChild(createOpt(h)));
    });

    // Auto-Guess
    const guess = guessColumns(headers);

    // Set Lat/Lon defaults
    if (guess.lat) document.getElementById("wizardLatCol").value = guess.lat;
    if (guess.lng) document.getElementById("wizardLngCol").value = guess.lng;

    // Set UTM defaults
    if (guess.easting) document.getElementById("wizardEastingCol").value = guess.easting;
    if (guess.northing) document.getElementById("wizardNorthingCol").value = guess.northing;
    if (guess.zone) document.getElementById("wizardZoneCol").value = guess.zone;
}

function guessColumns(headers) {
    const safeLat = /latitude/i;
    const safeLng = /longitude/i;
    const riskyLat = /(^|[^a-z])(lat|y)($|[^a-z])/i;
    const riskyLng = /(^|[^a-z])(lng|lon|long|x)($|[^a-z])/i;

    const utmEast = /easting|utm_e|^x$|utm_x|^e$/i;
    const utmNorth = /northing|utm_n|^y$|utm_y|^n$/i;
    const utmZoneRe = /zone|^z$|utm_z/i;

    let latCol =
        headers.find((h) => safeLat.test(h)) ||
        headers.find((h) => riskyLat.test(h));
    let lngCol =
        headers.find((h) => safeLng.test(h)) ||
        headers.find((h) => riskyLng.test(h));

    let eastCol = headers.find((h) => utmEast.test(h));
    let northCol = headers.find((h) => utmNorth.test(h));
    let zoneCol = headers.find((h) => utmZoneRe.test(h));

    return { lat: latCol, lng: lngCol, easting: eastCol, northing: northCol, zone: zoneCol };
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
            "Data contains UTM coordinates!?. Toggle `Data has UTM coordinates` at the bottom!";
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
        const inputEl = document.getElementById("wizardUtmZone");
        inputEl.value = wizardState.tempZone;
        inputEl.dispatchEvent(new Event("input"));
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

    // Base Layer
    L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
        {
            opacity: 1.0,
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
