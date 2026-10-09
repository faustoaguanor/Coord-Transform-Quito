import { describe, expect, it } from "vitest";
import {
  detectCoordinateFormat,
  detectDelimiter,
  detectProjectedSystem,
  parseCSV,
  rowsToCoordinates,
} from "../fileParsing";

const toRows = (csv) => {
  const data = parseCSV(csv);
  return [data[0], data.slice(1)];
};

describe("parseCSV / detectDelimiter", () => {
  it.each([
    [",", "a,b,c"],
    [";", "a;b;c"],
    ["\t", "a\tb\tc"],
  ])("detecta el separador %j", (expected, line) => {
    expect(detectDelimiter(line)).toBe(expected);
  });

  it("prefiere ';' cuando los decimales usan coma", () => {
    expect(detectDelimiter("nombre;lat;lon")).toBe(";");
    const data = parseCSV("nombre;lat;lon\nQuito;-0,2201;-78,5123");
    expect(data[1]).toEqual(["Quito", "-0,2201", "-78,5123"]);
  });

  it("respeta comillas, comillas escapadas, BOM y líneas vacías", () => {
    const data = parseCSV('﻿nombre,x,y\r\n"Lote ""A"", Mz 3",498630.1,9975651.4\r\n\r\n');
    expect(data).toEqual([
      ["nombre", "x", "y"],
      ['Lote "A", Mz 3', "498630.1", "9975651.4"],
    ]);
  });
});

describe("detectCoordinateFormat", () => {
  it("reconoce encabezados en español e inglés sin importar mayúsculas", () => {
    expect(detectCoordinateFormat(["Nombre", "LATITUD", "Longitud"])).toEqual({
      name: 0,
      lat: 1,
      lng: 2,
    });
    expect(detectCoordinateFormat(["clave_catastral", "Este", "Norte"])).toEqual({
      name: 0,
      x: 1,
      y: 2,
    });
  });
});

describe("detectProjectedSystem", () => {
  it.each([
    [498630, 9975651, "SIRES-DMQ"],
    [776904, 9975649, "UTM-17S"],
    [623544, 9757958, "UTM-17S"],
    [650024, 107045, "UTM-17N"],
  ])("(%i, %i) → %s", (x, y, expected) => {
    expect(detectProjectedSystem(x, y)).toBe(expected);
  });
});

describe("rowsToCoordinates", () => {
  const settings = { sourceSystem: "auto", targetSystem: "SIRES-DMQ" };

  it("convierte geográficas y conserva las columnas originales", () => {
    const [headers, rows] = toRows("nombre,lat,lon,uso\nPlaza,-0.2201,-78.5123,comercial");
    const { coordinates, rejected } = rowsToCoordinates(headers, rows, settings);
    expect(rejected).toEqual([]);
    expect(coordinates).toHaveLength(1);
    expect(coordinates[0]).toMatchObject({
      name: "Plaza",
      row: 2,
      coordinates: { latitude: -0.2201, longitude: -78.5123 },
      targetSystem: "SIRES-DMQ",
      attributes: { nombre: "Plaza", lat: "-0.2201", lon: "-78.5123", uso: "comercial" },
    });
  });

  it("auto-detecta SIRES-DMQ y UTM-17S en columnas X/Y", () => {
    const [headers, rows] = toRows("id;x;y\nA;498630,15;9975651,44\nB;776904,30;9975649,23");
    const { coordinates } = rowsToCoordinates(headers, rows, settings);
    expect(coordinates.map((c) => c.system)).toEqual(["SIRES-DMQ", "UTM-17S"]);
    expect(coordinates[0].easting).toBeCloseTo(498630.15);
  });

  it("respeta el sistema de origen elegido por el usuario (zona 18)", () => {
    const [headers, rows] = toRows("x,y\n186914.86,9890021.75");
    const { coordinates } = rowsToCoordinates(headers, rows, {
      sourceSystem: "UTM-18S",
      targetSystem: "EPSG:4326",
    });
    expect(coordinates[0].system).toBe("UTM-18S");
  });

  it("interpreta lat/lng con metros como X/Y y lo advierte", () => {
    const [headers, rows] = toRows("lat,lon\n9975649.23,776904.30");
    const { coordinates, warnings } = rowsToCoordinates(headers, rows, settings);
    expect(coordinates[0]).toMatchObject({ easting: 776904.3, system: "UTM-17S" });
    expect(warnings[0].message).toMatch(/se interpretan como X\/Y/);
  });

  it("reporta filas rechazadas con número de fila y motivo", () => {
    const csv = [
      "nombre,lat,lon",
      "ok,-0.2201,-78.5123",
      "vacia,,-78.5",
      "texto,abc,-78.5",
      "madrid,40.4,-3.7",
      "sin signo,-0.22,78.51",
    ].join("\n");
    const [headers, rows] = toRows(csv);
    const { coordinates, rejected } = rowsToCoordinates(headers, rows, settings);
    expect(coordinates).toHaveLength(1);
    expect(rejected.map((r) => r.row)).toEqual([3, 4, 5, 6]);
    expect(rejected[0].message).toMatch(/no numérico o vacío en latitud/);
    expect(rejected[2].message).toMatch(/fuera del rango típico de Ecuador/);
    expect(rejected[3].message).toMatch(/falta el signo negativo/);
  });

  it("rechaza X/Y intercambiados", () => {
    const [headers, rows] = toRows("x,y\n9975649,776904");
    const { coordinates, rejected } = rowsToCoordinates(headers, rows, {
      sourceSystem: "UTM-17S",
      targetSystem: "SIRES-DMQ",
    });
    expect(coordinates).toHaveLength(0);
    expect(rejected[0].message).toMatch(/intercambiados/);
  });

  it("acepta celdas numéricas de Excel (raw) sin perder decimales", () => {
    const { coordinates } = rowsToCoordinates(
      ["Este", "Norte"],
      [[498630.1526, 9975651.4439]],
      settings
    );
    expect(coordinates[0].easting).toBe(498630.1526);
    expect(coordinates[0].northing).toBe(9975651.4439);
  });

  it("lanza un error explicativo si no hay columnas de coordenadas", () => {
    expect(() => rowsToCoordinates(["a", "b"], [["1", "2"]], settings)).toThrow(
      /No se detectaron columnas de coordenadas/
    );
  });

  it("procesa miles de filas", () => {
    const rows = Array.from({ length: 5000 }, (_, i) => [
      `P${i}`,
      String(-0.2 - i * 1e-5),
      String(-78.5 + i * 1e-5),
    ]);
    const { coordinates, rejected } = rowsToCoordinates(["id", "lat", "lon"], rows, settings);
    expect(coordinates).toHaveLength(5000);
    expect(rejected).toHaveLength(0);
  });
});
