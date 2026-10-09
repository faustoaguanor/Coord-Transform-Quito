import { describe, expect, it } from "vitest";
import reference from "./fixtures/reference-points.json";
import {
  EPSG_CODES,
  SUPPORTED_SYSTEMS,
  decimalToDMS,
  detectBestSystem,
  dmsToDecimal,
  getEcuadorSystems,
  toWGS84,
  transformCoordinate,
} from "../coordinateTransformations";

// Tolerancias: 1 mm en proyectadas; 1e-9° (~0.1 mm) en geográficas.
const TOL_M = 0.001;
const TOL_DEG = 1e-9;

const PROJECTED = SUPPORTED_SYSTEMS.filter((s) => s !== "EPSG:4326");

describe("transformCoordinate contra PROJ (pyproj) — valores de referencia", () => {
  for (const point of reference.points) {
    describe(point.name, () => {
      for (const crs of PROJECTED) {
        const expected = point.projected[crs];

        it(`WGS84 → ${crs}`, () => {
          const r = transformCoordinate(point.lon, point.lat, "EPSG:4326", crs);
          expect(r.success).toBe(true);
          expect(Math.abs(r.x - expected.x)).toBeLessThan(TOL_M);
          expect(Math.abs(r.y - expected.y)).toBeLessThan(TOL_M);
        });

        it(`${crs} → WGS84`, () => {
          const r = transformCoordinate(expected.x, expected.y, crs, "EPSG:4326");
          expect(r.success).toBe(true);
          expect(Math.abs(r.x - point.lon)).toBeLessThan(1e-8);
          expect(Math.abs(r.y - point.lat)).toBeLessThan(1e-8);
        });
      }

      // Transformaciones directas entre sistemas proyectados
      for (const from of point.natural) {
        for (const to of PROJECTED.filter((s) => s !== from)) {
          it(`${from} → ${to}`, () => {
            const src = point.projected[from];
            const expected = point.projected[to];
            const r = transformCoordinate(src.x, src.y, from, to);
            expect(r.success).toBe(true);
            expect(Math.abs(r.x - expected.x)).toBeLessThan(TOL_M);
            expect(Math.abs(r.y - expected.y)).toBeLessThan(TOL_M);
          });
        }
      }
    });
  }
});

describe("ida y vuelta (round-trip)", () => {
  for (const point of reference.points) {
    for (const crs of point.natural) {
      it(`${point.name}: WGS84 → ${crs} → WGS84 sin pérdida`, () => {
        const fwd = transformCoordinate(point.lon, point.lat, "EPSG:4326", crs);
        const back = transformCoordinate(fwd.x, fwd.y, crs, "EPSG:4326");
        expect(Math.abs(back.x - point.lon)).toBeLessThan(TOL_DEG);
        expect(Math.abs(back.y - point.lat)).toBeLessThan(TOL_DEG);
      });
    }
  }

  it("SIRES-DMQ → UTM-17S → SIRES-DMQ conserva el milímetro", () => {
    const x = 498630.153;
    const y = 9975651.444;
    const utm = transformCoordinate(x, y, "SIRES-DMQ", "UTM-17S");
    const back = transformCoordinate(utm.x, utm.y, "UTM-17S", "SIRES-DMQ");
    expect(Math.abs(back.x - x)).toBeLessThan(TOL_M);
    expect(Math.abs(back.y - y)).toBeLessThan(TOL_M);
  });
});

describe("parámetros de SIRES-DMQ", () => {
  it("el origen (lat 0, lon -78.5) es exactamente (500000, 10000000)", () => {
    const r = transformCoordinate(-78.5, 0, "EPSG:4326", "SIRES-DMQ");
    expect(r.x).toBeCloseTo(500000, 6);
    expect(r.y).toBeCloseTo(10000000, 6);
  });

  it("aplica el factor de escala k = 1.0004584 sobre el meridiano central", () => {
    const sires = transformCoordinate(-78.5, -0.3, "EPSG:4326", "SIRES-DMQ");
    // Misma TM con k = 1 (longitud de arco del meridiano sin escalar)
    const arc = 10000000 - sires.y;
    expect(arc / 1.0004584).toBeCloseTo(33172.6, 0);
  });

  it("SIRES-DMQ difiere de UTM-17S en ~278 km de Este en Quito", () => {
    const p = reference.points[0];
    const dx = p.projected["UTM-17S"].x - p.projected["SIRES-DMQ"].x;
    expect(dx).toBeGreaterThan(278000);
    expect(dx).toBeLessThan(279000);
  });
});

describe("manejo de errores de transformCoordinate", () => {
  it("rechaza valores no numéricos", () => {
    const r = transformCoordinate("abc", 1, "EPSG:4326", "UTM-17S");
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no se pudieron convertir/);
  });

  it("rechaza sistemas no soportados", () => {
    expect(transformCoordinate(0, 0, "EPSG:9999", "UTM-17S").success).toBe(false);
    expect(transformCoordinate(0, 0, "EPSG:4326", "PSAD56").success).toBe(false);
  });

  it("acepta números como texto con coma decimal", () => {
    const r = transformCoordinate("-78,5123", "-0,2201", "EPSG:4326", "SIRES-DMQ");
    expect(r.success).toBe(true);
    expect(r.x).toBeCloseTo(498630.1526, 3);
  });
});

describe("toWGS84", () => {
  it("devuelve lat/lng sin transformar si ya es geográfica", () => {
    expect(toWGS84(-78.5, -0.2, "EPSG:4326")).toEqual({ lat: -0.2, lng: -78.5 });
  });

  it("convierte UTM-17S a WGS84", () => {
    const p = reference.points[0];
    const r = toWGS84(p.projected["UTM-17S"].x, p.projected["UTM-17S"].y, "UTM-17S");
    expect(r.lat).toBeCloseTo(p.lat, 8);
    expect(r.lng).toBeCloseTo(p.lon, 8);
  });
});

describe("ejemplos de getEcuadorSystems", () => {
  it("son coherentes con el punto de ejemplo WGS84 (Plaza Grande)", () => {
    const systems = getEcuadorSystems();
    const { lat, lng } = systems.find((s) => s.code === "EPSG:4326").example;
    for (const sys of systems.filter((s) => s.type === "projected")) {
      const r = transformCoordinate(lng, lat, "EPSG:4326", sys.code);
      expect(Math.abs(r.x - sys.example.easting)).toBeLessThan(TOL_M);
      expect(Math.abs(r.y - sys.example.northing)).toBeLessThan(TOL_M);
    }
  });

  it("los códigos EPSG coinciden con EPSG_CODES", () => {
    for (const sys of getEcuadorSystems()) {
      expect(sys.epsg).toBe(EPSG_CODES[sys.code]);
    }
  });
});

describe("DMS", () => {
  it("convierte decimal → DMS → decimal", () => {
    const dms = decimalToDMS(-0.2201, "lat");
    expect(dms).toMatchObject({ degrees: 0, minutes: 13, direction: "S" });
    expect(dms.seconds).toBeCloseTo(12.36, 2);
    const back = dmsToDecimal(dms.degrees, dms.minutes, dms.seconds, dms.direction);
    expect(back).toBeCloseTo(-0.2201, 6);
  });

  it("usa W para longitudes negativas", () => {
    expect(decimalToDMS(-78.5123, "lng").direction).toBe("W");
  });

  it("no produce 60 segundos por redondeo", () => {
    const dms = decimalToDMS(-0.99999999, "lat");
    expect(dms.seconds).toBeLessThan(60);
    expect(dms.minutes).toBeLessThan(60);
    expect(dms.formatted).toBe(`1° 0' 0.000" S`);
  });
});

describe("detectBestSystem", () => {
  it.each([
    [-0.2201, -78.5123, "SIRES-DMQ"],
    [-2.1894, -79.889, "UTM-17S"],
    [0.9682, -79.6517, "UTM-17N"],
    [-0.9938, -77.8129, "UTM-18S"],
    [0.6, -77.0, "UTM-18N"],
  ])("(%f, %f) → %s", (lat, lng, expected) => {
    expect(detectBestSystem(lat, lng)).toBe(expected);
  });
});
