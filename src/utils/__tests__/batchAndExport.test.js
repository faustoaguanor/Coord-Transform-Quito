import { describe, expect, it } from "vitest";
import reference from "./fixtures/reference-points.json";
import { transformCoordinatesBatch } from "../coordinateTransformations";
import { buildCSV, buildExportTable, buildGeoJSON, buildKML } from "../exporters";
import { parseCSV, rowsToCoordinates } from "../fileParsing";

const quito = reference.points[0];

const runCsv = async (csv, settings) => {
  const data = parseCSV(csv);
  const { coordinates } = rowsToCoordinates(data[0], data.slice(1), settings);
  return transformCoordinatesBatch(coordinates, { targetCRS: settings.targetSystem });
};

describe("transformCoordinatesBatch", () => {
  it("transforma un lote mixto y no se detiene ante filas inválidas", async () => {
    const { results, summary } = await transformCoordinatesBatch(
      [
        { name: "A", coordinates: { latitude: quito.lat, longitude: quito.lon } },
        { name: "B", easting: "abc", northing: 1, system: "UTM-17S" },
        { name: "C", easting: 776904.2965, northing: 9975649.2321, system: "UTM-17S" },
      ],
      { targetCRS: "SIRES-DMQ" }
    );
    expect(summary).toMatchObject({ total: 3, successful: 2, failed: 1 });
    expect(results[1]).toMatchObject({ status: "error", name: "B" });
    for (const r of [results[0], results[2]]) {
      expect(r.transformation.target.x).toBeCloseTo(quito.projected["SIRES-DMQ"].x, 3);
      expect(r.transformation.target.y).toBeCloseTo(quito.projected["SIRES-DMQ"].y, 3);
    }
  });

  it("redondea a 3 decimales en metros y 8 en grados", async () => {
    const toSires = await transformCoordinatesBatch(
      [{ coordinates: { latitude: quito.lat, longitude: quito.lon } }],
      { targetCRS: "SIRES-DMQ" }
    );
    expect(toSires.results[0].transformation.target.x).toBe(498630.153);

    const toWgs = await transformCoordinatesBatch(
      [{ easting: 498630.1526, northing: 9975651.4439, system: "SIRES-DMQ" }],
      { targetCRS: "EPSG:4326" }
    );
    const t = toWgs.results[0].transformation.target;
    expect(t.y).toBeCloseTo(quito.lat, 8);
    expect(String(t.x).split(".")[1].length).toBeLessThanOrEqual(8);
  });

  it("guarda la posición WGS84 aunque el origen sea proyectado", async () => {
    const { results } = await transformCoordinatesBatch(
      [{ easting: 776904.2965, northing: 9975649.2321, system: "UTM-17S" }],
      { targetCRS: "SIRES-DMQ" }
    );
    expect(results[0].wgs84.lat).toBeCloseTo(quito.lat, 8);
    expect(results[0].wgs84.lng).toBeCloseTo(quito.lon, 8);
  });

  it("valida rangos: UTM-17S declarado como SIRES-DMQ queda como error", async () => {
    const { results } = await transformCoordinatesBatch(
      [{ easting: 776904, northing: 9975649, system: "SIRES-DMQ" }],
      { targetCRS: "UTM-17S" }
    );
    expect(results[0].status).toBe("error");
    expect(results[0].error).toMatch(/SIRES-DMQ/);
  });

  it("genera todos los sistemas si se solicita", async () => {
    const { results } = await transformCoordinatesBatch(
      [{ coordinates: { latitude: quito.lat, longitude: quito.lon } }],
      { generateAllSystems: true }
    );
    expect(Object.keys(results[0].transformations)).toHaveLength(6);
    expect(results[0].transformations["EPSG:4326"].isOriginal).toBe(true);
  });

  it("procesa 10 000 puntos en un tiempo razonable", async () => {
    const coords = Array.from({ length: 10000 }, (_, i) => ({
      coordinates: { latitude: -0.2 - i * 1e-5, longitude: -78.5 + i * 1e-5 },
    }));
    const start = performance.now();
    const { summary } = await transformCoordinatesBatch(coords, { targetCRS: "SIRES-DMQ" });
    expect(summary.successful).toBe(10000);
    expect(performance.now() - start).toBeLessThan(5000);
  });
});

describe("exportación", () => {
  const csv = "clave_catastral,uso,x,y\n" +
    "1010101001,=CMD(),776904.2965,9975649.2321\n" +
    '"10101,02",residencial,abc,9975649\n';

  it("buildExportTable conserva columnas originales y agrega las calculadas", async () => {
    const { results } = await runCsv(csv, { sourceSystem: "UTM-17S", targetSystem: "SIRES-DMQ" });
    const { columns, rows } = buildExportTable(results);
    expect(columns.slice(0, 4)).toEqual(["clave_catastral", "uso", "x", "y"]);
    expect(columns).toContain("Destino_X");
    expect(rows[0]).toMatchObject({
      clave_catastral: "1010101001",
      Estado: "OK",
      Origen_Sistema: "UTM-17S",
      Destino_Sistema: "SIRES-DMQ",
      Destino_EPSG: "",
      Destino_X: 498630.153,
      Destino_Y: 9975651.444,
    });
    expect(rows[0].WGS84_Lat).toBeCloseTo(quito.lat, 8);
  });

  it("buildCSV escapa comas/comillas y neutraliza fórmulas", async () => {
    const { results } = await runCsv(csv, { sourceSystem: "UTM-17S", targetSystem: "SIRES-DMQ" });
    const out = buildCSV(results);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain("'=CMD()");
    expect(out).toContain("498630.153,9975651.444");
  });

  it("incluye las filas con error en el CSV con su motivo", async () => {
    const { results } = await transformCoordinatesBatch(
      [{ name: "malo", easting: 1, northing: 1, system: "UTM-17S" }],
      { targetCRS: "SIRES-DMQ" }
    );
    const { rows } = buildExportTable(results);
    expect(rows[0].Estado).toBe("ERROR");
    expect(rows[0].Observacion).toMatch(/fuera del rango/);
  });

  it("no pierde valores 0 (antes se exportaban vacíos)", () => {
    const { rows } = buildExportTable([
      {
        name: "cero",
        status: "success",
        transformation: {
          source: { x: -78.5, y: 0, crs: "EPSG:4326" },
          target: { x: 500000, y: 10000000, crs: "SIRES-DMQ" },
        },
      },
    ]);
    expect(rows[0].Origen_Y).toBe(0);
  });

  it("buildGeoJSON cumple RFC 7946 (geometría en WGS84 lon,lat)", async () => {
    const { results } = await transformCoordinatesBatch(
      [{ name: "Plaza", easting: 776904.2965, northing: 9975649.2321, system: "UTM-17S" }],
      { targetCRS: "SIRES-DMQ" }
    );
    const geo = buildGeoJSON(results);
    expect(geo.crs).toBeUndefined();
    const [lng, lat] = geo.features[0].geometry.coordinates;
    expect(lng).toBeCloseTo(quito.lon, 7);
    expect(lat).toBeCloseTo(quito.lat, 7);
    expect(geo.features[0].properties.Destino_X).toBe(498630.153);
  });

  it("buildKML usa WGS84 aunque el origen sea UTM y escapa nombres", async () => {
    const { results } = await transformCoordinatesBatch(
      [{ name: "<b>Lote & Co</b>", easting: 776904.2965, northing: 9975649.2321, system: "UTM-17S" }],
      { targetCRS: "SIRES-DMQ" }
    );
    const { count, content } = buildKML(results, new Date("2026-01-01T00:00:00Z"));
    expect(count).toBe(1);
    expect(content).toContain("<name>&lt;b&gt;Lote &amp; Co&lt;/b&gt;</name>");
    expect(content).toMatch(/<coordinates>-78\.5123\d*,-0\.2201\d*,0<\/coordinates>/);
    expect(content).not.toContain("<b>Lote");
  });
});
