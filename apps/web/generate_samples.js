
import fs from 'fs';
import * as XLSX from 'xlsx';
import path from 'path';

const outDir = 'Tests/Input';
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// 1. Multi-sheet Excel (Data on Sheet 2)
function createMultiSheetExcel() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Metadata / Instructions (should be ignored or handled gracefully if we only read sheet 1)
    const ws1 = XLSX.utils.aoa_to_sheet([["Instructions", "Go to Sheet 2 for Data"], ["Note", "This sheet has no points"]]);
    XLSX.utils.book_append_sheet(wb, ws1, "Instructions");

    // Sheet 2: Actual Data
    const data = [
        ["name", "latitude", "longitude", "info"],
        ["Hidden Gem", 45.0, 5.0, "On Sheet 2"],
        ["Secret Base", -70.0, 0.0, "Deep South"]
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws2, "DataPoints");

    XLSX.writeFile(wb, path.join(outDir, 'sample_multisheet.xlsx'));
    console.log('Created sample_multisheet.xlsx');
}

// 2. Semicolon Separated
function createSemicolonCSV() {
    const content = `id;name;lat;lng;desc\n1;Paris;48.8566;2.3522;City of Lights\n2;Berlin;52.5200;13.4050;Techno Capital`;
    fs.writeFileSync(path.join(outDir, 'sample_semicolon.csv'), content);
    console.log('Created sample_semicolon.csv');
}

// 3. Pipe Separated
function createPipeCSV() {
    const content = `id|name|lat|lng|desc\n1|Mumbai|19.0760|72.8777|Gateway\n2|Delhi|28.7041|77.1025|Capital`;
    fs.writeFileSync(path.join(outDir, 'sample_pipe.csv'), content);
    console.log('Created sample_pipe.csv');
}

// 4. Tab Separated
function createTabTSV() {
    const content = `id\tname\tlat\tlng\tdesc\n1\tTokyo\t35.6762\t139.6503\tBusy\n2\tOsaka\t34.6937\t135.5023\tFood`;
    fs.writeFileSync(path.join(outDir, 'sample_tab.tsv'), content); // extension .tsv helps, but we want to test .csv extension with tabs too maybe? let's stick to tsv for clarity first
    fs.writeFileSync(path.join(outDir, 'sample_tab_named_csv.csv'), content);
    console.log('Created sample_tab.tsv and sample_tab_named_csv.csv');
}

createMultiSheetExcel();
createSemicolonCSV();
createPipeCSV();
createTabTSV();
