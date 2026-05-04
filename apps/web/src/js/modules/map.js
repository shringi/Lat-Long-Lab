import { state } from "../core/state.js";
import L from "leaflet";
import * as turf from "@turf/turf";

console.log("MAP MODULE LOADED");

let map;
let drawnItems;
let layerGroup;
let pendingFilterLayer = null;
let onSelectionChanged = null;

export function setSelectionCallback(callback) {
  onSelectionChanged = callback;
}

export function initMap() {
  console.log("Map Module: initMap starting...");
  map = L.map("map").setView([20, 0], 2);
  const osm = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  );
  const satellite = L.tileLayer.provider("Esri.WorldImagery");
  const topo = L.tileLayer.provider("OpenTopoMap");
  const dark = L.tileLayer.provider("CartoDB.DarkMatter");

  // Default to Satellite
  satellite.addTo(map);

  const baseMaps = {
    OpenStreetMap: osm,
    "Satellite (Esri)": satellite,
    Topographic: topo,
    "Dark Mode": dark,
  };

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);
  layerGroup = L.layerGroup().addTo(map);

  const overlayMaps = {
    Points: layerGroup,
  };

  L.control.layers(baseMaps, overlayMaps).addTo(map);

  // Initialize Geoman Controls
  map.pm.addControls({
    position: "topleft",
    drawCircle: true,
    drawCircleMarker: false,
    drawMarker: false,
    drawPolyline: false,
    drawText: false,
    cutPolygon: true,
    rotateMode: true,
    drawPolygon: true,
    drawRectangle: true,
    editMode: true,
    dragMode: true,
    removalMode: true,
  });

  map.pm.setPathOptions({
    color: "#4f46e5",
    weight: 2,
  });

  // Handle new shapes (Draw but do not apply filter yet)
  map.on("pm:create", function (e) {
    drawnItems.eachLayer((l) => l.remove());
    drawnItems.clearLayers();

    pendingFilterLayer = e.layer;
    drawnItems.addLayer(pendingFilterLayer);

    // Notify UI that a shape is ready to be applied
    if (onSelectionChanged) onSelectionChanged("ready");
  });

  // Handle cut operations (Geoman replaces the original layer with a new one)
  map.on("pm:cut", function (e) {
    if (pendingFilterLayer === e.originalLayer) {
      drawnItems.removeLayer(e.originalLayer);
      pendingFilterLayer = e.layer;
      drawnItems.addLayer(pendingFilterLayer);
    }
  });

  // Handle shape removal
  map.on("pm:remove", function (e) {
    if (drawnItems.hasLayer(e.layer)) {
      drawnItems.removeLayer(e.layer);
      
      // Only clear UI if this was an explicit user deletion, 
      // not a programmatic removal during "Apply Filter"
      if (pendingFilterLayer === e.layer) {
        pendingFilterLayer = null;
        if (onSelectionChanged) onSelectionChanged("cleared");
      }
    }
  });

  console.log("Map Module: initMap completed.");
  return map;
}

export function plotPoints(dataOverride, fitBounds = true) {
  const pointsToPlot =
    dataOverride ||
    (state.isFilteringEnabled ? state.filteredPoints : state.allPoints);
  console.log(
    "Map Module: plotPoints called. Points to plot:",
    pointsToPlot ? pointsToPlot.length : "undefined",
  );

  if (layerGroup) {
    layerGroup.clearLayers();
  } else {
    console.warn("layerGroup not initialized, cannot plot points");
    return;
  }

  if (!pointsToPlot || !Array.isArray(pointsToPlot)) {
    console.error("App.plotPoints: Invalid data provided", pointsToPlot);
    return;
  }

  pointsToPlot.forEach((point) => {
    // Ensure we have coordinates
    if (point._lat === undefined || point._lng === undefined) {
      return;
    }

    // SECURITY FIX: Use DOM elements instead of string concatenation to prevent XSS
    const container = document.createElement("div");
    container.className = "text-xs max-w-[300px] overflow-x-auto custom-scrollbar";
    const table = document.createElement("table");
    table.className = "w-full min-w-max text-left border-collapse";

    for (const [key, value] of Object.entries(point)) {
      if (!key.startsWith("_")) {
        const tr = document.createElement("tr");

        const tdKey = document.createElement("td");
        tdKey.className = "font-bold pr-3 py-1 border-b border-gray-100 align-top text-gray-700 whitespace-nowrap";
        tdKey.textContent = key + ":";

        const tdValue = document.createElement("td");
        tdValue.className = "py-1 border-b border-gray-100 break-words text-gray-900";
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
      fillOpacity: 0.8,
    })
      .bindPopup(container, {
          autoPan: false,
          maxHeight: 250,
          maxWidth: 320
      })
      .addTo(layerGroup);
  });

  if (fitBounds && pointsToPlot.length > 0 && map) {
    const bounds = L.latLngBounds(pointsToPlot.map((p) => [p._lat, p._lng]));
    map.fitBounds(bounds);
  }
}

export function triggerSpatialFilter() {
  if (!pendingFilterLayer) return;

  state.isFilteringEnabled = true;
  
  let geojson;
  try {
    if (pendingFilterLayer instanceof L.Circle) {
      const center = [pendingFilterLayer.getLatLng().lng, pendingFilterLayer.getLatLng().lat];
      const radius = pendingFilterLayer.getRadius() / 1000; // Turf uses kilometers
      geojson = turf.circle(center, radius, { steps: 64, units: 'kilometers' });
    } else {
      geojson = pendingFilterLayer.toGeoJSON();
    }

    state.filteredPoints = state.allPoints.filter((p) => {
      // Validate coordinates before passing to Turf
      if (isNaN(p._lng) || isNaN(p._lat)) return false;
      const pt = turf.point([p._lng, p._lat]);
      return turf.booleanPointInPolygon(pt, geojson);
    });
  } catch (error) {
    console.error("Spatial Filtering Error:", error);
    // If Turf fails, default to all points and disable filtering
    state.isFilteringEnabled = false;
    state.filteredPoints = [...state.allPoints];
  } finally {
    // ALWAYS remove the drawn shape from map to avoid zombie layers
    const layerToRemove = pendingFilterLayer;
    pendingFilterLayer = null; // Nullify before removal to prevent pm:remove loop

    if (drawnItems && layerToRemove) {
      drawnItems.removeLayer(layerToRemove);
    }
    if (layerToRemove) {
      layerToRemove.remove();
    }
  }

  if (onSelectionChanged) onSelectionChanged("applied");
  plotPoints(null, false);
}

export function resetSpatialFilter() {
  state.isFilteringEnabled = false;
  state.filteredPoints = [...state.allPoints];

  if (pendingFilterLayer) {
    pendingFilterLayer.remove();
    pendingFilterLayer = null;
  }

  if (onSelectionChanged) onSelectionChanged("reset");
  plotPoints(null, false);
}


export function invalidateMapSize() {
  if (map) map.invalidateSize();
}
