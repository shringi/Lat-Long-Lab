
console.log("DATA.JS LOADED");

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

        // Auto-switch to process tab to guide user
        setTimeout(() => {
            App.switchTab('process');
        }, 500);
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
