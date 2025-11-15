// src/utils/coordinateTransformations.js
import proj4 from "proj4";

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

// ==================== FUNCIONES DE EXPORTACIÓN ====================

// Función principal de exportación
export const exportData = (results, format = "csv") => {
  if (!results || results.length === 0) {
    alert("No hay datos para exportar");
    return;
  }

  try {
    switch (format.toLowerCase()) {
      case "csv":
        exportToCSV(results);
        break;
      case "excel":
        exportToExcel(results);
        break;
      case "geojson":
        exportToGeoJSON(results);
        break;
      case "kml":
        exportToKML(results);
        break;
      default:
        console.error("Formato no soportado:", format);
        alert("Formato de exportación no soportado");
    }
  } catch (error) {
    console.error("Error en exportación:", error);
    alert(`Error al exportar: ${error.message}`);
  }
};

// Exportar a CSV
const exportToCSV = (results) => {
  const headers = [
    "ID",
    "Nombre",
    "Descripción",
    "Lat_Original",
    "Lng_Original",
    "Sistema_Original",
    "X_Transformado",
    "Y_Transformado",
    "Sistema_Destino",
    "Precisión",
    "Calidad_Precisión",
    "Estado",
  ];

  const rows = results.map((result) => [
    result.id || "",
    result.name || "",
    result.description || "",
    result.transformation?.source?.y?.toFixed(6) || "",
    result.transformation?.source?.x?.toFixed(6) || "",
    result.transformation?.source?.crs || "",
    result.transformation?.target?.x?.toFixed(2) || "",
    result.transformation?.target?.y?.toFixed(2) || "",
    result.transformation?.target?.crs || "",
    result.precision?.value?.toFixed(3) || "",
    result.precision?.quality || "",
    result.status || "",
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((field) => `"${field}"`).join(","))
    .join("\n");

  downloadFile(csvContent, "coordenadas_transformadas.csv", "text/csv");
};

// Exportar a Excel usando XLSX library
const exportToExcel = (results) => {
  // Preparar datos para XLSX
  const worksheetData = results.map((result) => ({
    ID: result.id || "",
    Nombre: result.name || "",
    Descripción: result.description || "",
    "Latitud Original": result.transformation?.source?.y?.toFixed(6) || "",
    "Longitud Original": result.transformation?.source?.x?.toFixed(6) || "",
    "Sistema Original": result.transformation?.source?.crs || "",
    "X Transformado (m)": result.transformation?.target?.x?.toFixed(2) || "",
    "Y Transformado (m)": result.transformation?.target?.y?.toFixed(2) || "",
    "Sistema Destino": result.transformation?.target?.crs || "",
    Precisión: result.precision?.value?.toFixed(3) || "",
    "Calidad Precisión": result.precision?.quality || "",
    Estado: result.status || "",
    "Fecha Procesamiento": new Date().toLocaleString("es-EC"),
  }));

  // Crear workbook y worksheet
  if (!window.XLSX) {
    throw new Error(
      "Librería XLSX no está disponible. Asegúrate de importar XLSX en App.jsx"
    );
  }
  const XLSX = window.XLSX;
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // Ajustar ancho de columnas
  const columnWidths = [
    { wch: 10 }, // ID
    { wch: 20 }, // Nombre
    { wch: 30 }, // Descripción
    { wch: 15 }, // Latitud Original
    { wch: 15 }, // Longitud Original
    { wch: 15 }, // Sistema Original
    { wch: 18 }, // X Transformado
    { wch: 18 }, // Y Transformado
    { wch: 15 }, // Sistema Destino
    { wch: 12 }, // Precisión
    { wch: 18 }, // Calidad Precisión
    { wch: 10 }, // Estado
    { wch: 20 }, // Fecha Procesamiento
  ];
  worksheet["!cols"] = columnWidths;

  // Agregar worksheet al workbook
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Coordenadas Transformadas"
  );

  // Exportar
  XLSX.writeFile(workbook, "coordenadas_transformadas.xlsx");
};

// Exportar a GeoJSON
const exportToGeoJSON = (results) => {
  const features = results
    .filter(
      (result) => result.transformation?.target && result.status === "success"
    )
    .map((result) => {
      // Usar DIRECTAMENTE las coordenadas transformadas (sistema destino)
      const longitude = result.transformation.target.x;
      const latitude = result.transformation.target.y;

      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        properties: {
          id: result.id,
          name: result.name || `Punto ${result.id}`,
          description: result.description || "",
          original_system: result.transformation.source?.crs || "",
          original_x: result.transformation.source?.x || null,
          original_y: result.transformation.source?.y || null,
          transformed_system: result.transformation.target?.crs || "",
          transformed_x: result.transformation.target?.x || null,
          transformed_y: result.transformation.target?.y || null,
          precision: result.precision?.value || null,
          precision_quality: result.precision?.quality || "",
          status: result.status || "",
          processed_date: new Date().toISOString(),
        },
      };
    });

  const geoJSON = {
    type: "FeatureCollection",
    crs: {
      type: "name",
      properties: {
        // Usar el sistema de coordenadas transformado, no WGS84
        name: results[0]?.transformation?.target?.crs || "SIRES-DMQ",
      },
    },
    features: features,
    metadata: {
      title: "Coordenadas Transformadas UIO",
      description: `Coordenadas en sistema ${
        results[0]?.transformation?.target?.crs || "transformado"
      }`,
      generated: new Date().toISOString(),
      total_points: features.length,
      coordinate_system: results[0]?.transformation?.target?.crs || "SIRES-DMQ",
      warning: "Las coordenadas están en el sistema transformado, no en WGS84",
    },
  };

  const geoJSONContent = JSON.stringify(geoJSON, null, 2);
  downloadFile(
    geoJSONContent,
    "coordenadas_transformadas.geojson",
    "application/geo+json"
  );
};

// Exportar a KML (compatible con Google Earth)
const exportToKML = (results) => {
  const validResults = results.filter(
    (result) => result.transformation?.source && result.status === "success"
  );

  if (validResults.length === 0) {
    alert("No hay coordenadas válidas para exportar a KML");
    return;
  }

  // KML requiere coordenadas en WGS84 (lat/lng)
  const placemarks = validResults.map((result) => {
    // Usar coordenadas originales si ya están en WGS84, sino transformar
    const lat = result.transformation.source.y;
    const lng = result.transformation.source.x;

    const name = result.name || `Punto ${result.id}`;
    const description = `
      <![CDATA[
        <h3>${name}</h3>
        <table border="1" cellpadding="5">
          <tr><th colspan="2">Coordenadas Originales</th></tr>
          <tr><td>Latitud</td><td>${lat.toFixed(6)}°</td></tr>
          <tr><td>Longitud</td><td>${lng.toFixed(6)}°</td></tr>
          <tr><td>Sistema</td><td>${result.transformation.source.crs}</td></tr>
          ${result.transformation.target ? `
          <tr><th colspan="2">Coordenadas Transformadas</th></tr>
          <tr><td>Sistema</td><td>${result.transformation.target.crs}</td></tr>
          <tr><td>Este (X)</td><td>${result.transformation.target.x.toFixed(2)} m</td></tr>
          <tr><td>Norte (Y)</td><td>${result.transformation.target.y.toFixed(2)} m</td></tr>
          ` : ''}
          ${result.precision ? `
          <tr><th colspan="2">Precisión</th></tr>
          <tr><td>Calidad</td><td>${result.precision.quality}</td></tr>
          ` : ''}
        </table>
      ]]>
    `;

    return `
    <Placemark>
      <name>${escapeXML(name)}</name>
      <description>${description}</description>
      <Point>
        <coordinates>${lng},${lat},0</coordinates>
      </Point>
      <Style>
        <IconStyle>
          <color>ff0000ff</color>
          <scale>1.0</scale>
        </IconStyle>
      </Style>
    </Placemark>`;
  }).join('\n');

  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Coordenadas Transformadas UIO</name>
    <description>Exportado desde Transformador de Coordenadas Quito - ${new Date().toLocaleString('es-EC')}</description>
    <Style id="defaultStyle">
      <IconStyle>
        <color>ff0000ff</color>
        <scale>1.0</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>0.8</scale>
      </LabelStyle>
    </Style>
    ${placemarks}
  </Document>
</kml>`;

  downloadFile(kmlContent, "coordenadas_transformadas.kml", "application/vnd.google-earth.kml+xml");
};

// Función auxiliar para escapar caracteres XML
const escapeXML = (str) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// Función auxiliar para descargar archivos
const downloadFile = (content, fileName, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Función para obtener estadísticas de transformación
export const getTransformationStats = (results) => {
  const total = results.length;
  const successful = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;
  const excellent = results.filter(
    (r) => r.precision?.quality === "Excelente"
  ).length;
  const veryGood = results.filter(
    (r) => r.precision?.quality === "Muy buena"
  ).length;
  const good = results.filter((r) => r.precision?.quality === "Buena").length;

  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? ((successful / total) * 100).toFixed(1) : 0,
    precision: {
      excellent,
      veryGood,
      good,
      excellentRate: total > 0 ? ((excellent / total) * 100).toFixed(1) : 0,
    },
  };
};

// ==================== FUNCIONES ADICIONALES ====================

// Calcular distancia entre dos puntos en coordenadas geográficas (Haversine)
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Radio de la Tierra en metros
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
    formatted: distance > 1000
      ? `${(distance / 1000).toFixed(2)} km`
      : `${distance.toFixed(2)} m`,
  };
};

// Copiar texto al portapapeles
export const copyToClipboard = (text) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
      .then(() => true)
      .catch(() => false);
  } else {
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
  }
};

// Formatear coordenadas para copiar
export const formatCoordinatesForCopy = (result) => {
  if (!result.transformation) return "";

  const source = result.transformation.source;
  const target = result.transformation.target;

  return `${result.name || "Punto"}
Coordenadas Originales (${source.crs}):
  Latitud: ${source.y.toFixed(6)}°
  Longitud: ${source.x.toFixed(6)}°

Coordenadas Transformadas (${target.crs}):
  Este (X): ${target.x.toFixed(2)} m
  Norte (Y): ${target.y.toFixed(2)} m`;
};
