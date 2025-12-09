/**
 * Export Utilities Module
 * Handles conversion of data to various GIS formats (GeoJSON, KML, KMZ, Shapefile).
 */

/**
 * Downloads a Blob object as a file.
 * @param {Blob} blob - The blob to download.
 * @param {string} filename - The name of the file.
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Converts internal point data to a GeoJSON FeatureCollection.
 * @param {Array} points - Array of point objects from state.
 * @returns {Object} GeoJSON FeatureCollection.
 */
export function generateGeoJSON(points) {
    const features = points.map(p => {
        // Create properties object excluding internal keys if necessary, 
        // but for now we just pass everything effectively.
        // We ensure lat/lng are numbers for the geometry.
        const lat = parseFloat(p.lat);
        const lng = parseFloat(p.lng);

        // Clone properties to avoid mutating original state
        const properties = { ...p };

        // Remove lat/lng from properties if desired, but keeping them is fine for CSV/Table parity.
        return {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [lng, lat] // GeoJSON is [lng, lat]
            },
            properties: properties
        };
    });

    return {
        type: "FeatureCollection",
        features: features
    };
}

/**
 * Generates a KML string from GeoJSON.
 * @param {Object} geoJSON - The GeoJSON object.
 * @returns {string} KML string.
 */
export function generateKML(geoJSON) {
    if (!window.tokml) {
        throw new Error("tokml library not loaded");
    }
    return window.tokml(geoJSON);
}

/**
 * Generates a KMZ blob (Zipped KML).
 * @param {string} kmlString - The KML content.
 * @returns {Promise<Blob>} Promise resolving to the KMZ blob.
 */
export async function generateKMZ(kmlString) {
    if (!window.JSZip) {
        throw new Error("JSZip library not loaded");
    }
    const zip = new window.JSZip();
    zip.file("doc.kml", kmlString);
    return await zip.generateAsync({ type: "blob" });
}

/**
 * Generates a Shapefile (Zipped) blob.
 * @param {Object} geoJSON - The GeoJSON object.
 * @returns {Promise<Blob>} Promise resolving to the Shapefile zip blob.
 */
export async function generateShapefile(geoJSON) {
    if (!window.shpwrite) {
        throw new Error("shp-write library not loaded. Please refresh the page.");
    }



    // Explicit options are often required for shp-write to know what to output
    const options = {
        folder: 'shapefiles',
        types: {
            point: 'points',
            polygon: 'polygons',
            line: 'lines'
        }
    };

    // Use .zip() to get the JSZip object directly, giving us control over the download
    // Note: shpwrite.zip returns a Promise that resolves to a BASE64 STRING in this version.
    const base64 = await window.shpwrite.zip(geoJSON, options);

    // Convert Base64 string to Blob
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/zip' });

    return blob;
}
