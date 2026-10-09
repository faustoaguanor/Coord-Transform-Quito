import { describe, expect, it } from "vitest";
import {
  parseNumber,
  validateCoordinates,
  validateDMS,
  validateInSystem,
  validateProjectedCoordinates,
} from "../coordinateTransformations";

describe("parseNumber", () => {
  it.each([
    [-0.2201, -0.2201],
    ["-0.2201", -0.2201],
    ["-0,2201", -0.2201],
    ["  498630.153 ", 498630.153],
    ["498630,153", 498630.153],
    ["9,975,649.23", 9975649.23],
    ["9.975.649,23", 9975649.23],
    ["9.975.649", 9975649],
    ["1,234,567", 1234567],
    ["9 975 649,23", 9975649.23],
    ["1e3", 1000],
    ["+5", 5],
  ])("%j → %f", (input, expected) => {
    expect(parseNumber(input)).toBeCloseTo(expected, 9);
  });

  it.each(["", "   ", "abc", "12abc", "1-2", "--5", null, undefined, {}, NaN, Infinity])(
    "%j → NaN",
    (input) => {
      expect(parseNumber(input)).toBeNaN();
    }
  );
});

describe("validateCoordinates (geográficas)", () => {
  it("acepta un punto de Quito", () => {
    expect(validateCoordinates(-0.2201, -78.5123).isValid).toBe(true);
  });

  it("acepta texto con coma decimal", () => {
    const r = validateCoordinates("-0,2201", "-78,5123");
    expect(r.isValid).toBe(true);
    expect(r.parsedLat).toBeCloseTo(-0.2201);
  });

  it("acepta Galápagos", () => {
    expect(validateCoordinates(-0.74, -90.31).isValid).toBe(true);
  });

  it("rechaza latitudes imposibles con mensaje claro", () => {
    const r = validateCoordinates(95, -78);
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain("Latitud debe estar entre -90 y 90 grados");
  });

  it("rechaza puntos fuera de Ecuador", () => {
    const r = validateCoordinates(40.4, -3.7); // Madrid
    expect(r.isValid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/fuera del rango típico de Ecuador/);
  });

  it("detecta longitud sin signo negativo", () => {
    const r = validateCoordinates(-0.22, 78.51);
    expect(r.isValid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/falta el signo negativo/);
  });

  it("detecta latitud y longitud intercambiadas", () => {
    const r = validateCoordinates(-78.51, -0.22);
    expect(r.isValid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/intercambiadas/);
  });

  it("rechaza valores no numéricos", () => {
    const r = validateCoordinates("abc", "-78.5");
    expect(r.errors).toContain("Latitud debe ser un número válido");
  });
});

describe("validateProjectedCoordinates", () => {
  it("acepta SIRES-DMQ dentro del DMQ", () => {
    expect(validateProjectedCoordinates(498630, 9975651, "SIRES-DMQ").isValid).toBe(true);
  });

  it("rechaza valores UTM-17S declarados como SIRES-DMQ", () => {
    const r = validateProjectedCoordinates(776904, 9975649, "SIRES-DMQ");
    expect(r.isValid).toBe(false);
    expect(r.errors[0]).toMatch(/Este fuera del rango típico de SIRES-DMQ/);
  });

  it("acepta UTM-17S en Quito y Guayaquil", () => {
    expect(validateProjectedCoordinates(776904, 9975649, "UTM-17S").isValid).toBe(true);
    expect(validateProjectedCoordinates(623544, 9757958, "UTM-17S").isValid).toBe(true);
  });

  it("rechaza Norte de hemisferio sur declarado como UTM-17N", () => {
    const r = validateProjectedCoordinates(776904, 9975649, "UTM-17N");
    expect(r.isValid).toBe(false);
    expect(r.errors[0]).toMatch(/Norte fuera del rango/);
  });

  it("acepta Norte negativo en UTM-17N (sur del ecuador)", () => {
    expect(validateProjectedCoordinates(776904, -24350, "UTM-17N").isValid).toBe(true);
  });

  it("detecta Este y Norte intercambiados", () => {
    const r = validateProjectedCoordinates(9975649, 776904, "UTM-17S");
    expect(r.isValid).toBe(false);
    expect(r.errors).toEqual(["Parece que Este y Norte están intercambiados"]);
  });

  it("rechaza sistemas desconocidos", () => {
    const r = validateProjectedCoordinates(500000, 9975000, "PSAD56");
    expect(r.errors).toContain("Sistema de coordenadas no soportado: PSAD56");
  });

  it("rechaza texto no numérico", () => {
    const r = validateProjectedCoordinates("x", "y", "UTM-17S");
    expect(r.errors).toEqual(["Este debe ser un número válido", "Norte debe ser un número válido"]);
  });
});

describe("validateDMS", () => {
  it("acepta valores correctos", () => {
    expect(validateDMS("0", "13", "12.4", "lat").isValid).toBe(true);
  });

  it("rechaza minutos y segundos ≥ 60", () => {
    const r = validateDMS(78, 60, 61, "lng");
    expect(r.errors).toEqual([
      "Minutos deben estar entre 0 y 59",
      "Segundos deben estar entre 0 y 59.999",
    ]);
  });

  it("rechaza latitud > 90°", () => {
    expect(validateDMS(91, 0, 0, "lat").isValid).toBe(false);
  });
});

describe("validateInSystem", () => {
  it("ordena x=lon, y=lat para geográficas", () => {
    expect(validateInSystem(-78.5, -0.2, "EPSG:4326").isValid).toBe(true);
    expect(validateInSystem(-0.2, -78.5, "EPSG:4326").isValid).toBe(false);
  });

  it("rechaza sistemas no soportados", () => {
    expect(validateInSystem(1, 1, "EPSG:3857").isValid).toBe(false);
  });
});
