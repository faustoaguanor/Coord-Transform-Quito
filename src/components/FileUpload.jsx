import { useState } from "react";
import * as XLSX from "xlsx";
import {
  MAX_FILE_SIZE,
  MAX_ROWS,
  parseCSV,
  rowsToCoordinates,
} from "../utils/fileParsing";

const FileUpload = ({ onFileUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [transformSettings, setTransformSettings] = useState({
    sourceSystem: "auto", // auto-detectar
    targetSystem: "SIRES-DMQ", // transformar a todos los sistemas
  });

  // Función principal para manejar archivos
  const handleFile = async (file) => {
    if (!file) return;

    setFileError(null);
    setFilePreview(null);

    if (file.size > MAX_FILE_SIZE) {
      setFileError(
        `Archivo demasiado grande (${(file.size / 1048576).toFixed(1)} MB). Máximo permitido: ${MAX_FILE_SIZE / 1048576} MB.`
      );
      return;
    }

    setIsProcessing(true);

    try {
      const fileName = file.name.toLowerCase();
      let data;

      if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
        data = parseCSV(await file.text());
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        // raw: true conserva todos los decimales; con raw: false se usaría el
        // formato de celda de Excel, que puede redondear las coordenadas.
        data = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: true,
          defval: "",
        });
      } else {
        throw new Error("Formato de archivo no soportado. Use CSV o Excel.");
      }

      if (data.length < 2) {
        throw new Error(
          "El archivo debe tener al menos una fila de encabezados y una fila de datos."
        );
      }

      const headers = data[0].map((h) => String(h ?? "").trim());
      const rows = data.slice(1);

      if (rows.length > MAX_ROWS) {
        throw new Error(
          `El archivo tiene ${rows.length.toLocaleString("es-EC")} filas; el máximo es ${MAX_ROWS.toLocaleString("es-EC")}. Divídalo en partes.`
        );
      }

      const { coordinates, rejected, warnings, coordMap } = rowsToCoordinates(
        headers,
        rows,
        transformSettings
      );

      setFilePreview({
        fileName: file.name,
        headers,
        sampleRows: rows.slice(0, 3),
        coordMap,
        totalRows: rows.length,
        accepted: coordinates.length,
        rejected,
        warnings,
      });

      if (coordinates.length === 0) {
        throw new Error(
          "No se encontraron coordenadas válidas en el archivo. Revise el detalle de filas rechazadas."
        );
      }

      onFileUpload(coordinates);
    } catch (error) {
      console.error("Error procesando archivo:", error);
      setFileError(error.message);
    } finally {
      setIsProcessing(false);
    }
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
    // Permite volver a cargar el mismo archivo tras corregirlo
    e.target.value = "";
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
          💡 <strong>Sistema origen:</strong> "Auto-detectar" reconoce
          geográficas, SIRES-DMQ y UTM zona 17. Para datos en{" "}
          <strong>UTM zona 18</strong> (Amazonía) seleccione el sistema de
          origen explícitamente: las zonas 17 y 18 no se distinguen por sus
          valores.
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
          accept=".csv,.txt,.xlsx,.xls"
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
                Soporta CSV (separador coma, punto y coma o tabulación) y
                Excel (.xlsx, .xls) · máx. {MAX_FILE_SIZE / 1048576} MB /{" "}
                {MAX_ROWS.toLocaleString("es-EC")} filas
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

      {/* Error de lectura del archivo */}
      {fileError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 whitespace-pre-line"
        >
          <strong>❌ No se pudo procesar el archivo.</strong>
          {"\n"}
          {fileError}
        </div>
      )}

      {/* Reporte de validación por fila */}
      {filePreview && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm">
          <h4 className="font-medium text-gray-900 mb-2">
            ✅ Validación de {filePreview.fileName}
          </h4>
          <p className="text-gray-700">
            {filePreview.accepted} de {filePreview.totalRows} filas aceptadas
            {filePreview.rejected.length > 0 &&
              ` · ${filePreview.rejected.length} rechazadas`}
            {filePreview.warnings.length > 0 &&
              ` · ${filePreview.warnings.length} advertencias`}
          </p>
          {[
            ["Filas rechazadas", filePreview.rejected, "text-red-700"],
            ["Advertencias", filePreview.warnings, "text-amber-700"],
          ].map(
            ([title, items, color]) =>
              items.length > 0 && (
                <details key={title} className="mt-2" open={title === "Filas rechazadas"}>
                  <summary className={`cursor-pointer font-medium ${color}`}>
                    {title} ({items.length})
                  </summary>
                  <ul className="mt-1 max-h-48 overflow-y-auto list-disc list-inside text-gray-700">
                    {items.slice(0, 200).map((item, i) => (
                      <li key={i}>
                        Fila {item.row}: {item.message}
                      </li>
                    ))}
                    {items.length > 200 && (
                      <li>… y {items.length - 200} más</li>
                    )}
                  </ul>
                </details>
              )
          )}
        </div>
      )}

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
