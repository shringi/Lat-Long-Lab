
console.log("STATE.JS LOADED");

// Global Namespace Definition
window.App = window.App || {};

// Initial State
App.state = {
    allPoints: [],
    filteredPoints: [],
    isFilteringEnabled: false, // Default off
    rawData: [],
    worldGeoJSON: null,
};

// Global Event Hub (Simple Pub/Sub)
App.events = new EventTarget();

App.emit = function (eventName, detail) {
    App.events.dispatchEvent(new CustomEvent(eventName, { detail }));
};

App.on = function (eventName, callback) {
    App.events.addEventListener(eventName, (e) => callback(e.detail));
};
