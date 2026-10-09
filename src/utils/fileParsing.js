// src/utils/fileParsing.js
// Lectura de archivos tabulares (CSV/Excel) y conversión de filas a puntos.
// Módulo sin dependencias del DOM para poder probarlo con Vitest.
import Papa from "papaparse";
import {
  parseNumber,
  validateInSystem,
} from "./coordinateTransformations";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_ROWS = 50000;

const HEADER_PATTERNS = {
  lat: /^(lat|latitude|latitud)$/,
  lng: /^(lon|lng|long|longitude|longitud)$/,
  x: /^(x|este|easting|utm_x|coord_x|coordenada_x)$/,
  y: /^(y|norte|northing|utm_y|coord_y|coordenada_y)$/,
  zone: /^(zone|zona|utm_zone|hemisphere|hemisferio)$/,
  name: /^(name|nombre|punto|id|identificador|codigo|código|clave|clave_catastral)$/,
};

export const normalizeHeader = (header) =>
  String(header ?? "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .trim();

// Detecta qué columna contiene cada componente de la coordenada
export const detectCoordinateFormat = (headers) => {
  const headerMap = {};

  headers.forEach((header, index) => {
    const clean = normalizeHeader(header);
    for (const [key, pattern] of Object.entries(HEADER_PATTERNS)) {
      if (headerMap[key] === undefined && pattern.test(clean)) {
        headerMap[key] = index;
        break;
      }
    }
  });

  return headerMap;
};

// Detecta el separador más probable (",", ";" o tabulación) en una línea
export const detectDelimiter = (line) => {
  const candidates = [",", ";", "\t"];
  const counts = candidates.map((delimiter) => {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === delimiter && !inQuotes) {
        count++;
      }
    }
    return { delimiter, count };
  });

  const best = counts.sort((a, b) => b.count - a.count)[0];
  return best.count > 0 ? best.delimiter : ",";
};

// Parsea texto CSV a una matriz de celdas (respeta comillas y "" escapadas)
export const parseCSV = (text) => {
  const content = String(text ?? "").replace(/^\uFEFF/, "");
  const firstLine = content.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const { data } = Papa.parse(content, {
    delimiter: detectDelimiter(firstLine),
    skipEmptyLines: "greedy",
  });
  return data.map((row) => row.map((cell) => String(cell).trim()));
};

// Sugiere el sistema proyectado a partir de los valores.
// LIMITACIÓN: zonas 17 y 18 se solapan numéricamente, por lo que la
// auto-detección asume zona 17 (la de Quito y la Costa). Para datos de la
// Amazonía en zona 18 el usuario debe elegir el sistema de origen.
export const detectProjectedSystem = (x, y) => {
  if (x >= 450000 && x <= 550000 && y >= 9950000 && y <= 10050000) {
    return "SIRES-DMQ";
  }
  if (y >= 9000000) return "UTM-17S";
  if (y < 1000000) return "UTM-17N";
  return "UTM-17S";
};

const looksGeographic = (lat, lng) =>
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

const looksProjected = (x, y) =>
  x >= 100000 && x <= 900000 && y >= -1000000 && y <= 11000000;

const resolveProjectedSystem = (x, y, sourceSystem, warn) => {
  if (sourceSystem === "auto") return detectProjectedSystem(x, y);
  if (sourceSystem === "EPSG:4326") {
    const system = detectProjectedSystem(x, y);
    warn(
      `valores proyectados con origen "Geográficas"; se interpretan como ${system}`
    );
    return system;
  }
  return sourceSystem;
};

/**
 * Convierte filas tabulares en puntos listos para transformCoordinatesBatch.
 *
 * @param {Array} headers  Encabezados del archivo
 * @param {Array<Array>} rows Filas de datos (sin encabezado)
 * @param {{sourceSystem: string, targetSystem: string}} settings
 * @returns {{coordinates: Array, rejected: Array, warnings: Array, coordMap: object}}
 *   `rejected` y `warnings` contienen {row, message}, donde `row` es el número
 *   de fila en el archivo original (la fila 1 es el encabezado).
 */
export const rowsToCoordinates = (headers, rows, settings) => {
  const { sourceSystem = "auto", targetSystem = "SIRES-DMQ" } = settings ?? {};
  const coordMap = detectCoordinateFormat(headers);
  const coordinates = [];
  const rejected = [];
  const warnings = [];

  const hasLatLng = coordMap.lat !== undefined && coordMap.lng !== undefined;
  const hasXY = coordMap.x !== undefined && coordMap.y !== undefined;

  if (!hasLatLng && !hasXY) {
    throw new Error(
      [
        "No se detectaron columnas de coordenadas válidas.",
        "Use nombres como:",
        "• Geográficas: lat/latitud y lon/lng/longitud",
        "• Proyectadas: x/este/easting y y/norte/northing",
        `Columnas encontradas: ${headers.join(", ")}`,
      ].join("\n")
    );
  }

  const headerNames = headers.map((h, i) => String(h ?? "").trim() || `col_${i + 1}`);

  rows.forEach((row, index) => {
    const fileRow = index + 2; // +1 por el encabezado, +1 por base 1
    const reject = (message) => rejected.push({ row: fileRow, message });
    const warn = (message) => warnings.push({ row: fileRow, message });

    if (!row || row.every((cell) => cell === "" || cell == null)) return;

    const attributes = {};
    headerNames.forEach((name, i) => {
      attributes[name] = row[i] ?? "";
    });

    const name =
      coordMap.name !== undefined && String(row[coordMap.name] ?? "").trim()
        ? String(row[coordMap.name]).trim()
        : `Punto ${index + 1}`;

    const rawA = hasLatLng ? row[coordMap.lat] : row[coordMap.y];
    const rawB = hasLatLng ? row[coordMap.lng] : row[coordMap.x];
    const a = parseNumber(typeof rawA === "number" ? rawA : String(rawA ?? ""));
    const b = parseNumber(typeof rawB === "number" ? rawB : String(rawB ?? ""));

    if (isNaN(a) || isNaN(b)) {
      const labels = hasLatLng ? ["latitud", "longitud"] : ["Norte (Y)", "Este (X)"];
      const bad = [isNaN(a) && labels[0], isNaN(b) && labels[1]].filter(Boolean);
      reject(`valor no numérico o vacío en ${bad.join(" y ")}`);
      return;
    }

    let point;
    const geographicSource =
      sourceSystem === "auto" || sourceSystem === "EPSG:4326";

    if (hasLatLng && geographicSource && looksGeographic(a, b)) {
      point = { coordinates: { latitude: a, longitude: b } };
    } else {
      // Columnas X/Y, o columnas lat/lng que en realidad traen metros
      const x = b;
      const y = a;
      if (!looksProjected(x, y)) {
        if (!hasLatLng && looksProjected(y, x)) {
          reject("parece que Este (X) y Norte (Y) están intercambiados");
          return;
        }
        reject(
          hasLatLng
            ? "lat/lng fuera de rango geográfico y no parecen coordenadas proyectadas"
            : "X/Y no parecen coordenadas proyectadas (Este 100 000–900 000 m)"
        );
        return;
      }
      if (hasLatLng && sourceSystem === "auto") {
        warn("columnas lat/lng con valores en metros; se interpretan como X/Y");
      }
      const system = resolveProjectedSystem(x, y, sourceSystem, warn);
      point = { easting: x, northing: y, system };
    }

    const crs = point.system ?? "EPSG:4326";
    const x = point.coordinates ? point.coordinates.longitude : point.easting;
    const y = point.coordinates ? point.coordinates.latitude : point.northing;
    const validation = validateInSystem(x, y, crs);
    if (!validation.isValid) {
      reject(`${validation.errors.join("; ")} [${crs}]`);
      return;
    }

    coordinates.push({
      id: index + 1,
      row: fileRow,
      name,
      ...point,
      targetSystem,
      attributes,
    });
  });

  return { coordinates, rejected, warnings, coordMap };
};
