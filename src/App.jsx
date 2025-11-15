// src/App.jsx
import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import CoordinateInput from "./components/CoordinateInput";
import FileUpload from "./components/FileUpload";
import MapComponent from "./components/MapComponent";
import {
  exportData,
  transformCoordinatesBatch,
  copyToClipboard,
  formatCoordinatesForCopy,
} from "./utils/coordinateTransformations";

window.XLSX = XLSX;

// Constantes para LocalStorage
const STORAGE_KEY = "coord_transform_history";
const MAX_HISTORY_ITEMS = 100;

function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState({
    progress: 0,
    message: "",
    currentStep: "",
  });

  // Cargar historial desde LocalStorage al inicio
  const [results, setResults] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Error cargando historial:", error);
      return [];
    }
  });

  const [selectedTab, setSelectedTab] = useState("input"); // 'input', 'results', 'map'
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'success', 'error'
  const [copiedId, setCopiedId] = useState(null);

  // Guardar resultados en LocalStorage cada vez que cambian
  useEffect(() => {
    try {
      // Limitar el número de elementos guardados
      const toSave = results.slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error("Error guardando historial:", error);
      // Si el localStorage está lleno, intentar limpiar
      if (error.name === 'QuotaExceededError') {
        try {
          const reduced = results.slice(0, 50);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
        } catch {
          console.error("No se pudo guardar el historial reducido");
        }
      }
    }
  }, [results]);

  const handleBatchTransform = async (coordinates) => {
    setIsProcessing(true);
    setProcessingStatus({
      progress: 0,
      message: "Procesando archivo...",
      currentStep: "init",
    });

    try {
      // Configuración simplificada
      const firstCoord = coordinates[0];
      const settings = {
        sourceCRS: firstCoord?.system || "EPSG:4326", // Usar sistema detectado
        targetCRS: firstCoord?.targetSystem || "SIRES-DMQ", // Sistema específico elegido
        precision: 6,
        validateInput: true,
        skipInvalid: false,
        includeOriginal: true,
        calculatePrecision: true,
        generateReport: true,
        generateAllSystems: false, // SIEMPRE false ahora
      };

      console.log("🔄 Procesando archivo con configuración:", settings);

      const result = await transformCoordinatesBatch(
        coordinates,
        settings,
        (progress, message) => {
          setProcessingStatus({
            progress,
            message,
            currentStep: "transforming",
          });
        }
      );

      if (result.success) {
        setResults((prev) => [...prev, ...result.results]);
        setProcessingStatus({
          progress: 100,
          message: `Archivo transformado exitosamente! ${result.results.length} puntos procesados.`,
          currentStep: "completed",
        });
        setTimeout(() => setSelectedTab("results"), 1000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error en batch:", error);
      setProcessingStatus({
        progress: 0,
        message: `Error: ${error.message}`,
        currentStep: "error",
      });
    }

    setTimeout(() => {
      setIsProcessing(false);
      setProcessingStatus({ progress: 0, message: "", currentStep: "" });
    }, 3000);
  };

  const handleTransform = async (transformationData) => {
    setIsProcessing(true);
    setProcessingStatus({
      progress: 0,
      message: "Iniciando transformación...",
      currentStep: "init",
    });

    try {
      // Preparar datos para transformación
      let coordinates = [];

      if (transformationData.inputType === "projected") {
        // Coordenadas proyectadas
        coordinates = [
          {
            id: Date.now(),
            name: transformationData.name,
            easting: transformationData.easting,
            northing: transformationData.northing,
            system: transformationData.system,
            description: transformationData.description,
          },
        ];
      } else {
        // Coordenadas geográficas
        coordinates = [
          {
            id: Date.now(),
            name: transformationData.name,
            coordinates: {
              latitude: transformationData.latitude,
              longitude: transformationData.longitude,
            },
            description: transformationData.description,
          },
        ];
      }

      // Configuración de transformación
      const settings = {
        sourceCRS:
          transformationData.inputType === "projected"
            ? transformationData.system
            : "EPSG:4326",
        targetCRS: transformationData.targetSystem,
        precision: 6,
        validateInput: true,
        skipInvalid: false,
        includeOriginal: true,
        calculatePrecision: true,
        generateReport: true,
      };

      console.log("🔄 Transformando:", { coordinates, settings });

      // Transformar coordenadas
      const result = await transformCoordinatesBatch(
        coordinates,
        settings,
        (progress, message) => {
          setProcessingStatus({
            progress,
            message,
            currentStep: "transforming",
          });
        }
      );

      if (result.success) {
        setResults((prev) => [...prev, ...result.results]);
        setProcessingStatus({
          progress: 100,
          message: "Transformación completada exitosamente!",
          currentStep: "completed",
        });

        // Cambiar a pestaña de resultados
        setTimeout(() => {
          setSelectedTab("results");
        }, 1000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error en transformación:", error);
      setProcessingStatus({
        progress: 0,
        message: `Error: ${error.message}`,
        currentStep: "error",
      });
    }

    // Reset processing state
    setTimeout(() => {
      setIsProcessing(false);
      setProcessingStatus({ progress: 0, message: "", currentStep: "" });
    }, 3000);
  };

  const handleClearResults = () => {
    setResults([]);
    setSearchTerm("");
    setFilterStatus("all");
  };

  const handleCopyCoordinates = async (result) => {
    const text = formatCoordinatesForCopy(result);
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(result.id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      alert("Error al copiar al portapapeles");
    }
  };

  // Filtrar y buscar resultados usando useMemo para optimizar rendimiento
  const filteredResults = useMemo(() => {
    let filtered = results;

    // Filtrar por estado
    if (filterStatus !== "all") {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }

    // Buscar por nombre o ID
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name?.toLowerCase().includes(term) ||
          r.id?.toString().toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [results, searchTerm, filterStatus]);

  const getStatusColor = () => {
    switch (processingStatus.currentStep) {
      case "completed":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "transforming":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = () => {
    switch (processingStatus.currentStep) {
      case "completed":
        return "✅";
      case "error":
        return "❌";
      case "transforming":
        return "🔄";
      default:
        return "⏳";
    }
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                {" "}
                <span className="ml-3">Transformador de Coordenadas UIO</span>
              </h1>
              <p className="mt-2 text-lg text-gray-600">
                Transforma coordenadas entre sistemas geográficos, UTM y
                SIRES-DMQ
              </p>
            </div>

            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">
                Puntos transformados
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {results.length}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Processing Status */}
      {isProcessing && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center space-x-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${getStatusColor()}`}
              >
                <span className="text-lg">{getStatusIcon()}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-900">
                    {processingStatus.message}
                  </div>
                  <div className="text-sm text-gray-500">
                    {processingStatus.progress}%
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getStatusColor()}`}
                    style={{ width: `${processingStatus.progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-8">
            <button
              onClick={() => setSelectedTab("input")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === "input"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              📍 Entrada Manual
            </button>
            <button
              onClick={() => setSelectedTab("file")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === "file"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              📁 Carga de Archivos
            </button>
            <button
              onClick={() => setSelectedTab("results")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === "results"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              📊 Resultados ({results.length})
            </button>
            <button
              onClick={() => setSelectedTab("map")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === "map"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              🗺️ Mapa Interactivo
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {selectedTab === "input" && (
          <div className="max-w-4xl mx-auto">
            <CoordinateInput
              onTransform={handleTransform}
              isProcessing={isProcessing}
            />
          </div>
        )}

        {selectedTab === "file" && (
          <FileUpload onFileUpload={handleBatchTransform} />
        )}

        {selectedTab === "results" && (
          <div>
            {/* Header con búsqueda y filtros */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  📊 Resultados de Transformación
                </h2>
                {results.length > 0 && (
                  <button
                    onClick={handleClearResults}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    🗑️ Limpiar Resultados
                  </button>
                )}
              </div>

              {/* Barra de búsqueda y filtros */}
              {results.length > 0 && (
                <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        🔍 Buscar por nombre o ID
                      </label>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        🎯 Filtrar por estado
                      </label>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="all">Todos ({results.length})</option>
                        <option value="success">
                          Exitosos ({results.filter((r) => r.status === "success").length})
                        </option>
                        <option value="error">
                          Con errores ({results.filter((r) => r.status === "error").length})
                        </option>
                      </select>
                    </div>
                  </div>
                  {(searchTerm || filterStatus !== "all") && (
                    <div className="mt-3 text-sm text-gray-600">
                      Mostrando {filteredResults.length} de {results.length} resultados
                    </div>
                  )}
                </div>
              )}
            </div>

            {results.length === 0 ? (
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-12 text-center">
                <div className="text-6xl mb-4">📍</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No hay coordenadas transformadas aún
                </h3>
                <p className="text-gray-600 mb-6">
                  Utiliza la entrada manual o carga de archivos para transformar
                  tus primeras coordenadas.
                </p>
                <button
                  onClick={() => setSelectedTab("input")}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Comenzar Transformación
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-lg shadow border border-gray-200 text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {results.length}
                    </div>
                    <div className="text-sm text-gray-600">Total Puntos</div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow border border-gray-200 text-center">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {results.filter((r) => r.status === "success").length}
                    </div>
                    <div className="text-sm text-gray-600">Exitosos</div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow border border-gray-200 text-center">
                    <div className="text-3xl font-bold text-red-600 mb-1">
                      {results.filter((r) => r.status === "error").length}
                    </div>
                    <div className="text-sm text-gray-600">Con Errores</div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow border border-gray-200 text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-1">
                      {
                        results.filter(
                          (r) => r.precision?.quality === "Excelente"
                        ).length
                      }
                    </div>
                    <div className="text-sm text-gray-600">
                      Precisión Excelente
                    </div>
                  </div>
                </div>

                {/* Results Table */}
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Coordenadas Transformadas
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Punto
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Coordenadas Originales
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Coordenadas Transformadas
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Sistema Destino
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Precisión
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredResults.map((result, index) => (
                          <tr
                            key={result.id}
                            className={
                              index % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-gray-900">
                                {result.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {result.id}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-mono">
                                {result.transformation?.source && (
                                  <>
                                    <div>
                                      Y:{" "}
                                      {result.transformation.source.y?.toFixed(
                                        6
                                      )}
                                    </div>
                                    <div>
                                      X:{" "}
                                      {result.transformation.source.x?.toFixed(
                                        6
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {result.transformation.source.crs}
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-mono">
                                {result.transformation?.target && (
                                  <>
                                    <div>
                                      Y:{" "}
                                      {result.transformation.target.y?.toFixed(
                                        2
                                      )}{" "}
                                      m
                                    </div>
                                    <div>
                                      X:{" "}
                                      {result.transformation.target.x?.toFixed(
                                        2
                                      )}{" "}
                                      m
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {result.transformation?.target?.crs}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {result.precision && (
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    result.precision.quality === "Excelente"
                                      ? "bg-green-100 text-green-800"
                                      : result.precision.quality === "Muy buena"
                                      ? "bg-blue-100 text-blue-800"
                                      : result.precision.quality === "Buena"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {result.precision.quality}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  result.status === "success"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {result.status === "success"
                                  ? "✅ Exitoso"
                                  : "❌ Error"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => handleCopyCoordinates(result)}
                                className={`px-3 py-1 text-xs rounded transition-colors ${
                                  copiedId === result.id
                                    ? "bg-green-600 text-white"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
                                title="Copiar coordenadas"
                              >
                                {copiedId === result.id ? "✓ Copiado" : "📋 Copiar"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Export Options - SECCIÓN ÚNICA DE EXPORTACIÓN */}
                <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    📁 Opciones de Exportación
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <button
                      onClick={() => exportData(results, "csv")}
                      className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-center hover:shadow-md"
                      disabled={results.length === 0}
                    >
                      <div className="text-2xl mb-2">📄</div>
                      <div className="font-medium">CSV</div>
                      <div className="text-xs text-gray-500">
                        Excel compatible
                      </div>
                    </button>

                    <button
                      onClick={() => exportData(results, "excel")}
                      className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-center hover:shadow-md"
                      disabled={results.length === 0}
                    >
                      <div className="text-2xl mb-2">📊</div>
                      <div className="font-medium">Excel</div>
                      <div className="text-xs text-gray-500">
                        Formato nativo
                      </div>
                    </button>

                    <button
                      onClick={() => exportData(results, "geojson")}
                      className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-center hover:shadow-md"
                      disabled={results.length === 0}
                    >
                      <div className="text-2xl mb-2">🗺️</div>
                      <div className="font-medium">GeoJSON</div>
                      <div className="text-xs text-gray-500">Para SIG</div>
                    </button>

                    <button
                      onClick={() => exportData(results, "kml")}
                      className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-center hover:shadow-md"
                      disabled={results.length === 0}
                    >
                      <div className="text-2xl mb-2">🌍</div>
                      <div className="font-medium">KML</div>
                      <div className="text-xs text-gray-500">Google Earth</div>
                    </button>
                  </div>

                  {/* Información actualizada sobre los formatos */}
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-800">
                      <strong>💡 Información sobre formatos:</strong>
                      <ul className="mt-2 space-y-1 text-xs">
                        <li>
                          <strong>CSV:</strong> Compatible con Excel,
                          LibreOffice y hojas de cálculo
                        </li>
                        <li>
                          <strong>Excel:</strong> Formato nativo .xlsx con
                          estilos y metadatos
                        </li>
                        <li>
                          <strong>GeoJSON:</strong> Para sistemas SIG avanzados
                          (coordenadas en sistema transformado)
                        </li>
                        <li>
                          <strong>KML:</strong> Compatible con Google Earth y Google Maps
                          (coordenadas en WGS84)
                        </li>
                      </ul>
                    </div>
                  </div>

                  {results.length === 0 && (
                    <div className="mt-4 text-center text-gray-500 text-sm">
                      No hay datos para exportar. Transforma algunas coordenadas
                      primero.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === "map" && <MapComponent coordinates={results} />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="text-center md:text-left mb-4 md:mb-0">
              <div className="text-lg font-semibold text-gray-900 mb-1">
                Transformador de Coordenadas UIO
              </div>
              <div className="text-sm text-gray-600">
                Sistemas soportados: WGS84, SIRES-DMQ, UTM 17N/S, UTM 18N/S
              </div>
            </div>
            <div className="text-center md:text-right">
              <div className="text-sm text-gray-500">
                Desarrollado para Quito 🎯
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
