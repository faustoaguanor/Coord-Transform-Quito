// src/utils/exporters.js
// Exportación de resultados a CSV, Excel, GeoJSON y KML.
// Los build* son funciones puras (probadas con Vitest); exportData descarga.
import * as XLSX from "xlsx";
import {
  EPSG_CODES,
  getDecimalsForCRS,
  getResultWGS84,
  isGeographicCRS,
} from "./coordinateTransformations";

const round = (value, crs) =>
  typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(getDecimalsForCRS(crs)))
    : "";

/**
 * Tabla de exportación: columnas originales del archivo (si existen) seguidas
 * de las columnas calculadas. Los valores numéricos se redondean a 8 decimales
 * en grados (~1 mm) y 3 decimales en metros (1 mm).
 */
export const buildExportTable = (results) => {
  const attributeColumns = [];
  const seen = new Set();
  for (const result of results) {
    for (const key of Object.keys(result.original?.attributes ?? {})) {
      if (!seen.has(key)) {
        seen.add(key);
        attributeColumns.push(key);
      }
    }
  }

  const computed = [
    "Punto",
    "Estado",
    "Observacion",
    "Origen_Sistema",
    "Origen_X",
    "Origen_Y",
    "Destino_Sistema",
    "Destino_EPSG",
    "Destino_X",
    "Destino_Y",
    "WGS84_Lat",
    "WGS84_Lon",
  ];
  // Evitar colisiones con columnas del archivo original
  const computedNames = computed.map((c) => (seen.has(c) ? `${c}_transf` : c));

  const rows = results.map((result) => {
    const source = result.transformation?.source;
    const target = result.transformation?.target;
    const wgs84 = result.status === "success" ? getResultWGS84(result) : null;
    const values = [
      result.name ?? "",
      result.status === "success" ? "OK" : "ERROR",
      result.error ?? "",
      source?.crs ?? result.original?.system ?? "",
      source ? round(source.x, source.crs) : "",
      source ? round(source.y, source.crs) : "",
      target?.crs ?? "",
      target ? (EPSG_CODES[target.crs] ?? "") : "",
      target ? round(target.x, target.crs) : "",
      target ? round(target.y, target.crs) : "",
      wgs84 ? round(wgs84.lat, "EPSG:4326") : "",
      wgs84 ? round(wgs84.lng, "EPSG:4326") : "",
    ];

    const row = {};
    for (const key of attributeColumns) {
      row[key] = result.original?.attributes?.[key] ?? "";
    }
    computedNames.forEach((name, i) => {
      row[name] = values[i];
    });
    return row;
  });

  return { columns: [...attributeColumns, ...computedNames], rows };
};

// Neutraliza fórmulas (=, +, -, @) en texto para evitar "CSV injection"
// al abrir el archivo en Excel. Los números negativos no se tocan.
const sanitizeCell = (value) => {
  if (typeof value === "number") return String(value);
  const text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) {
    return `'${text}`;
  }
  return text;
};

const csvEscape = (value) => {
  const text = sanitizeCell(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const buildCSV = (results) => {
  const { columns, rows } = buildExportTable(results);
  const lines = [
    columns.map(csvEscape).join(","),
    ...rows.map((row) => columns.map((c) => csvEscape(row[c])).join(",")),
  ];
  // BOM para que Excel detecte UTF-8 (tildes, ñ)
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
};

// GeoJSON conforme a RFC 7946: la geometría SIEMPRE va en WGS84 (lon, lat).
// Las coordenadas del sistema destino van en las propiedades.
export const buildGeoJSON = (results) => {
  const { rows } = buildExportTable(results);
  const features = [];

  results.forEach((result, i) => {
    if (result.status !== "success") return;
    const wgs84 = getResultWGS84(result);
    if (!wgs84) return;
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [round(wgs84.lng, "EPSG:4326"), round(wgs84.lat, "EPSG:4326")],
      },
      properties: rows[i],
    });
  });

  return {
    type: "FeatureCollection",
    name: "coordenadas_transformadas",
    features,
  };
};

export const escapeXML = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const describePoint = ({ x, y, crs }) =>
  isGeographicCRS(crs)
    ? [
        ["Latitud", `${round(y, crs)}°`],
        ["Longitud", `${round(x, crs)}°`],
      ]
    : [
        ["Este (X)", `${round(x, crs)} m`],
        ["Norte (Y)", `${round(y, crs)} m`],
      ];

// KML (Google Earth): las coordenadas deben estar en WGS84 lon,lat
export const buildKML = (results, generatedAt = new Date()) => {
  const placemarks = results
    .filter((result) => result.status === "success")
    .map((result) => {
      const wgs84 = getResultWGS84(result);
      if (!wgs84) return null;
      const name = result.name || "Punto";
      const { source, target } = result.transformation ?? {};
      const rows = [];
      if (source) {
        rows.push(["Sistema origen", source.crs], ...describePoint(source));
      }
      if (target) {
        rows.push(["Sistema destino", target.crs], ...describePoint(target));
      }
      const table = rows
        .map(([k, v]) => `<tr><td>${escapeXML(k)}</td><td>${escapeXML(v)}</td></tr>`)
        .join("");

      return `    <Placemark>
      <name>${escapeXML(name)}</name>
      <description>${escapeXML(`<table border="1" cellpadding="4">${table}</table>`)}</description>
      <styleUrl>#defaultStyle</styleUrl>
      <Point>
        <coordinates>${round(wgs84.lng, "EPSG:4326")},${round(wgs84.lat, "EPSG:4326")},0</coordinates>
      </Point>
    </Placemark>`;
    })
    .filter(Boolean);

  return {
    count: placemarks.length,
    content: `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Coordenadas Transformadas UIO</name>
    <description>${escapeXML(`Exportado desde Transformador de Coordenadas Quito - ${generatedAt.toISOString()}`)}</description>
    <Style id="defaultStyle">
      <IconStyle>
        <scale>1.0</scale>
        <Icon>
          <href>https://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>0.8</scale>
      </LabelStyle>
    </Style>
${placemarks.join("\n")}
  </Document>
</kml>
`,
  };
};

const downloadFile = (content, fileName, mimeType) => {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const exportToExcel = (results) => {
  const { columns, rows } = buildExportTable(results);
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  worksheet["!cols"] = columns.map((c) => ({ wch: Math.max(12, c.length + 2) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Coordenadas");
  XLSX.writeFile(workbook, "coordenadas_transformadas.xlsx");
};

// Función principal de exportación
export const exportData = (results, format = "csv") => {
  if (!results || results.length === 0) {
    alert("No hay datos para exportar");
    return;
  }

  try {
    switch (format.toLowerCase()) {
      case "csv":
        downloadFile(
          buildCSV(results),
          "coordenadas_transformadas.csv",
          "text/csv;charset=utf-8"
        );
        break;
      case "excel":
        exportToExcel(results);
        break;
      case "geojson":
        downloadFile(
          JSON.stringify(buildGeoJSON(results), null, 2),
          "coordenadas_transformadas.geojson",
          "application/geo+json"
        );
        break;
      case "kml": {
        const { count, content } = buildKML(results);
        if (count === 0) {
          alert("No hay coordenadas válidas para exportar a KML");
          return;
        }
        downloadFile(
          content,
          "coordenadas_transformadas.kml",
          "application/vnd.google-earth.kml+xml"
        );
        break;
      }
      default:
        alert("Formato de exportación no soportado");
    }
  } catch (error) {
    console.error("Error en exportación:", error);
    alert(`Error al exportar: ${error.message}`);
  }
};
