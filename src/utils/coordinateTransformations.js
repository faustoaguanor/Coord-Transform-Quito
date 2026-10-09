// src/utils/coordinateTransformations.js
// Motor de transformaciones de coordenadas para Ecuador / DMQ.
// Las funciones de este módulo son puras (sin DOM) salvo copyToClipboard,
// para que puedan probarse con Vitest. Ver docs/TECNICO.md.
import proj4 from "proj4";

// Definiciones PROJ de los sistemas soportados
export const COORDINATE_SYSTEMS = {
  // Geográficas
  "EPSG:4326": "+proj=longlat +datum=WGS84 +no_defs",

  // SIRES-DMQ (Sistema oficial de Quito). Transversa de Mercator local sobre
  // el elipsoide WGS84, meridiano central -78.5° y factor de escala
  // 1.0004584 (compensa la altura media de Quito, ~2900 m).
  "SIRES-DMQ":
    "+proj=tmerc +lat_0=0 +lon_0=-78.5 +k=1.0004584 +x_0=500000 +y_0=10000000 +ellps=WGS84 +datum=WGS84 +units=m +no_defs",

  // UTM para Ecuador
  "UTM-17N": "+proj=utm +zone=17 +north +datum=WGS84 +units=m +no_defs",
  "UTM-17S": "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs",
  "UTM-18N": "+proj=utm +zone=18 +north +datum=WGS84 +units=m +no_defs",
  "UTM-18S": "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs",
};

// Códigos EPSG equivalentes (SIRES-DMQ no tiene código EPSG oficial)
export const EPSG_CODES = {
  "EPSG:4326": 4326,
  "SIRES-DMQ": null,
  "UTM-17N": 32617,
  "UTM-17S": 32717,
  "UTM-18N": 32618,
  "UTM-18S": 32718,
};

export const SUPPORTED_SYSTEMS = Object.keys(COORDINATE_SYSTEMS);

// Registrar proyecciones
Object.entries(COORDINATE_SYSTEMS).forEach(([code, definition]) => {
  proj4.defs(code, definition);
});

export const isGeographicCRS = (crs) => crs === "EPSG:4326";

// Decimales recomendados: 8 en grados (~1 mm), 3 en metros (1 mm)
export const getDecimalsForCRS = (crs) => (isGeographicCRS(crs) ? 8 : 3);

// Formatea un valor según las unidades del sistema; "" si no es numérico.
export const formatForCRS = (value, crs) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(getDecimalsForCRS(crs))
    : "";

const NUMBER_PATTERN = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

// Función para normalizar números (manejo de puntos y comas)
export const parseNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value !== "string") return NaN;

  let cleaned = value.trim().replace(/\s+/g, "");
  if (!cleaned) return NaN;

  if (cleaned.includes(".") && cleaned.includes(",")) {
    if (cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",")) {
      // 1,234.56 (inglés)
      cleaned = cleaned.replace(/,/g, "");
    } else {
      // 1.234,56 (europeo / latinoamericano)
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }
  } else if (cleaned.includes(",")) {
    const commaCount = (cleaned.match(/,/g) || []).length;
    if (commaCount === 1) {
      const afterComma = cleaned.split(",")[1];
      if (afterComma && afterComma.length <= 6 && /^\d+$/.test(afterComma)) {
        // Coma decimal: -78,5123
        cleaned = cleaned.replace(",", ".");
      } else {
        cleaned = cleaned.replace(/,/g, "");
      }
    } else {
      // Varias comas: separadores de miles (1,234,567)
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if ((cleaned.match(/\./g) || []).length > 1) {
    // Varios puntos: separadores de miles (9.975.649)
    cleaned = cleaned.replace(/\./g, "");
  }

  // Rechazar basura como "12abc" o "1-2" en lugar de truncar silenciosamente
  if (!NUMBER_PATTERN.test(cleaned)) return NaN;

  const result = Number(cleaned);
  return Number.isFinite(result) ? result : NaN;
};

// Configuración de sistemas disponibles.
// Los ejemplos corresponden a la Plaza Grande (-0.2201, -78.5123) y fueron
// verificados con PROJ 9 (pyproj); ver src/utils/__tests__/.
export const getEcuadorSystems = () => [
  {
    code: "EPSG:4326",
    epsg: 4326,
    name: "Geográficas (WGS84)",
    shortName: "Geographic",
    type: "geographic",
    units: "degrees",
    description: "Latitud y Longitud en grados decimales",
    region: "Mundial",
    example: { lat: -0.2201, lng: -78.5123 },
  },
  {
    code: "SIRES-DMQ",
    epsg: null,
    name: "SIRES-DMQ (Quito)",
    shortName: "SIRES-DMQ",
    type: "projected",
    units: "meters",
    description:
      "Sistema de Referencia Espacial del Distrito Metropolitano de Quito",
    region: "Quito Metropolitano",
    example: { easting: 498630.153, northing: 9975651.444 },
  },
  {
    code: "UTM-17N",
    epsg: 32617,
    name: "UTM Zona 17 Norte",
    shortName: "UTM 17N",
    type: "projected",
    units: "meters",
    description: "UTM 17N - Ecuador septentrional",
    region: "Ecuador Norte",
    example: { easting: 776904.297, northing: -24350.768 },
  },
  {
    code: "UTM-17S",
    epsg: 32717,
    name: "UTM Zona 17 Sur",
    shortName: "UTM 17S",
    type: "projected",
    units: "meters",
    description: "UTM 17S - Ecuador occidental (Quito, Guayaquil)",
    region: "Ecuador Occidental",
    example: { easting: 776904.297, northing: 9975649.232 },
  },
  {
    code: "UTM-18N",
    epsg: 32618,
    name: "UTM Zona 18 Norte",
    shortName: "UTM 18N",
    type: "projected",
    units: "meters",
    description: "UTM 18N - Ecuador nororiental",
    region: "Ecuador Noreste",
    example: { easting: 108925.157, northing: -24373.755 },
  },
  {
    code: "UTM-18S",
    epsg: 32718,
    name: "UTM Zona 18 Sur",
    shortName: "UTM 18S",
    type: "projected",
    units: "meters",
    description: "UTM 18S - Ecuador oriental (Amazonía)",
    region: "Ecuador Oriental",
    example: { easting: 108925.157, northing: 9975626.245 },
  },
];

// Convertir grados decimales a DMS
export const decimalToDMS = (decimal, type = "lat") => {
  const abs = Math.abs(decimal);
  let degrees = Math.floor(abs);
  let minutes = Math.floor((abs - degrees) * 60);
  let seconds = Number((((abs - degrees) * 60 - minutes) * 60).toFixed(3));

  // Evitar resultados como 59' 60.000"
  if (seconds >= 60) {
    seconds -= 60;
    minutes += 1;
  }
  if (minutes >= 60) {
    minutes -= 60;
    degrees += 1;
  }

  let direction;
  if (type === "lat") {
    direction = decimal >= 0 ? "N" : "S";
  } else {
    direction = decimal >= 0 ? "E" : "W";
  }

  return {
    degrees,
    minutes,
    seconds,
    direction,
    formatted: `${degrees}° ${minutes}' ${seconds.toFixed(3)}" ${direction}`,
    decimal: decimal,
  };
};

// Convertir DMS a grados decimales
export const dmsToDecimal = (degrees, minutes, seconds, direction) => {
  let decimal =
    Math.abs(degrees) + Math.abs(minutes) / 60 + Math.abs(seconds) / 3600;
  if (direction === "S" || direction === "W") {
    decimal = -decimal;
  }
  return decimal;
};

// Validar componentes DMS (minutos/segundos en [0, 60))
export const validateDMS = (degrees, minutes, seconds, type = "lat") => {
  const errors = [];
  const values = [degrees, minutes, seconds].map((v) =>
    typeof v === "string" ? parseNumber(v) : v
  );
  const [d, m, s] = values;
  const maxDegrees = type === "lat" ? 90 : 180;

  if (values.some((v) => typeof v !== "number" || Number.isNaN(v))) {
    errors.push("Grados, minutos y segundos deben ser números válidos");
  } else {
    if (d < 0 || d > maxDegrees) {
      errors.push(`Grados deben estar entre 0 y ${maxDegrees}`);
    }
    if (m < 0 || m >= 60) errors.push("Minutos deben estar entre 0 y 59");
    if (s < 0 || s >= 60) errors.push("Segundos deben estar entre 0 y 59.999");
  }

  return { isValid: errors.length === 0, errors };
};

// Auto-detectar mejor sistema para Ecuador
export const detectBestSystem = (lat, lng) => {
  // Para área metropolitana de Quito
  if (lat >= -0.5 && lat <= 0.5 && lng >= -79 && lng <= -78) {
    return "SIRES-DMQ";
  }

  // Zona 17: -84° a -78° | Zona 18: -78° a -72°
  if (lat >= 0) {
    return lng < -78 ? "UTM-17N" : "UTM-18N";
  }
  return lng < -78 ? "UTM-17S" : "UTM-18S";
};

// Rangos aceptados por sistema proyectado (Ecuador continental, con margen).
// Valores fuera de estos rangos casi siempre indican columnas invertidas,
// sistema de origen equivocado o errores de digitación.
export const PROJECTED_RANGES = {
  "SIRES-DMQ": {
    easting: [450000, 550000],
    northing: [9950000, 10050000],
    label: "SIRES-DMQ",
  },
  "UTM-17S": { easting: [100000, 900000], northing: [9400000, 10200000] },
  "UTM-18S": { easting: [100000, 900000], northing: [9400000, 10200000] },
  "UTM-17N": { easting: [100000, 900000], northing: [-600000, 200000] },
  "UTM-18N": { easting: [100000, 900000], northing: [-600000, 200000] },
};

const formatRange = ([min, max]) =>
  `${min.toLocaleString("es-EC")} – ${max.toLocaleString("es-EC")}`;

// Validar coordenadas geográficas
export const validateCoordinates = (lat, lng) => {
  const errors = [];
  const parsedLat = typeof lat === "string" ? parseNumber(lat) : lat;
  const parsedLng = typeof lng === "string" ? parseNumber(lng) : lng;

  const latIsNumber = typeof parsedLat === "number" && !isNaN(parsedLat);
  const lngIsNumber = typeof parsedLng === "number" && !isNaN(parsedLng);

  if (!latIsNumber) {
    errors.push("Latitud debe ser un número válido");
  } else if (parsedLat < -90 || parsedLat > 90) {
    errors.push("Latitud debe estar entre -90 y 90 grados");
  }

  if (!lngIsNumber) {
    errors.push("Longitud debe ser un número válido");
  } else if (parsedLng < -180 || parsedLng > 180) {
    errors.push("Longitud debe estar entre -180 y 180 grados");
  }

  if (latIsNumber && lngIsNumber && errors.length === 0) {
    if (parsedLat < -5 || parsedLat > 2) {
      errors.push("Latitud fuera del rango típico de Ecuador (-5° a 2°)");
    }
    if (parsedLng < -92 || parsedLng > -75) {
      errors.push("Longitud fuera del rango típico de Ecuador (-92° a -75°)");
    }
    // Ecuador está al oeste de Greenwich: una longitud positiva suele ser un
    // signo omitido, y valores invertidos suelen ser columnas cruzadas.
    if (parsedLng > 75 && parsedLng < 92) {
      errors.push("Longitud positiva: ¿falta el signo negativo (oeste)?");
    } else if (parsedLat < -75 && parsedLat > -92 && parsedLng > -5) {
      errors.push("Parece que latitud y longitud están intercambiadas");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    parsedLat,
    parsedLng,
  };
};

// Validar coordenadas proyectadas
export const validateProjectedCoordinates = (easting, northing, system) => {
  const errors = [];
  const parsedEasting =
    typeof easting === "string" ? parseNumber(easting) : easting;
  const parsedNorthing =
    typeof northing === "string" ? parseNumber(northing) : northing;

  const eastingIsNumber =
    typeof parsedEasting === "number" && !isNaN(parsedEasting);
  const northingIsNumber =
    typeof parsedNorthing === "number" && !isNaN(parsedNorthing);

  if (!eastingIsNumber) errors.push("Este debe ser un número válido");
  if (!northingIsNumber) errors.push("Norte debe ser un número válido");

  const range = PROJECTED_RANGES[system];
  if (system && !range) {
    errors.push(`Sistema de coordenadas no soportado: ${system}`);
  }

  if (eastingIsNumber && northingIsNumber && range) {
    const name = range.label || system;
    const [eMin, eMax] = range.easting;
    const [nMin, nMax] = range.northing;
    const eastingOut = parsedEasting < eMin || parsedEasting > eMax;
    const northingOut = parsedNorthing < nMin || parsedNorthing > nMax;

    // Este y Norte intercambiados: cada valor encaja en el rango del otro
    const swapped =
      eastingOut &&
      northingOut &&
      parsedNorthing >= eMin &&
      parsedNorthing <= eMax &&
      parsedEasting >= nMin &&
      parsedEasting <= nMax;

    if (swapped) {
      errors.push("Parece que Este y Norte están intercambiados");
    } else {
      if (eastingOut) {
        errors.push(
          `Este fuera del rango típico de ${name} (${formatRange(range.easting)})`
        );
      }
      if (northingOut) {
        errors.push(
          `Norte fuera del rango típico de ${name} (${formatRange(range.northing)})`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    parsedEasting,
    parsedNorthing,
  };
};

// Valida un punto en cualquier sistema soportado (x = lon/Este, y = lat/Norte)
export const validateInSystem = (x, y, crs) => {
  if (!COORDINATE_SYSTEMS[crs]) {
    return { isValid: false, errors: [`Sistema no soportado: ${crs}`] };
  }
  if (isGeographicCRS(crs)) {
    const { isValid, errors } = validateCoordinates(y, x);
    return { isValid, errors };
  }
  const { isValid, errors } = validateProjectedCoordinates(x, y, crs);
  return { isValid, errors };
};

// Transformación simple entre dos sistemas
export const transformCoordinate = (x, y, fromCRS, toCRS) => {
  try {
    const parsedX = typeof x === "string" ? parseNumber(x) : x;
    const parsedY = typeof y === "string" ? parseNumber(y) : y;

    if (
      typeof parsedX !== "number" ||
      typeof parsedY !== "number" ||
      isNaN(parsedX) ||
      isNaN(parsedY)
    ) {
      throw new Error(
        "Coordenadas inválidas - no se pudieron convertir a números"
      );
    }

    if (!COORDINATE_SYSTEMS[fromCRS]) {
      throw new Error(`Sistema de origen no soportado: ${fromCRS}`);
    }
    if (!COORDINATE_SYSTEMS[toCRS]) {
      throw new Error(`Sistema de destino no soportado: ${toCRS}`);
    }

    const [tx, ty] = proj4(fromCRS, toCRS, [parsedX, parsedY]);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
      throw new Error("Resultado fuera del dominio de la proyección");
    }

    return { success: true, x: tx, y: ty, error: null };
  } catch (error) {
    return {
      success: false,
      x: null,
      y: null,
      error: `Error en transformación: ${error.message}`,
    };
  }
};

// Devuelve {lat, lng} WGS84 de un punto en cualquier sistema soportado
export const toWGS84 = (x, y, crs) => {
  if (isGeographicCRS(crs)) return { lat: y, lng: x };
  const result = transformCoordinate(x, y, crs, "EPSG:4326");
  return result.success ? { lat: result.y, lng: result.x } : null;
};

// WGS84 de un resultado de transformación (incluye historiales antiguos
// guardados antes de que existiera el campo `wgs84`).
export const getResultWGS84 = (result) => {
  if (!result) return null;
  if (
    result.wgs84 &&
    Number.isFinite(result.wgs84.lat) &&
    Number.isFinite(result.wgs84.lng)
  ) {
    return result.wgs84;
  }
  const t = result.transformation;
  if (t?.source && Number.isFinite(t.source.x) && Number.isFinite(t.source.y)) {
    return toWGS84(t.source.x, t.source.y, t.source.crs);
  }
  if (t?.target && Number.isFinite(t.target.x) && Number.isFinite(t.target.y)) {
    return toWGS84(t.target.x, t.target.y, t.target.crs);
  }
  if (result.coordinates) {
    return { lat: result.coordinates.latitude, lng: result.coordinates.longitude };
  }
  return null;
};

const makeId = (base, suffix = "") =>
  `${base}${suffix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const roundTo = (value, decimals) => Number(value.toFixed(decimals));

// Procesamiento por lotes
export const transformCoordinatesBatch = async (
  coordinates,
  settings = {},
  progressCallback = null
) => {
  const defaultSettings = {
    sourceCRS: "EPSG:4326",
    targetCRS: "UTM-17S",
    precision: null, // null = automático según unidades del sistema destino
    validateInput: true,
    skipInvalid: true,
    includeOriginal: true,
    generateReport: true,
    generateAllSystems: false,
  };

  const config = { ...defaultSettings, ...settings };
  const results = [];
  const report = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    startTime: new Date(),
    endTime: null,
    processingTime: 0,
  };

  const total = coordinates.length;
  const decimalsFor = (crs) => config.precision ?? getDecimalsForCRS(crs);

  for (let i = 0; i < total; i++) {
    const coord = coordinates[i];

    try {
      let sourceX, sourceY, sourceCRS;

      if (coord.coordinates) {
        sourceX = parseNumber(coord.coordinates.longitude);
        sourceY = parseNumber(coord.coordinates.latitude);
        sourceCRS = "EPSG:4326";
      } else if (coord.easting !== undefined && coord.northing !== undefined) {
        sourceX = parseNumber(coord.easting);
        sourceY = parseNumber(coord.northing);
        sourceCRS = coord.system || config.sourceCRS;
      } else {
        throw new Error("Formato de coordenadas no reconocido");
      }

      if (isNaN(sourceX) || isNaN(sourceY)) {
        throw new Error("Coordenadas contienen valores no numéricos");
      }

      if (config.validateInput) {
        const validation = validateInSystem(sourceX, sourceY, sourceCRS);
        if (!validation.isValid) {
          throw new Error(validation.errors.join("; "));
        }
      }

      const source = { x: sourceX, y: sourceY, crs: sourceCRS };
      const wgs84 = toWGS84(sourceX, sourceY, sourceCRS);
      const targets =
        config.generateAllSystems || coord.targetSystem === "all"
          ? SUPPORTED_SYSTEMS
          : [coord.targetSystem && coord.targetSystem !== "all"
              ? coord.targetSystem
              : config.targetCRS];

      const transformations = {};
      for (const targetSystem of targets) {
        const transformation = transformCoordinate(
          sourceX,
          sourceY,
          sourceCRS,
          targetSystem
        );
        if (!transformation.success) {
          if (targets.length === 1) throw new Error(transformation.error);
          continue;
        }

        const decimals = decimalsFor(targetSystem);
        transformations[targetSystem] = {
          source,
          target: {
            x: roundTo(transformation.x, decimals),
            y: roundTo(transformation.y, decimals),
            crs: targetSystem,
          },
          ...(targetSystem === sourceCRS ? { isOriginal: true } : {}),
          ...(isGeographicCRS(targetSystem)
            ? {
                dms: {
                  lat: decimalToDMS(transformation.y, "lat"),
                  lng: decimalToDMS(transformation.x, "lng"),
                },
              }
            : {}),
        };
      }

      const transformed = Object.values(transformations);
      if (transformed.length === 0) {
        throw new Error("No se pudo transformar a ningún sistema");
      }

      const result = {
        id: makeId(coord.id || i + 1),
        name: coord.name || `Punto ${i + 1}`,
        status: "success",
        transformation: transformed[0],
        wgs84,
      };
      if (targets.length > 1) result.transformations = transformations;
      if (coord.description) result.description = coord.description;
      if (config.includeOriginal) result.original = coord;

      results.push(result);
      report.successful++;
    } catch (error) {
      report.failed++;
      report.errors.push({
        index: i + 1,
        name: coord.name || `Punto ${i + 1}`,
        error: error.message,
      });

      if (!config.skipInvalid) {
        throw error;
      }

      results.push({
        id: makeId(coord.id || i + 1, "_error"),
        name: coord.name || `Punto ${i + 1}`,
        status: "error",
        error: error.message,
        original: config.includeOriginal ? coord : undefined,
      });
    }

    if (progressCallback && i % 10 === 0) {
      const progress = Math.round(((i + 1) / total) * 100);
      progressCallback(
        progress,
        `Procesando coordenada ${i + 1} de ${total}...`
      );
    }

    // Ceder el hilo principal para no congelar la interfaz
    if (i > 0 && i % 500 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  report.endTime = new Date();
  report.processingTime = report.endTime - report.startTime;
  report.totalProcessed = total;

  if (progressCallback) {
    progressCallback(100, "Transformación completada");
  }

  return {
    success: true,
    results,
    report: config.generateReport ? report : undefined,
    summary: {
      total: total,
      successful: report.successful,
      failed: report.failed,
      skipped: report.skipped,
    },
  };
};

// Formatear coordenadas para mostrar
export const formatCoordinate = (value, type = "decimal", precision = 6) => {
  if (value === null || value === undefined || isNaN(value)) {
    return "-";
  }

  switch (type) {
    case "lat":
    case "lng":
      return `${value.toFixed(precision)}°`;
    case "utm":
    case "projected":
      return `${value.toFixed(2)} m`;
    case "dms":
      return value;
    default:
      return value.toFixed(precision);
  }
};

// Valor con unidades según el sistema: "-0.22010000°" o "498630.153 m"
export const formatWithUnits = (value, crs) => {
  const formatted = formatForCRS(value, crs);
  if (!formatted) return "-";
  return isGeographicCRS(crs) ? `${formatted}°` : `${formatted} m`;
};

// Función para obtener estadísticas de transformación
export const getTransformationStats = (results) => {
  const total = results.length;
  const successful = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;

  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? ((successful / total) * 100).toFixed(1) : 0,
  };
};

// ==================== FUNCIONES ADICIONALES ====================

// Calcular distancia entre dos puntos en coordenadas geográficas (Haversine)
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Radio medio de la Tierra en metros
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return {
    meters: distance,
    kilometers: distance / 1000,
    formatted:
      distance > 1000
        ? `${(distance / 1000).toFixed(2)} km`
        : `${distance.toFixed(2)} m`,
  };
};

// Copiar texto al portapapeles
export const copyToClipboard = (text) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => false);
  }
  // Fallback para navegadores antiguos
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.select();
    const result = document.execCommand("copy");
    document.body.removeChild(textArea);
    return Promise.resolve(result);
  } catch {
    return Promise.resolve(false);
  }
};

// Formatear coordenadas para copiar
export const formatCoordinatesForCopy = (result) => {
  if (!result.transformation) return "";

  const { source, target } = result.transformation;
  const describe = ({ x, y, crs }) =>
    isGeographicCRS(crs)
      ? `  Latitud: ${formatWithUnits(y, crs)}\n  Longitud: ${formatWithUnits(x, crs)}`
      : `  Este (X): ${formatWithUnits(x, crs)}\n  Norte (Y): ${formatWithUnits(y, crs)}`;

  return `${result.name || "Punto"}
Coordenadas Originales (${source.crs}):
${describe(source)}

Coordenadas Transformadas (${target.crs}):
${describe(target)}`;
};
