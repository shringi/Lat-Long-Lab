# Product Roadmap: Lat-Long-Lab

**Current Version:** v1.5.1 (Offline-First PWA)

This document outlines the development trajectory of Lat-Long-Lab. It serves as a guide for users and developers to understand the current capabilities and keeping track of upcoming features.

## 📝 User Feedback & Review
<!-- 
  Add your comments, priority adjustments, or new requests here.
  The agent will review this section to update the development plan.
-->
> [!NOTE]
> This roadmap is a living document. Please edit this file directly to adjust priorities or add notes for the developer.

---

## 📍 Current Status: "The Foundation"
*Stable & Production Ready*

We have successfully transitioned from a static website to a standalone **Progressive Web App (PWA)**.
- **Offline Capability**: Works entirely without internet access.
- **Privacy Focused**: All data processing happens on your device (Client-Side).
- **Core Formats**: robust CSV and basic Excel support.
- **Visuals**: Clustering maps with Leaflet.
- **Export**: Validated KML, KMZ, GeoJSON, and Shapefile generation.

---

## 🚀 Upcoming Milestones

### Phase 1: Robust Data Import (In Progress)
*Goal: "Never fail to load a valid file."*

Currently, loading files is "all-or-nothing". We are building an **Import Wizard** to handle complexities gracefully.
- [ ] **Intermediate Import Dialog**: Preview data before loading.
- [ ] **Excel Sheet Selector**: Choose specific sheets from multi-sheet workbooks.
- [ ] **Smart Delimiter Handling**: Visually confirm or override CSV separators (Comma, Tab, Pipe, Semicolon).
- [ ] **Encoding Support**: Handle non-UTF-8 files (Legacy Windows/Mac formats) to prevent Mojibake.

### Phase 2: Robust UTM Support
- [ ] **UTM Import Support**: Detect if the data has UTM coordinates instead of lat/lng. Convert to lat/lng while importing, and append the coordinates as new columns.
  - [ ] If the data has UTM coordinates, look for the addtional zone column, and smartly handle the zones.
  - [ ] If the data doesn't have utm zone column, ask user to enter the utm zone, show a small model to either click and select/ if user has already input the utm zone then show on the model map where they think thier utm zone is. Here warn user that all the points are coming from the same utm zone, otherwise suggest user to manually add another utm zone column.

### Phase 3: Advanced GIS Integration
*Goal: "A true GIS pocket-knife."*

Expand native support for standard GIS file types beyond just export.
- [ ] **Native KML/KMZ Import**: Drag & drop Google Earth files directly onto the map.
- [ ] **GeoJSON Import**: Load complex polygon/line features, not just points.
- [ ] **Shapefile Import**: Support for zipped `.shp` archives.
- [ ] **Drag-and-Drop Layering**: Manage multiple imported files as distinct map layers.

### Phase 4: Performance & Scalability
*Goal: "Handle 100k+ points smoothly."*

Move heavy computational logic off the main thread to keep the UI buttery smooth.
- [ ] **Web Workers**: Move Parsing (`PapaParse`) and Geometry Analysis (`Turf.js`) to background threads.
- [ ] **Virtual Scrolling**: Optimize the Data Table to handle massive datasets without DOM lag.
- [ ] **Binary Formats**: Support specifically for Geobuf or FlatGeobuf for massive vector data.

### Phase 5: Making the project installable as an PWA App
- [ ] **Service Worker**: Implement a Service Worker for offline support.
- [ ] **App Shell**: Implement an App Shell for offline support.

### Phase 6: Engineering Health
*Goal: "Bulletproof Reliability."*

- [ ] **TypeScript Migration**: Strict typing to eliminate "undefined" errors.
- [ ] **E2E Testing**: Automated browser testing for full user journeys.
- [ ] **Error Boundaries**: Graceful UI recovery mechanisms instead of white-screens.

### Phase 7: Rigorous automated testing framework
- [ ] **Unit Tests**: Automated browser testing for full user journeys.
- [ ] **End-to-End Tests**: Automated browser testing for full user journeys.


## 💡 Feature Wishlist (Under Consideration)
- **Coordinate Conversion UI**: Dedicated tool to convert between SRS (e.g., EPSG:4326 to EPSG:3857).
- **Attribute Editing**: Edit data directly in the table cells.
- **Map Printing**: High-DPI export of the current map view for reports.

---

*Last Updated: 2025-12-13*
