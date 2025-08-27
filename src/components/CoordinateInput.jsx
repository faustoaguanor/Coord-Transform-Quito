// src/components/CoordinateInput.jsx
import { useEffect, useState } from "react";
import {
  decimalToDMS,
  detectBestSystem,
  dmsToDecimal,
  formatCoordinate,
  getEcuadorSystems,
  transformCoordinate,
  validateCoordinates,
  validateProjectedCoordinates,
} from "../utils/coordinateTransformations";

const CoordinateInput = ({ onTransform, isProcessing = false }) => {
  const [inputMode, setInputMode] = useState("decimal"); // 'decimal', 'dms', 'projected'
  const [formData, setFormData] = useState({
    // Decimal coordinates
    latitude: "",
    longitude: "",
    // DMS coordinates
    latDegrees: "",
    latMinutes: "",
    latSeconds: "",
    latDirection: "S",
    lngDegrees: "",
    lngMinutes: "",
    lngSeconds: "",
    lngDirection: "W",
    // Projected coordinates
    easting: "",
    northing: "",
    sourceSystem: "UTM-17S",
    targetSystem: "SIRES-DMQ",
    // Common fields
    pointName: "",
    description: "",
  });

  const [previewResult, setPreviewResult] = useState(null);
  const [errors, setErrors] = useState({});
  const [isValidating, setIsValidating] = useState(false);
  const [hasUserSelectedSystem, setHasUserSelectedSystem] = useState(false);
  const systems = getEcuadorSystems();

  // Real-time validation and preview
  useEffect(() => {
    let lat, lng;

    // Resetear errores al inicio
    setErrors({});

    if (inputMode === "decimal") {
      lat = parseFloat(formData.latitude);
      lng = parseFloat(formData.longitude);
    } else if (inputMode === "dms") {
      if (
        formData.latDegrees &&
        formData.latMinutes &&
        formData.latSeconds !== ""
      ) {
        lat = dmsToDecimal(
          parseInt(formData.latDegrees),
          parseInt(formData.latMinutes),
          parseFloat(formData.latSeconds),
          formData.latDirection
        );
      }
      if (
        formData.lngDegrees &&
        formData.lngMinutes &&
        formData.lngSeconds !== ""
      ) {
        lng = dmsToDecimal(
          parseInt(formData.lngDegrees),
          parseInt(formData.lngMinutes),
          parseFloat(formData.lngSeconds),
          formData.lngDirection
        );
      }
    }

    if (
      inputMode !== "projected" &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat !== 0 &&
      lng !== 0
    ) {
      setIsValidating(true);

      try {
        const validation = validateCoordinates(lat, lng);

        if (validation.isValid) {
          // Auto-detect best system
          const bestSystem = detectBestSystem(lat, lng);
          if (!hasUserSelectedSystem && formData.targetSystem !== bestSystem) {
            setFormData((prev) => ({ ...prev, targetSystem: bestSystem }));
          }

          // Preview transformation
          const result = transformCoordinate(
            lng,
            lat,
            "EPSG:4326",
            formData.targetSystem
          );
          if (result && result.success) {
            setPreviewResult({
              success: true,
              result: {
                easting: result.x,
                northing: result.y,
                system: formData.targetSystem,
                dms: {
                  lat: decimalToDMS(lat, "lat"),
                  lng: decimalToDMS(lng, "lng"),
                },
              },
            });
          } else {
            setPreviewResult(null);
          }
        } else {
          setErrors({ coordinates: validation.errors.join(", ") });
          setPreviewResult(null);
        }
      } catch (error) {
        setErrors({ coordinates: "Error en validación: " + error.message });
        setPreviewResult(null);
      }

      setIsValidating(false);
    } else if (
      inputMode === "projected" &&
      formData.easting &&
      formData.northing
    ) {
      setIsValidating(true);

      try {
        const easting = parseFloat(formData.easting);
        const northing = parseFloat(formData.northing);

        if (!isNaN(easting) && !isNaN(northing)) {
          const validation = validateProjectedCoordinates(
            easting,
            northing,
            formData.sourceSystem
          );

          if (validation.isValid) {
            // Transformar desde sistema fuente al sistema destino
            const result = transformCoordinate(
              easting,
              northing,
              formData.sourceSystem,
              formData.targetSystem
            );
            if (result && result.success) {
              // Si el destino es geográfico, mostrar lat/lng
              if (formData.targetSystem === "EPSG:4326") {
                setPreviewResult({
                  success: true,
                  result: {
                    latitude: result.y,
                    longitude: result.x,
                    dms: {
                      lat: decimalToDMS(result.y, "lat"),
                      lng: decimalToDMS(result.x, "lng"),
                    },
                  },
                });
              } else {
                // Si el destino es proyectado, mostrar x/y
                setPreviewResult({
                  success: true,
                  result: {
                    easting: result.x,
                    northing: result.y,
                    system: formData.targetSystem,
                  },
                });
              }
            } else {
              setErrors({
                coordinates: result?.error || "Error en transformación",
              });
              setPreviewResult(null);
            }
          } else {
            setErrors({ coordinates: validation.errors.join(", ") });
            setPreviewResult(null);
          }
        }
      } catch (error) {
        setErrors({ coordinates: "Error en procesamiento: " + error.message });
        setPreviewResult(null);
      }

      setIsValidating(false);
    } else {
      setPreviewResult(null);
    }
  }, [
    formData.latitude,
    formData.longitude,
    formData.latDegrees,
    formData.latMinutes,
    formData.latSeconds,
    formData.latDirection,
    formData.lngDegrees,
    formData.lngMinutes,
    formData.lngSeconds,
    formData.lngDirection,
    formData.easting,
    formData.northing,
    formData.sourceSystem,
    formData.targetSystem,
    inputMode,
  ]);

  const handleInputChange = (field, value) => {
    if (field === "targetSystem") {
      setHasUserSelectedSystem(true);
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!previewResult?.success) {
      setErrors({
        form: "Por favor ingrese coordenadas válidas antes de transformar.",
      });
      return;
    }

    let transformationData;

    if (inputMode === "projected") {
      transformationData = {
        type: "manual",
        inputType: "projected",
        easting: parseFloat(formData.easting),
        northing: parseFloat(formData.northing),
        system: formData.sourceSystem,
        name: formData.pointName || `Punto ${Date.now()}`,
        description: formData.description,
        targetSystem: formData.targetSystem,
      };
    } else {
      let lat, lng;

      if (inputMode === "decimal") {
        lat = parseFloat(formData.latitude);
        lng = parseFloat(formData.longitude);
      } else {
        lat = dmsToDecimal(
          parseInt(formData.latDegrees),
          parseInt(formData.latMinutes),
          parseFloat(formData.latSeconds),
          formData.latDirection
        );
        lng = dmsToDecimal(
          parseInt(formData.lngDegrees),
          parseInt(formData.lngMinutes),
          parseFloat(formData.lngSeconds),
          formData.lngDirection
        );
      }

      transformationData = {
        type: "manual",
        inputType: "geographic",
        latitude: lat,
        longitude: lng,
        name: formData.pointName || `Punto ${Date.now()}`,
        description: formData.description,
        targetSystem: formData.targetSystem,
      };
    }

    onTransform(transformationData);

    // Clear form
    setFormData({
      latitude: "",
      longitude: "",
      latDegrees: "",
      latMinutes: "",
      latSeconds: "",
      latDirection: "S",
      lngDegrees: "",
      lngMinutes: "",
      lngSeconds: "",
      lngDirection: "W",
      easting: "",
      northing: "",
      sourceSystem: "UTM-17S",
      targetSystem: "SIRES-DMQ",
      pointName: "",
      description: "",
    });
    setPreviewResult(null);
    setErrors({});
  };

  const loadExample = (example) => {
    if (example === "quito") {
      setInputMode("decimal");
      setFormData((prev) => ({
        ...prev,
        latitude: "-0.2201",
        longitude: "-78.5123",
        pointName: "Plaza Grande Quito",
        targetSystem: "SIRES-DMQ",
      }));
    } else if (example === "guayaquil") {
      setInputMode("decimal");
      setFormData((prev) => ({
        ...prev,
        latitude: "-2.1894",
        longitude: "-79.8890",
        pointName: "Malecón Guayaquil",
        targetSystem: "UTM-17S",
      }));
    } else if (example === "dms") {
      setInputMode("dms");
      setFormData((prev) => ({
        ...prev,
        latDegrees: "0",
        latMinutes: "13",
        latSeconds: "12.4",
        latDirection: "S",
        lngDegrees: "78",
        lngMinutes: "30",
        lngSeconds: "44.3",
        lngDirection: "W",
        pointName: "Ejemplo DMS Quito",
        targetSystem: "UTM-17S",
      }));
    } else if (example === "utm_sires") {
      setInputMode("projected");
      setFormData((prev) => ({
        ...prev,
        easting: "776392",
        northing: "9975341",
        sourceSystem: "UTM-17S",
        targetSystem: "SIRES-DMQ",
        pointName: "UTM a SIRES",
      }));
    } else if (example === "sires_utm") {
      setInputMode("projected");
      setFormData((prev) => ({
        ...prev,
        easting: "499450",
        northing: "9975663",
        sourceSystem: "SIRES-DMQ",
        targetSystem: "UTM-17S",
        pointName: "SIRES a UTM",
      }));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          📝 Entrada Manual de Coordenadas
        </h2>
        <p className="text-gray-600">
          Ingrese coordenadas en cualquier formato para transformación entre
          sistemas de Ecuador.
        </p>
      </div>

      <div className="p-6">
        {/* Quick Examples */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm font-medium text-blue-900 mb-3">
            🚀 Ejemplos rápidos:
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadExample("quito")}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Quito (SIRES-DMQ)
            </button>
            <button
              type="button"
              onClick={() => loadExample("guayaquil")}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            >
              Guayaquil (UTM 17S)
            </button>
            <button
              type="button"
              onClick={() => loadExample("dms")}
              className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
            >
              Ejemplo DMS
            </button>
            <button
              type="button"
              onClick={() => loadExample("utm_sires")}
              className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors"
            >
              UTM → SIRES
            </button>
            <button
              type="button"
              onClick={() => loadExample("sires_utm")}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
            >
              SIRES → UTM
            </button>
          </div>
        </div>

        {/* Input Mode Selector */}
        <div className="mb-6">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              type="button"
              onClick={() => setInputMode("decimal")}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                inputMode === "decimal"
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-300"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              📊 Grados Decimales
            </button>
            <button
              type="button"
              onClick={() => setInputMode("dms")}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                inputMode === "dms"
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-300"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              📐 Grados Min Seg
            </button>
            <button
              type="button"
              onClick={() => setInputMode("projected")}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                inputMode === "projected"
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-300"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              🗺️ UTM/SIRES
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Point Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🏷️ Nombre del Punto
            </label>
            <input
              type="text"
              value={formData.pointName}
              onChange={(e) => handleInputChange("pointName", e.target.value)}
              placeholder="Ej: Plaza Grande, Punto GPS 001, etc."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Coordinate Input Fields */}
          {inputMode === "decimal" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📍 Latitud (°) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) =>
                      handleInputChange("latitude", e.target.value)
                    }
                    placeholder="-0.2201 (Quito)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📍 Longitud (°) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) =>
                      handleInputChange("longitude", e.target.value)
                    }
                    placeholder="-78.5123 (Quito)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🎯 Sistema de Destino{" "}
                  <span className="text-xs text-gray-500">
                    (Auto-detectado)
                  </span>
                </label>
                <select
                  value={formData.targetSystem}
                  onChange={(e) =>
                    handleInputChange("targetSystem", e.target.value)
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  {systems
                    .filter((s) => s.type === "projected")
                    .map((system) => (
                      <option key={system.code} value={system.code}>
                        {system.name} - {system.region}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {
                    systems.find((s) => s.code === formData.targetSystem)
                      ?.description
                  }
                </p>
              </div>
            </div>
          )}

          {inputMode === "dms" && (
            <div className="space-y-6">
              {/* Latitude DMS */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  📍 Latitud <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <input
                      type="number"
                      value={formData.latDegrees}
                      onChange={(e) =>
                        handleInputChange("latDegrees", e.target.value)
                      }
                      placeholder="0"
                      min="0"
                      max="90"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-center"
                    />
                    <div className="text-xs text-gray-500 text-center mt-1">
                      Grados
                    </div>
                  </div>
                  <div>
                    <input
                      type="number"
                      value={formData.latMinutes}
                      onChange={(e) =>
                        handleInputChange("latMinutes", e.target.value)
                      }
                      placeholder="13"
                      min="0"
                      max="59"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-center"
                    />
                    <div className="text-xs text-gray-500 text-center mt-1">
                      Minutos
                    </div>
                  </div>
                  <div>
                    <input
                      type="number"
                      step="any"
                      value={formData.latSeconds}
                      onChange={(e) =>
                        handleInputChange("latSeconds", e.target.value)
                      }
                      placeholder="12.4"
                      min="0"
                      max="59.999"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-center"
                    />
                    <div className="text-xs text-gray-500 text-center mt-1">
                      Segundos
                    </div>
                  </div>
                  <div>
                    <select
                      value={formData.latDirection}
                      onChange={(e) =>
                        handleInputChange("latDirection", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded text-center"
                    >
                      <option value="N">N</option>
                      <option value="S">S</option>
                    </select>
                    <div className="text-xs text-gray-500 text-center mt-1">
                      Hemisferio
                    </div>
                  </div>
                </div>
              </div>

              {/* Longitude DMS */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  📍 Longitud <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <input
                      type="number"
                      value={formData.lngDegrees}
                      onChange={(e) =>
                        handleInputChange("lngDegrees", e.target.value)
                      }
                      placeholder="78"
                      min="0"
                      max="180"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-center"
                    />
                    <div className="text-xs text-gray-500 text-center mt-1">
                      Grados
                    </div>
                  </div>
                  <div>
                    <input
                      type="number"
                      value={formData.lngMinutes}
                      onChange={(e) =>
                        handleInputChange("lngMinutes", e.target.value)
                      }
                      placeholder="30"
                      min="0"
                      max="59"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-center"
                    />
                    <div className="text-xs text-gray-500 text-center mt-1">
                      Minutos
                    </div>
                  </div>
                  <div>
                    <input
                      type="number"
                      step="any"
                      value={formData.lngSeconds}
                      onChange={(e) =>
                        handleInputChange("lngSeconds", e.target.value)
                      }
                      placeholder="44.3"
                      min="0"
                      max="59.999"
                      className="w-full px-3 py-2 border border-gray-300 rounded text-center"
                    />
                    <div className="text-xs text-gray-500 text-center mt-1">
                      Segundos
                    </div>
                  </div>
                  <div>
                    <select
                      value={formData.lngDirection}
                      onChange={(e) =>
                        handleInputChange("lngDirection", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded text-center"
                    >
                      <option value="E">E</option>
                      <option value="W">W</option>
                    </select>
                    <div className="text-xs text-gray-500 text-center mt-1">
                      Hemisferio
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🎯 Sistema de Destino{" "}
                  <span className="text-xs text-gray-500">
                    (Auto-detectado)
                  </span>
                </label>
                <select
                  value={formData.targetSystem}
                  onChange={(e) =>
                    handleInputChange("targetSystem", e.target.value)
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {systems
                    .filter((s) => s.type === "projected")
                    .map((system) => (
                      <option key={system.code} value={system.code}>
                        {system.name} - {system.region}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {inputMode === "projected" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🗺️ Sistema de Origen
                </label>
                <select
                  value={formData.sourceSystem}
                  onChange={(e) =>
                    handleInputChange("sourceSystem", e.target.value)
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {systems
                    .filter((s) => s.type === "projected")
                    .map((system) => (
                      <option key={system.code} value={system.code}>
                        {system.name} - {system.region}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {
                    systems.find((s) => s.code === formData.sourceSystem)
                      ?.description
                  }
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🎯 Sistema de Destino
                </label>
                <select
                  value={formData.targetSystem}
                  onChange={(e) =>
                    handleInputChange("targetSystem", e.target.value)
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {/* Opción para geográficas */}
                  <option value="EPSG:4326">
                    Geográficas (WGS84) - Lat/Lng en grados
                  </option>
                  {/* Opciones para proyectadas */}
                  {systems
                    .filter((s) => s.type === "projected")
                    .map((system) => (
                      <option key={system.code} value={system.code}>
                        {system.name} - {system.region}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {formData.targetSystem === "EPSG:4326"
                    ? "Convertir a coordenadas geográficas (Latitud/Longitud)"
                    : systems.find((s) => s.code === formData.targetSystem)
                        ?.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ➡️ Este (m) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.easting}
                    onChange={(e) =>
                      handleInputChange("easting", e.target.value)
                    }
                    placeholder={
                      formData.sourceSystem === "SIRES-DMQ"
                        ? "499450"
                        : "776392"
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ⬆️ Norte (m) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.northing}
                    onChange={(e) =>
                      handleInputChange("northing", e.target.value)
                    }
                    placeholder={
                      formData.sourceSystem === "SIRES-DMQ"
                        ? "9975663"
                        : "9975341"
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📝 Descripción (Opcional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Descripción adicional del punto..."
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Errors */}
          {Object.keys(errors).length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="text-red-500 text-lg">⚠️</div>
                <div className="text-sm text-red-700">
                  {Object.values(errors).join(", ")}
                </div>
              </div>
            </div>
          )}

          {/* Preview Result */}
          {previewResult?.success && (
            <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                ✅ Vista Previa de Transformación
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                {inputMode === "projected" ? (
                  <>
                    {formData.targetSystem === "EPSG:4326" ? (
                      // Proyectado → Geográfico
                      <>
                        <div>
                          <div className="font-medium text-green-800 mb-2">
                            🌍 Coordenadas Geográficas (WGS84):
                          </div>
                          <div className="space-y-1 font-mono bg-white p-3 rounded border">
                            <div>
                              Lat:{" "}
                              {formatCoordinate(
                                previewResult.result?.latitude ?? 0,
                                "lat"
                              )}
                            </div>
                            <div>
                              Lng:{" "}
                              {formatCoordinate(
                                previewResult.result?.longitude ?? 0,
                                "lng"
                              )}
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-green-800 mb-2">
                            📐 Formato DMS:
                          </div>
                          <div className="space-y-1 text-sm bg-white p-3 rounded border">
                            <div>
                              {previewResult.result?.dms?.lat?.formatted ?? "-"}
                            </div>
                            <div>
                              {previewResult.result?.dms?.lng?.formatted ?? "-"}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      // Proyectado → Proyectado
                      <>
                        <div>
                          <div className="font-medium text-green-800 mb-2">
                            🎯{" "}
                            {
                              systems.find(
                                (s) => s.code === formData.targetSystem
                              )?.shortName
                            }
                            :
                          </div>
                          <div className="space-y-1 font-mono bg-white p-3 rounded border">
                            <div>
                              Este:{" "}
                              {formatCoordinate(
                                previewResult.result?.easting ?? 0,
                                "utm"
                              )}
                            </div>
                            <div>
                              Norte:{" "}
                              {formatCoordinate(
                                previewResult.result?.northing ?? 0,
                                "utm"
                              )}
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-green-800 mb-2">
                            📊 Información del sistema:
                          </div>
                          <div className="space-y-1 text-sm bg-white p-3 rounded border">
                            <div>
                              <strong>Sistema:</strong>{" "}
                              {
                                systems.find(
                                  (s) => s.code === formData.targetSystem
                                )?.name
                              }
                            </div>
                            <div>
                              <strong>Región:</strong>{" "}
                              {
                                systems.find(
                                  (s) => s.code === formData.targetSystem
                                )?.region
                              }
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  // Geográfico → Proyectado
                  <>
                    <div>
                      <div className="font-medium text-green-800 mb-2">
                        🎯{" "}
                        {
                          systems.find((s) => s.code === formData.targetSystem)
                            ?.shortName
                        }
                        :
                      </div>
                      <div className="space-y-1 font-mono bg-white p-3 rounded border">
                        <div>
                          Este:{" "}
                          {formatCoordinate(
                            previewResult.result?.easting ?? 0,
                            "utm"
                          )}
                        </div>
                        <div>
                          Norte:{" "}
                          {formatCoordinate(
                            previewResult.result?.northing ?? 0,
                            "utm"
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-green-800 mb-2">
                        📐 Formato DMS:
                      </div>
                      <div className="space-y-1 text-sm bg-white p-3 rounded border">
                        <div>
                          {previewResult.result?.dms?.lat?.formatted ?? "-"}
                        </div>
                        <div>
                          {previewResult.result?.dms?.lng?.formatted ?? "-"}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={isProcessing || !previewResult?.success || isValidating}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
                isProcessing || !previewResult?.success || isValidating
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                  Procesando...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  🔄 Transformar Coordenada
                  <span className="ml-2">→</span>
                </span>
              )}
            </button>
          </div>
        </form>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="font-medium text-gray-900 mb-2">
            💡 Consejos y ayuda:
          </h4>
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              • <strong>Proyectadas:</strong> Puede transformar entre UTM ↔
              SIRES ↔ Geográficas
            </p>
            <p>
              • Para Ecuador usar preferiblemente UTM 17S (occidental) o UTM 18S
              (oriental)
            </p>
            <p>• SIRES-DMQ es específico para el área metropolitana de Quito</p>
            <p>• DMS: Para Ecuador típicamente usar S (sur) y W (oeste)</p>
            <p>
              • El sistema se detecta automáticamente según la ubicación de las
              coordenadas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoordinateInput;
