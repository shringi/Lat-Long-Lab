# Geo-Filter & Enrich

**Geo-Filter & Enrich** is a powerful, client-side web application designed to visualize, filter, and enrich geographic data directly in your browser. It processes data locally, ensuring privacy and speed without requiring a backend server.

## 🚀 Features

*   **Data Loading:**
    *   Upload **CSV**, **Excel (.xlsx, .xls)**, or **JSON** files.
    *   Paste data directly or fetch from a URL.
    *   Automatic column mapping for Latitude and Longitude.
*   **Interactive Map:**
    *   Visualize thousands of points on a responsive map.
    *   Switch between **Satellite**, **Topographic**, and **Dark** basemaps.
    *   **Draw Rectangles** to spatially filter data.
*   **Data Enrichment:**
    *   **Offline Geocoding:** Automatically tag points with their **Country** name based on coordinates.
    *   Uses a local GeoJSON dataset for instant results.
*   **Data Management:**
    *   **Flexible Views:** Toggle between Map-only, Split-view, or Modal-view for the data table.
    *   **Search & Sort:** Powerful data grid with search and sort capabilities.
    *   **Export:** Download your filtered and enriched data as a CSV file.

## 🛠️ Setup & Usage

This application is built with **Vanilla JavaScript** and relies on **CDNs** for dependencies. No build step is required.

1.  **Download:** Clone or download this repository.
2.  **Run:** Open `index.html` in any modern web browser (Chrome, Firefox, Edge).

## 📦 Dependencies

All dependencies are loaded via CDN:

*   **Leaflet:** Interactive maps.
*   **Leaflet Draw:** Drawing tools for filtering.
*   **Leaflet Providers:** Various map tiles (Satellite, Topo, etc.).
*   **Turf.js:** Geospatial analysis (point-in-polygon).
*   **PapaParse:** Fast CSV parsing.
*   **SheetJS (XLSX):** Excel file parsing.
*   **Grid.js:** Advanced data table.
*   **Tailwind CSS:** Utility-first styling.

## 📝 License

Open Source. Feel free to modify and use for your projects.
