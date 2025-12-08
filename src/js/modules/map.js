
import { state } from '../core/state.js';

console.log("MAP MODULE LOADED");

let map;
let drawnItems;
let layerGroup;
let onSelectionChanged = null;

export function setSelectionCallback(callback) {
    onSelectionChanged = callback;
}

export function initMap() {
    console.log('Map Module: initMap starting...');
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
        if (state.isFilteringEnabled) {
            filterPointsInBounds(layer.getBounds());
        }
    });

    map.on(L.Draw.Event.DELETED, function () {
        if (state.isFilteringEnabled) {
            state.filteredPoints = [];
            if (onSelectionChanged) onSelectionChanged();
        }
    });

    console.log('Map Module: initMap completed.');
    return map;
}

export function plotPoints(dataOverride) {
    const pointsToPlot = dataOverride || (state.isFilteringEnabled ? state.filteredPoints : state.allPoints);
    console.log('Map Module: plotPoints called. Points to plot:', pointsToPlot ? pointsToPlot.length : 'undefined');

    if (layerGroup) {
        layerGroup.clearLayers();
    } else {
        console.warn("layerGroup not initialized, cannot plot points");
        return;
    }

    if (!pointsToPlot || !Array.isArray(pointsToPlot)) {
        console.error('App.plotPoints: Invalid data provided', pointsToPlot);
        return;
    }

    pointsToPlot.forEach(point => {
        // Ensure we have coordinates
        if (point._lat === undefined || point._lng === undefined) {
            return;
        }

        // SECURITY FIX: Use DOM elements instead of string concatenation to prevent XSS
        const container = document.createElement('div');
        container.className = 'text-xs';
        const table = document.createElement('table');
        table.className = 'table-auto';

        for (const [key, value] of Object.entries(point)) {
            if (!key.startsWith('_')) {
                const tr = document.createElement('tr');

                const tdKey = document.createElement('td');
                tdKey.className = 'font-bold pr-2';
                tdKey.textContent = key + ':';

                const tdValue = document.createElement('td');
                tdValue.textContent = value; // Safe: textContent escapes HTML

                tr.appendChild(tdKey);
                tr.appendChild(tdValue);
                table.appendChild(tr);
            }
        }
        container.appendChild(table);

        L.circleMarker([point._lat, point._lng], {
            radius: 4,
            fillColor: "#3b82f6",
            color: "#fff",
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        })
            .bindPopup(container) // Leaflet accepts DOM nodes
            .addTo(layerGroup);
    });

    if (pointsToPlot.length > 0 && map) {
        const bounds = L.latLngBounds(pointsToPlot.map(p => [p._lat, p._lng]));
        map.fitBounds(bounds);
    }
}

export function filterPointsInBounds(bounds) {
    if (!state.isFilteringEnabled) return;
    state.filteredPoints = state.allPoints.filter(p => {
        const latLng = L.latLng(p._lat, p._lng);
        return bounds.contains(latLng);
    });
    if (onSelectionChanged) onSelectionChanged();
}

export function getDrawnItems() {
    return drawnItems;
}

export function invalidateMapSize() {
    if (map) map.invalidateSize();
}


