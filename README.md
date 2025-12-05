# Lat-Long Lab

![Lat-Long Lab](icons/logo_192.png)

**A super light, privacy focused web app for a quick latitude-longitude visualization and data filtering.**

https://shringi.github.io/Lat-Long-Lab/

Current Version: 1.2.0

Last Updated on: 2025-Dec-05

## Motivation

We often encounter datasets containing latitude and longitude points along with various associated columns. The need to quickly visualize and locate these points is common. Frequently, the goal is to filter this data for a specific country, a selected area, or by a specific property.

Researchers and analysts often deal with supplementary materials from publications and need to filter data for particular regions. While tools like R, Python, or QGIS are powerful, they can be overkill for quick visualization and filtering tasks, often requiring code execution or heavy software loading.

**Lat-Long Lab** was created to bridge this gap. It is a tool that:
- **Does not depend on any server or API calls.**
- **Fast and Responsive** (performance depends only on your browser).
- **Runs entirely on the client-side**, ensuring data privacy and ease of use.

## Features
![Screenshot](icons/screenshot_v1.0.2.png)
- **Versatile Data Loading**:
    - Upload **CSV, Excel (.xlsx, .xls), or TXT** files.
    - **Paste** data directly from your clipboard.
    - **Fetch** data from a URL (CSV/JSON).
- **Interactive Mapping**:
    - Visualize thousands of points instantly on a Leaflet map.
    - Switch between different basemaps (OpenStreetMap, Satellite, etc.).
- **Geographic Filtering**:
    - Draw a **rectangular area** on the map to select specific points.
    - Filter your dataset to include only points within the selected region.
- **Data Inspection**:
    - View your data in a powerful, sortable, and searchable table (powered by DataTables).
    - Toggle between Map View, Split View, and Table View.
- **Export**:
    - Download your filtered or enriched dataset as a CSV file.
- **Privacy-First**:
    - 100% Client-side processing. Your data never leaves your browser.

## Usage Instructions

### 1. Load Your Data
You have three options to get your data into the lab:
- **Upload File**: Click the upload box to select a `.csv`, `.xlsx`, or `.txt` file from your computer.
- **Paste Data**: Copy your raw data (CSV format) and paste it into the text area, then click "Load Pasted Data".
- **Fetch from URL**: Enter a direct link to a CSV or JSON file and click "Fetch".

*Note: The application will attempt to automatically detect `Latitude` and `Longitude` columns. If it can't, you will be prompted to map them manually.*

### 2. Explore the Map
- Once loaded, your points will appear as markers on the map.
- Use the **Layer Control** (top-right) to change the base map style.
- Click on individual clusters to zoom in and see individual points.

### 3. Filter by Area
1.  Use the **Draw Tools** on the map (toolbar on the left).
2.  Select the **Rectangle** tool.
3.  Draw a box around the area of interest.
4.  In the sidebar, toggle **"Filter by Map Selection"**.
5.  The "Selected Points" count will update to show how many points are inside your box.

### 4. View and Export
- Click **"Show Data Table"** (or use the view controls at the top) to inspect the raw data.
- If you have filtered the data, the table will reflect the selection.
- Click **"Download CSV"** in the sidebar or the table view to save your processed dataset.

## Reporting Bugs & Feature Requests

We welcome feedback! If you encounter any issues or have ideas for new features:

1.  Navigate to the **[Issues](https://github.com/YOUR_USERNAME/Lat-Long-Lab/issues)** tab of this repository.
2.  Click **"New Issue"**.
3.  Choose **"Bug Report"** or **"Feature Request"**.
4.  Provide as much detail as possible (browser version, steps to reproduce, screenshots).

## Credits
Built with open-source power:
- [Leaflet](https://leafletjs.com/)
- [DataTables](https://datatables.net/)
- [Tailwind CSS](https://tailwindcss.com/)
- [PapaParse](https://www.papaparse.com/)
- [SheetJS](https://sheetjs.com/)
- [Turf.js](https://turfjs.org/)
