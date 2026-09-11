import { useState } from "react";
import * as XLSX from "xlsx";

const FileUpload = ({ onFileUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [transformSettings, setTransformSettings] = useState({
    sourceSystem: "auto", // auto-detectar
    targetSystem: "SIRES-DMQ", // transformar a todos los sistemas
  });

  // Función para normalizar números (manejo de puntos y comas)
  const parseNumber = (value) => {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return NaN;

    // Remover espacios
    let cleaned = value.toString().trim();

    // Si contiene tanto punto como coma, asumir que coma es separador de miles
    if (cleaned.includes(".") && cleaned.includes(",")) {
      // Formato: 1,234.56 (inglés)
      if (cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",")) {
        cleaned = cleaned.replace(/,/g, "");
      }
      // Formato: 1.234,56 (europeo)
      else {
        cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      }
    }
    // Solo coma (puede ser decimal europeo)
    else if (cleaned.includes(",") && !cleaned.includes(".")) {
      // Si hay más de una coma, es separador de miles
      const commaCount = (cleaned.match(/,/g) || []).length;
      if (commaCount === 1) {
        // Verificar si es decimal (números después de coma son <= 6 dígitos)
        const afterComma = cleaned.split(",")[1];
        if (afterComma && afterComma.length <= 6) {
          cleaned = cleaned.replace(",", ".");
        } else {
          cleaned = cleaned.replace(/,/g, "");
        }
      } else {
        cleaned = cleaned.replace(/,/g, "");
      }
    }

    return parseFloat(cleaned);
  };

  // Función para detectar formato de coordenadas con nombres flexibles
  const detectCoordinateFormat = (headers) => {
    const headerMap = {};

    headers.forEach((header, index) => {
      const cleanHeader = header
        .toString()
        .replace(/^\uFEFF/, "")
        .toLowerCase()
        .trim();

      // Detectar latitud geográfica
      if (cleanHeader.match(/^(lat|latitude|latitud)$/)) {
        headerMap.lat = index;
      }
      // Detectar longitud geográfica
      else if (
        cleanHeader.match(/^(lon|lng|long|longitude|longitud)$/)
      ) {
        headerMap.lng = index;
      }
      // Detectar coordenadas UTM X
      else if (
        cleanHeader.match(/^(x|este|easting|utm_x|coord_x|coordenada_x)$/)
      ) {
        headerMap.x = index;
      }
      // Detectar coordenadas UTM Y
      else if (
        cleanHeader.match(/^(y|norte|northing|utm_y|coord_y|coordenada_y)$/)
      ) {
        headerMap.y = index;
      }
      // Detectar zona UTM
      else if (
        cleanHeader.match(/^(zone|zona|utm_zone|hemisphere|hemisferio)$/)
      ) {
        headerMap.zone = index;
      }
      // Detectar nombre del punto
      else if (cleanHeader.match(/^(name|nombre|punto|id|identificador)$/)) {
        headerMap.name = index;
      }
    });

    return headerMap;
  };

  const detectDelimiter = (line) => {
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
    return best?.count > 0 ? best.delimiter : ",";
  };

  const detectProjectedSystem = (x, y) => {
    if (x > 450000 && x < 550000 && y > 9950000 && y < 10050000) {
      return "SIRES-DMQ";
    }

    if (x > 200000 && x < 800000) {
      if (y > 9000000) return "UTM-17S";
      if (y < 1000000) return "UTM-17N";
      if (y > 800000) return "UTM-18S";
      return "UTM-18N";
    }

    return "UTM-17S";
  };

  // Función mejorada para parsear CSV
  const parseCSV = (text) => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line);

    if (lines.length === 0) return [];

    const delimiter = detectDelimiter(lines[0]);
    const result = [];

    for (const line of lines) {
      const row = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          row.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }

      row.push(current.trim());
      result.push(row);
    }

    return result;
  };

  // Función principal para manejar archivos
  const handleFile = async (file) => {
    if (!file) return;

    // Limitar tamaño a 5 MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("❌ Archivo demasiado grande. Máximo permitido: 5 MB.");
      return;
    }

    setIsProcessing(true);
    setFilePreview(null);

    try {
      let data;

      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        data = parseCSV(text);
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
        // ⚡ Hacer copia profunda para aislar datos
        data = JSON.parse(JSON.stringify(data));
      } else {
        throw new Error("Formato de archivo no soportado. Use CSV o Excel.");
      }

      if (data.length < 2) {
        throw new Error(
          "El archivo debe tener al menos una fila de encabezados y una fila de datos."
        );
      }

      const headers = data[0];
      const rows = data
        .slice(1)
        .filter((row) =>
          row.some((cell) => cell !== "" && cell !== null && cell !== undefined)
        );

      console.log("📋 Columnas detectadas:", headers);

      // Detectar formato de coordenadas
      const coordMap = detectCoordinateFormat(headers);
      console.log("🗺️ Mapeo de coordenadas:", coordMap);

      // Mostrar vista previa de los primeros registros
      const preview = {
        headers: headers,
        sampleRows: rows.slice(0, 3),
        coordMap: coordMap,
        totalRows: rows.length,
      };
      setFilePreview(preview);

      // Validar que tenemos las columnas necesarias
      if (
        coordMap.lat === undefined &&
        coordMap.lng === undefined &&
        coordMap.x === undefined &&
        coordMap.y === undefined
      ) {
        throw new Error(`❌ No se detectaron columnas de coordenadas válidas.

📝 Use nombres como:
• Geográficas: lat, latitude, latitud, lon, lng, longitude, longitud
• Proyectadas: x, este/easting, y, norte/northing
• UTM: utm_x, utm_y, easting, northing

🔍 Columnas encontradas: ${headers.join(", ")}`);
      }

      // Procesar coordenadas
      const coordinates = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        if (!row || row.length === 0) continue;

        let lat, lng;
        let hasValidCoords = false;

        // Nombre del punto
        const pointName =
          coordMap.name !== undefined
            ? row[coordMap.name] || `Punto ${i + 1}`
            : `Punto ${i + 1}`;

        const resolveProjectedSystem = (x, y) => {
          const detectedProjectedSystem = detectProjectedSystem(x, y);
          const coordinatesLookGeographic =
            x >= -180 && x <= 180 && y >= -90 && y <= 90;
          const forceProjectedFromXY =
            transformSettings.sourceSystem === "EPSG:4326" &&
            !coordinatesLookGeographic;

          const system =
            transformSettings.sourceSystem === "auto" || forceProjectedFromXY
              ? detectedProjectedSystem
              : transformSettings.sourceSystem;

          if (forceProjectedFromXY) {
            console.warn(
              `⚠️ Fila ${i + 1}: columnas X/Y con valores proyectados detectadas; se ignora EPSG:4326 y se usa ${system}.`
            );
          }

          return system;
        };

        // Determinar si son coordenadas geográficas o proyectadas
        if (coordMap.lat !== undefined && coordMap.lng !== undefined) {
          lat = parseNumber(row[coordMap.lat]);
          lng = parseNumber(row[coordMap.lng]);

          if (!isNaN(lat) && !isNaN(lng)) {
            hasValidCoords = true;
            const looksGeographic =
              lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

            if (looksGeographic) {
              coordinates.push({
                id: i + 1,
                name: pointName,
                coordinates: {
                  latitude: lat,
                  longitude: lng,
                },
                targetSystem: transformSettings.targetSystem, // Agregar sistema destino
              });
            } else {
              const x = lng;
              const y = lat;
              const looksProjected =
                x >= 150000 && x <= 900000 && y >= 0 && y <= 12000000;

              if (looksProjected) {
                const system = resolveProjectedSystem(x, y);
                console.warn(
                  `⚠️ Fila ${i + 1}: columnas lat/lng fuera de rango geográfico, se interpretan como X/Y (${system}).`
                );
                coordinates.push({
                  id: i + 1,
                  name: pointName,
                  easting: x,
                  northing: y,
                  system,
                  targetSystem: transformSettings.targetSystem,
                });
              } else {
                hasValidCoords = false;
                console.warn(
                  `⚠️ Fila ${i + 1}: lat/lng fuera de rango y no parecen coordenadas proyectadas válidas`
                );
              }
            }
          }
        } else if (coordMap.x !== undefined && coordMap.y !== undefined) {
          const x = parseNumber(row[coordMap.x]);
          const y = parseNumber(row[coordMap.y]);

          if (!isNaN(x) && !isNaN(y)) {
            hasValidCoords = true;
            const system = resolveProjectedSystem(x, y);

            coordinates.push({
              id: i + 1,
              name: pointName,
              easting: x,
              northing: y,
              system: system,
              targetSystem: transformSettings.targetSystem, // Agregar sistema destino
            });
          }
        }

        if (!hasValidCoords) {
          console.warn(`⚠️ Fila ${i + 1}: Coordenadas inválidas o faltantes`);
        }
      }

      if (coordinates.length === 0) {
        throw new Error("No se encontraron coordenadas válidas en el archivo.");
      }

      console.log(
        `✅ Procesadas ${coordinates.length} coordenadas de ${rows.length} filas`
      );

      // Enviar coordenadas al componente padre
      onFileUpload(coordinates);
    } catch (error) {
      console.error("❌ Error procesando archivo:", error);
      alert(`Error al procesar archivo:\n\n${error.message}`);
    }

    setIsProcessing(false);
  };

  // Event handlers para drag & drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuración de transformación */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-medium text-green-900 mb-3">
          ⚙️ Configuración de transformación:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-green-800 mb-2">
              🎯 Sistema de destino:
            </label>
            <select
              value={transformSettings.targetSystem}
              onChange={(e) =>
                setTransformSettings((prev) => ({
                  ...prev,
                  targetSystem: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {/* <option value="all">🔄 Todos los sistemas (recomendado)</option> */}
              <option value="SIRES-DMQ">🏢 SIRES-DMQ (Quito)</option>
              <option value="UTM-17S">🗺️ UTM 17S (Ecuador Occidental)</option>
              <option value="UTM-17N">🗺️ UTM 17N (Ecuador Norte)</option>
              <option value="UTM-18S">🗺️ UTM 18S (Ecuador Oriental)</option>
              <option value="UTM-18N">🗺️ UTM 18N (Ecuador Noreste)</option>
              <option value="EPSG:4326">🌍 Geográficas (WGS84)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-green-800 mb-2">
              📍 Sistema de origen:
            </label>
            <select
              value={transformSettings.sourceSystem}
              onChange={(e) =>
                setTransformSettings((prev) => ({
                  ...prev,
                  sourceSystem: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="auto">🔍 Auto-detectar (recomendado)</option>
              <option value="EPSG:4326">🌍 Geográficas (WGS84)</option>
              <option value="SIRES-DMQ">🏢 SIRES-DMQ (Quito)</option>
              <option value="UTM-17S">🗺️ UTM 17S (Ecuador Occidental)</option>
              <option value="UTM-17N">🗺️ UTM 17N (Ecuador Norte)</option>
              <option value="UTM-18S">🗺️ UTM 18S (Ecuador Oriental)</option>
              <option value="UTM-18N">🗺️ UTM 18N (Ecuador Noreste)</option>
            </select>
          </div>
        </div>
        <div className="mt-2 text-xs text-green-700">
          💡 <strong>Sistema origen:</strong> Déjalo en "Auto-detectar" para
          mejor compatibilidad.
          <strong>Sistema destino:</strong> "Todos los sistemas" genera todas
          las transformaciones posibles.
        </div>
      </div>
      {/* Área de carga de archivos */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          id="file-upload"
          disabled={isProcessing}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <div className="text-lg font-semibold text-blue-600">
              Procesando archivo...
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center space-y-4">
              <div className="text-6xl">📁</div>
              <div className="text-xl font-semibold text-gray-700">
                Arrastra archivos aquí o haz clic para seleccionar
              </div>
              <div className="text-gray-500">
                Soporta CSV, Excel (.xlsx, .xls)
              </div>

              {/* Botón mejorado que ahora SÍ funciona */}
              <label
                htmlFor="file-upload"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Seleccionar Archivo
              </label>
            </div>
          </>
        )}
      </div>

      {/* Información sobre formatos soportados */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-3">
          📋 Formatos de columnas soportados:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <div className="font-medium mb-1">🌍 Coordenadas Geográficas:</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <code>lat, latitude, latitud</code>
              </li>
              <li>
                <code>lon, lng, longitude, longitud</code>
              </li>
            </ul>
          </div>
          <div>
            <div className="font-medium mb-1">🗺️ Coordenadas Proyectadas:</div>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <code>x, este, easting, utm_x, coordenada_x</code>
              </li>
              <li>
                <code>y, norte, northing, utm_y, coordenada_y</code>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-3 text-xs text-blue-700">
          <strong>💡 Formatos de números:</strong> Acepta punto (1234.56) o coma
          (1234,56) como decimal. También maneja separadores de miles: 1,234.56
          o 1.234,56
        </div>
      </div>

      {/* Vista previa del archivo */}
      {filePreview && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-medium text-gray-900 mb-4">
            📊 Vista previa del archivo
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                📝 Columnas detectadas:
              </div>
              <div className="bg-gray-50 p-3 rounded text-sm">
                {filePreview.headers.join(", ")}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                🎯 Mapeo de coordenadas:
              </div>
              <div className="bg-gray-50 p-3 rounded text-sm">
                {Object.keys(filePreview.coordMap).length > 0
                  ? Object.entries(filePreview.coordMap)
                      .map(
                        ([key, index]) =>
                          `${key}: ${filePreview.headers[index]}`
                      )
                      .join(", ")
                  : "No detectado"}
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 mb-4">
            <strong>Total de filas:</strong> {filePreview.totalRows}
          </div>

          {/* Muestra de datos */}
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {filePreview.headers.map((header, index) => (
                    <th
                      key={index}
                      className="px-3 py-2 border-r border-gray-200 text-left text-xs font-medium text-gray-500"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filePreview.sampleRows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className="px-3 py-2 border-r border-gray-200 text-sm text-gray-900"
                      >
                        {cell || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
