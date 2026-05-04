import * as turf from '@turf/turf';

console.log("Turf test running...");

const points = [
  { _lng: -74.006, _lat: 40.7128 },
  { _lng: -0.1276, _lat: 51.5072 }
];

const center = [-74.006, 40.7128];
const radius = 1000 / 1000; // 1 km
const geojson = turf.circle(center, radius, { steps: 64, units: 'kilometers' });

const filtered = points.filter((p) => {
  const pt = turf.point([p._lng, p._lat]);
  return turf.booleanPointInPolygon(pt, geojson);
});

console.log("Filtered points count:", filtered.length);
console.log("Success if count is 1.");
