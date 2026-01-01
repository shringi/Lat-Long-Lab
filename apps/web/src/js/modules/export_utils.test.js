import { describe, it, expect, vi } from "vitest";
import { generateGeoJSON, generateKML } from "./export_utils.js";

// Mock dependencies
vi.mock("tokml", () => ({
  default: (geojson) =>
    `<kml><Placemark>${geojson.features[0].properties.name}</Placemark></kml>`,
}));

describe("Export Utilities", () => {
  // Sample Data
  const samplePoints = [
    { name: "Point A", lat: 10.0, lng: 20.0, category: "Test" },
    { name: "Point B", lat: -10.0, lng: -20.0, _internal: "ignore" },
  ];

  describe("generateGeoJSON", () => {
    it("should convert points to valid GeoJSON FeatureCollection", () => {
      const result = generateGeoJSON(samplePoints);

      expect(result.type).toBe("FeatureCollection");
      expect(result.features).toHaveLength(2);
      expect(result.features[0].geometry.coordinates).toEqual([20.0, 10.0]); // Lng, Lat
      expect(result.features[0].properties.name).toBe("Point A");
    });

    it("should handle string coordinates gracefully", () => {
      const stringPoints = [{ lat: "10.0", lng: "20.0" }];
      const result = generateGeoJSON(stringPoints);
      expect(result.features[0].geometry.coordinates).toEqual([20.0, 10.0]);
    });
  });

  describe("generateKML", () => {
    it("should call tokml with geojson", async () => {
      const geojson = generateGeoJSON(samplePoints);
      const kml = await generateKML(geojson);
      expect(kml).toContain("<kml>");
      expect(kml).toContain("Point A");
    });
  });
});
