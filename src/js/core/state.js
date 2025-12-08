
console.log("STATE MODULE LOADED");

// 1. Exportable State
export const state = {
    allPoints: [],
    filteredPoints: [],
    isFilteringEnabled: false, // Default off
    rawData: [],
    worldGeoJSON: null,
};

// 2. Exportable Event Hub
// We reuse the one created by bootstrap.js if it exists, to prevent losing early listeners
export const events = window.App?.events || new EventTarget();

export function emit(eventName, detail) {
    events.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export function on(eventName, callback) {
    events.addEventListener(eventName, (e) => callback(e.detail));
}



console.log("State Module Bridged to window.App");
