// src/utils/coordinateTransformations.js
import proj4 from "proj4";
import * as XLSX from "xlsx";

// Sistemas de coordenadas para Ecuador
const COORDINATE_SYSTEMS = {
  // Geográficas
  "EPSG:4326": "+proj=longlat +datum=WGS84 +no_defs",

  // SIRES-DMQ (Sistema oficial de Quito)
  "SIRES-DMQ":
    "+proj=tmerc +lat_0=0 +lon_0=-78.5 +k=1.0004584 +x_0=500000 +y_0=10000000 +ellps=WGS84 +datum=WGS84 +units=m +no_defs",

  // UTM para Ecuador
  "UTM-17N": "+proj=utm +zone=17 +north +datum=WGS84 +units=m +no_defs",
  "UTM-17S": "+proj=utm +zone=17 +south +datum=WGS84 +units=m +no_defs",
  "UTM-18N": "+proj=utm +zone=18 +north +datum=WGS84 +units=m +no_defs",
  "UTM-18S": "+proj=utm +zone=18 +south +datum=WGS84 +units=m +no_defs",
};

// Registrar proyecciones
Object.entries(COORDINATE_SYSTEMS).forEach(([code, definition]) => {
  proj4.defs(code, definition);
});

// Función para normalizar números (manejo de puntos y comas)
export const parseNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string" && typeof value !== "number") return NaN;

  let cleaned = value.toString().trim();
  if (!cleaned) return NaN;

  if (cleaned.includes(".") && cleaned.includes(",")) {
    if (cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",")) {
      cleaned = cleaned.replace(/,/g, "");
    } else {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    const commaCount = (cleaned.match(/,/g) || []).length;
    if (commaCount === 1) {
      const parts = cleaned.split(",");
      const afterComma = parts[1];
      if (afterComma && afterComma.length <= 6 && /^\d+$/.test(afterComma)) {
        cleaned = cleaned.replace(",", ".");
      } else {
        cleaned = cleaned.replace(/,/g, "");
      }
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(".") && !cleaned.includes(",")) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1) {
      const lastDotIndex = cleaned.lastIndexOf(".");
      const afterLastDot = cleaned.substring(lastDotIndex + 1);
      if (afterLastDot.length <= 3 && /^\d+$/.test(afterLastDot)) {
        cleaned = cleaned.replace(/\./g, "");
        cleaned =
          cleaned.slice(0, lastDotIndex - (dotCount - 1)) + "." + afterLastDot;
      } else {
        cleaned = cleaned.replace(/\./g, "");
      }
    }
  }

  const result = parseFloat(cleaned);
  return isNaN(result) ? NaN : result;
};

// Configuración de sistemas disponibles
export const getEcuadorSystems = () => [
  {
    code: "EPSG:4326",
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
    name: "SIRES-DMQ (Quito)",
    shortName: "SIRES-DMQ",
    type: "projected",
    units: "meters",
    description:
      "Sistema de Referencia Espacial del Distrito Metropolitano de Quito",
    region: "Quito Metropolitano",
    example: { easting: 499450, northing: 9975663 },
  },
  {
    code: "UTM-17N",
    name: "UTM Zona 17 Norte",
    shortName: "UTM 17N",
    type: "projected",
    units: "meters",
    description: "UTM 17N - Ecuador septentrional",
    region: "Ecuador Norte",
    example: { easting: 194617, northing: 24367 },
  },
  {
    code: "UTM-17S",
    name: "UTM Zona 17 Sur",
    shortName: "UTM 17S",
    type: "projected",
    units: "meters",
    description: "UTM 17S - Ecuador occidental (Quito, Guayaquil)",
    region: "Ecuador Occidental",
    example: { easting: 694617, northing: 9975663 },
  },
  {
    code: "UTM-18N",
    name: "UTM Zona 18 Norte",
    shortName: "UTM 18N",
    type: "projected",
    units: "meters",
    description: "UTM 18N - Ecuador nororiental",
    region: "Ecuador Noreste",
    example: { easting: 294617, northing: 24367 },
  },
  {
    code: "UTM-18S",
    name: "UTM Zona 18 Sur",
    shortName: "UTM 18S",
    type: "projected",
    units: "meters",
    description: "UTM 18S - Ecuador oriental (Amazonía)",
    region: "Ecuador Oriental",
    example: { easting: 794617, northing: 9975663 },
  },
];

// Convertir grados decimales a DMS
export const decimalToDMS = (decimal, type = "lat") => {
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutes = Math.floor((abs - degrees) * 60);
  const seconds = ((abs - degrees) * 60 - minutes) * 60;

  let direction;
  if (type === "lat") {
    direction = decimal >= 0 ? "N" : "S";
  } else {
    direction = decimal >= 0 ? "E" : "W";
  }

  return {
    degrees,
    minutes,
    seconds: parseFloat(seconds.toFixed(3)),
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

// Auto-detectar mejor sistema para Ecuador (CORREGIDO)
export const detectBestSystem = (lat, lng) => {
  // Para área metropolitana de Quito
  if (lat >= -0.5 && lat <= 0.5 && lng >= -79 && lng <= -78) {
    return "SIRES-DMQ";
  }

  // Para Ecuador por longitud (CORRECTO)
  // Zona 17: -84° a -78° | Zona 18: -78° a -72°
  if (lat >= 0) {
    // Hemisferio norte
    return lng < -78 ? "UTM-17N" : "UTM-18N";
  } else {
    // Hemisferio sur (mayoría de Ecuador)
    return lng < -78 ? "UTM-17S" : "UTM-18S";
  }
};

// Validar coordenadas geográficas
export const validateCoordinates = (lat, lng) => {
  const errors = [];
  const parsedLat = typeof lat === "string" ? parseNumber(lat) : lat;
  const parsedLng = typeof lng === "string" ? parseNumber(lng) : lng;

  if (typeof parsedLat !== "number" || isNaN(parsedLat)) {
    errors.push("Latitud debe ser un número válido");
  } else if (parsedLat < -90 || parsedLat > 90) {
    errors.push("Latitud debe estar entre -90 y 90 grados");
  }

  if (typeof parsedLng !== "number" || isNaN(parsedLng)) {
    errors.push("Longitud debe ser un número válido");
  } else if (parsedLng < -180 || parsedLng > 180) {
    errors.push("Longitud debe estar entre -180 y 180 grados");
  }

  if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
    if (parsedLat < -5 || parsedLat > 2) {
      errors.push("Latitud fuera del rango típico de Ecuador (-5° a 2°)");
    }
    if (parsedLng < -92 || parsedLng > -75) {
      errors.push("Longitud fuera del rango típico de Ecuador (-92° a -75°)");
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

  if (typeof parsedEasting !== "number" || isNaN(parsedEasting)) {
    errors.push("Este debe ser un número válido");
  }

  if (typeof parsedNorthing !== "number" || isNaN(parsedNorthing)) {
    errors.push("Norte debe ser un número válido");
  }

  if (!isNaN(parsedEasting) && !isNaN(parsedNorthing)) {
    if (system === "SIRES-DMQ") {
      if (parsedEasting < 450000 || parsedEasting > 550000) {
        errors.push("Este fuera del rango típico de SIRES-DMQ (450000-550000)");
      }
      if (parsedNorthing < 9950000 || parsedNorthing > 10050000) {
        errors.push(
          "Norte fuera del rango típico de SIRES-DMQ (9950000-10050000)"
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

// Transformación simple entre dos sistemas (ESTRUCTURA LIMPIA)
export const transformCoordinate = (x, y, fromCRS, toCRS) => {
  try {
    const parsedX = typeof x === "string" ? parseNumber(x) : x;
    const parsedY = typeof y === "string" ? parseNumber(y) : y;

    if (isNaN(parsedX) || isNaN(parsedY)) {
      throw new Error(
        "Coordenadas inválidas - no se pudieron convertir a números"
      );
    }

    const transformResult = proj4(fromCRS, toCRS, [parsedX, parsedY]);
    return {
      success: true,
      x: transformResult[0],
      y: transformResult[1],
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      x: null,
      y: null,
      error: `Error en transformación: ${error.message}`,
    };
  }
};

// Procesamiento por lotes - VERSIÓN LIMPIA Y COMPLETA
export const transformCoordinatesBatch = async (
  coordinates,
  settings = {},
  progressCallback = null
) => {
  const defaultSettings = {
    sourceCRS: "EPSG:4326",
    targetCRS: "UTM-17S",
    precision: 6,
    validateInput: true,
    skipInvalid: true,
    includeOriginal: true,
    calculatePrecision: false,
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
  const allSystems = [
    "EPSG:4326",
    "SIRES-DMQ",
    "UTM-17N",
    "UTM-17S",
    "UTM-18N",
    "UTM-18S",
  ];

  for (let i = 0; i < total; i++) {
    const coord = coordinates[i];

    try {
      let sourceX, sourceY, sourceCRS;

      if (coord.coordinates) {
        sourceX = parseNumber(coord.coordinates.longitude);
        sourceY = parseNumber(coord.coordinates.latitude);
        sourceCRS = "EPSG:4326";
      } else if (coord.easting && coord.northing) {
        sourceX = parseNumber(coord.easting);
        sourceY = parseNumber(coord.northing);
        sourceCRS = coord.system || config.sourceCRS;
      } else {
        throw new Error("Formato de coordenadas no reconocido");
      }

      if (isNaN(sourceX) || isNaN(sourceY)) {
        throw new Error("Coordenadas contienen valores no numéricos");
      }

      if (config.generateAllSystems || coord.targetSystem === "all") {
        const baseResult = {
          id: `${coord.id || i + 1}_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          name: coord.name || `Punto ${i + 1}`,
          status: "success",
          transformations: {},
        };

        let hasAnySuccess = false;

        for (const targetSystem of allSystems) {
          if (targetSystem === sourceCRS) {
            baseResult.transformations[targetSystem] = {
              source: { x: sourceX, y: sourceY, crs: sourceCRS },
              target: { x: sourceX, y: sourceY, crs: targetSystem },
              isOriginal: true,
            };
            hasAnySuccess = true;
            continue;
          }

          const transformation = transformCoordinate(
            sourceX,
            sourceY,
            sourceCRS,
            targetSystem
          );

          if (transformation.success) {
            baseResult.transformations[targetSystem] = {
              source: { x: sourceX, y: sourceY, crs: sourceCRS },
              target: {
                x: parseFloat(transformation.x.toFixed(config.precision)),
                y: parseFloat(transformation.y.toFixed(config.precision)),
                crs: targetSystem,
              },
            };

            if (targetSystem === "EPSG:4326") {
              baseResult.transformations[targetSystem].dms = {
                lat: decimalToDMS(transformation.y, "lat"),
                lng: decimalToDMS(transformation.x, "lng"),
              };
            }
            hasAnySuccess = true;
          }
        }

        if (hasAnySuccess) {
          const firstSuccessful = Object.values(baseResult.transformations)[0];
          baseResult.transformation = firstSuccessful;
          results.push(baseResult);
          report.successful++;
        } else {
          throw new Error("No se pudo transformar a ningún sistema");
        }
      } else {
        const transformation = transformCoordinate(
          sourceX,
          sourceY,
          sourceCRS,
          config.targetCRS
        );

        if (!transformation.success) {
          throw new Error(transformation.error);
        }

        const result = {
          id: `${coord.id || i + 1}_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          name: coord.name || `Punto ${i + 1}`,
          status: "success",
          transformation: {
            source: { x: sourceX, y: sourceY, crs: sourceCRS },
            target: {
              x: parseFloat(transformation.x.toFixed(config.precision)),
              y: parseFloat(transformation.y.toFixed(config.precision)),
              crs: config.targetCRS,
            },
          },
        };

        if (config.includeOriginal) {
          result.original = coord;
        }

        if (config.targetCRS === "EPSG:4326") {
          result.transformation.dms = {
            lat: decimalToDMS(transformation.y, "lat"),
            lng: decimalToDMS(transformation.x, "lng"),
          };
        }

        results.push(result);
        report.successful++;
      }
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
        id: `${coord.id || i + 1}_error_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
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

    if (i % 100 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1));
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

// Función de exportación
export const exportData = (results, format) => {
  const timestamp = new Date().toISOString().split("T")[0];

  if (format === "csv") {
    const headers = [
      "ID",
      "Nombre",
      "Estado",
      "Lat_Original",
      "Lng_Original",
      "Sistema_Original",
      "X_Transformado",
      "Y_Transformado",
      "Sistema_Destino",
      "Precision_Calidad",
    ];

    const csvData = [
      headers.join(","),
      ...results.map((r) => {
        const row = [
          r.id,
          `"${r.name || ""}"`,
          r.status,
          r.transformation?.source?.y
            ? r.transformation.source.y.toFixed(8)
            : "",
          r.transformation?.source?.x
            ? r.transformation.source.x.toFixed(8)
            : "",
          r.transformation?.source?.crs || "",
          r.transformation?.target?.x
            ? r.transformation.target.x.toFixed(2)
            : "",
          r.transformation?.target?.y
            ? r.transformation.target.y.toFixed(2)
            : "",
          r.transformation?.target?.crs || "",
          r.precision?.quality || "",
        ];
        return row.join(",");
      }),
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coordenadas_ecuador_${timestamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (format === "excel") {
    const excelData = results.map((r) => ({
      ID: r.id,
      Nombre: r.name || "",
      Estado: r.status,
      Lat_Original: r.transformation?.source?.y || "",
      Lng_Original: r.transformation?.source?.x || "",
      Sistema_Original: r.transformation?.source?.crs || "",
      X_Transformado: r.transformation?.target?.x || "",
      Y_Transformado: r.transformation?.target?.y || "",
      Sistema_Destino: r.transformation?.target?.crs || "",
      Precision_Calidad: r.precision?.quality || "",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coordenadas");
    XLSX.writeFile(wb, `coordenadas_ecuador_${timestamp}.xlsx`);
  }
};
