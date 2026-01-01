
import fs from 'fs';
import path from 'path';

const outDir = 'Tests/Input';
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// UTM Sample (Zone 18N - New Yorkish)
// 40.7128° N, 74.0060° W -> UTM Zone 18N
// Easting: ~583960, Northing: ~4507520
const utmCsv = `name,utm_zone,utm_easting,utm_northing,desc
Point A,18N,583960,4507520,Statue of Liberty approx
Point B,18N,584000,4508000,Slightly North`;

fs.writeFileSync(path.join(outDir, 'sample_utm.csv'), utmCsv);
console.log('Created sample_utm.csv');
