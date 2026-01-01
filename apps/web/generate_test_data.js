
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// UPDATED: Targeting 'Tests/Input' as per user expectation
const baseDir = path.join(__dirname, 'Tests', 'Input');

// Ensure base directories exist
const folders = ['01_File_Types', '02_Data_Types', '03_Special_Cases'];
folders.forEach(f => {
    const p = path.join(baseDir, f);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// --- Data Source: City Capitals ---
const cities = [
    { city: "Tokyo", lat: 35.6762, lng: 139.6503, country: "Japan" },
    { city: "New York", lat: 40.7128, lng: -74.0060, country: "USA" },
    { city: "London", lat: 51.5074, lng: -0.1278, country: "UK" },
    { city: "Paris", lat: 48.8566, lng: 2.3522, country: "France" },
    { city: "Sydney", lat: -33.8688, lng: 151.2093, country: "Australia" }
];

// --- Helper Functions ---
function writeCSV(filePath, data, delimiter = ',') {
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => row[h]).join(delimiter));
    fs.writeFileSync(filePath, [headers.join(delimiter), ...rows].join('\n'));
}

function writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function writeExcel(filePath, data) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cities");
    XLSX.writeFile(wb, filePath);
}

function writeKML(filePath, data) {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    ${data.map(d => `
    <Placemark>
      <name>${d.city}</name>
      <description>${d.country}</description>
      <Point>
        <coordinates>${d.lng},${d.lat}</coordinates>
      </Point>
    </Placemark>`).join('')}
  </Document>
</kml>`;
    fs.writeFileSync(filePath, kml);
}

function writeGeoJSON(filePath, data) {
    const geojson = {
        type: "FeatureCollection",
        features: data.map(d => ({
            type: "Feature",
            properties: { name: d.city, country: d.country },
            geometry: {
                type: "Point",
                coordinates: [d.lng, d.lat]
            }
        }))
    };
    fs.writeFileSync(filePath, JSON.stringify(geojson, null, 2));
}

// --- 01_File_Types ---
const dir1 = path.join(baseDir, '01_File_Types');
writeCSV(path.join(dir1, 'cities.csv'), cities);
writeCSV(path.join(dir1, 'cities.tsv'), cities, '\t');
writeCSV(path.join(dir1, 'cities.txt'), cities); // Text file as CSV
writeJSON(path.join(dir1, 'cities.json'), cities);
writeGeoJSON(path.join(dir1, 'cities.geojson'), cities);
writeKML(path.join(dir1, 'cities.kml'), cities);
writeExcel(path.join(dir1, 'cities.xlsx'), cities);

// --- 02_Data_Types ---
const dir2 = path.join(baseDir, '02_Data_Types');

// Missing Headers (just data)
const rowsNoHeader = cities.map(d => `${d.city},${d.lat},${d.lng},${d.country}`).join('\n');
fs.writeFileSync(path.join(dir2, 'missing_headers.csv'), rowsNoHeader);

// Missing Columns (No Lat/Lng)
const citiesNoCoords = cities.map(({ city, country }) => ({ city, country }));
writeCSV(path.join(dir2, 'missing_columns.csv'), citiesNoCoords);

// UTM Coordinates (Approx for Tokyo/NY)
const utmCities = [
    { city: "Tokyo", zone: "54N", easting: 377827, northing: 3948943 }, // Approx
    { city: "New York", zone: "18N", easting: 583960, northing: 4507520 }
];
writeCSV(path.join(dir2, 'utm_coords.csv'), utmCities);

// Text Only (No geom, unstructured)
fs.writeFileSync(path.join(dir2, 'text_only.txt'), "Just some random text notes.\nMeeting at 5pm.\nNo coordinates here.");

// Invalid Coords
const invalidCities = [
    { city: "Nowhere", lat: "invalid", lng: 100 },
    { city: "Lost", lat: 50, lng: "unknown" }
];
writeCSV(path.join(dir2, 'invalid_coords.csv'), invalidCities);

// --- 03_Special_Cases ---
const dir3 = path.join(baseDir, '03_Special_Cases');

// Encoding
writeCSV(path.join(dir3, 'encoding_utf8.csv'), cities);

// Unsupported Binary (Dummy)
fs.writeFileSync(path.join(dir3, 'unsupported_binary.bin'), Buffer.from([0x00, 0x01, 0x02, 0x03]));


// --- 04_GIS_Validation ---
// Purpose: Test "Points Only" constraint. Should reject lines/polygons.
const dir4 = path.join(baseDir, '04_GIS_Validation');
if (!fs.existsSync(dir4)) fs.mkdirSync(dir4, { recursive: true });

// 1. Lines Only (GeoJSON)
const linesGeoJSON = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: { name: "Line 1" },
            geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] }
        }
    ]
};
fs.writeFileSync(path.join(dir4, 'lines_only.geojson'), JSON.stringify(linesGeoJSON, null, 2));

// 2. Polygons Only (GeoJSON)
const polyGeoJSON = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: { name: "Poly 1" },
            geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }
        }
    ]
};
fs.writeFileSync(path.join(dir4, 'polygons_only.geojson'), JSON.stringify(polyGeoJSON, null, 2));

// 3. Mixed Geometries (GeoJSON) - Should import 1 point, reject 1 line
const mixedGeoJSON = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: { name: "Valid Point" },
            geometry: { type: "Point", coordinates: [139.6503, 35.6762] } // Tokyo
        },
        {
            type: "Feature",
            properties: { name: "Invalid Line" },
            geometry: { type: "LineString", coordinates: [[0, 0], [10, 10]] }
        }
    ]
};
fs.writeFileSync(path.join(dir4, 'mixed_geometries.geojson'), JSON.stringify(mixedGeoJSON, null, 2));

// 4. Mixed Geometries (KML)
const mixedKML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Valid Point</name>
      <Point><coordinates>139.6503,35.6762</coordinates></Point>
    </Placemark>
    <Placemark>
      <name>Invalid Line</name>
      <LineString>
        <coordinates>0,0 1,1</coordinates>
      </LineString>
    </Placemark>
    <Placemark>
       <name>Invalid Polygon</name>
       <Polygon>
         <outerBoundaryIs>
           <LinearRing>
             <coordinates>
               0,0 10,0 10,10 0,10 0,0
             </coordinates>
           </LinearRing>
         </outerBoundaryIs>
       </Polygon>
     </Placemark>
  </Document>
</kml>`;
fs.writeFileSync(path.join(dir4, 'mixed_geometries.kml'), mixedKML);

console.log("Test Data Generated in " + baseDir);
