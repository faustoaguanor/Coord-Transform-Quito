import L from "leaflet";
import { useEffect, useRef, useState } from "react";

// Configurar iconos de Leaflet para que funcionen correctamente
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const MapComponent = ({ coordinates = [] }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const wmsLayersRef = useRef([]); // Usar ref para las capas WMS
  const [wmsLayers, setWmsLayers] = useState([]); // Estado solo para UI
  const [currentBaseLayer, setCurrentBaseLayer] = useState("osm");
  const [showWmsForm, setShowWmsForm] = useState(false);
  const [wmsUrl, setWmsUrl] = useState("");
  const [wmsLayersText, setWmsLayersText] = useState("");
  const [wmsName, setWmsName] = useState("");

  // Capas base disponibles
  const baseLayers = {
    osm: {
      name: "OpenStreetMap",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "© OpenStreetMap contributors",
    },
    satellite: {
      name: "Satélite (Esri)",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution:
        "© Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community",
    },
    topo: {
      name: "Topográfico",
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attribution: "© OpenTopoMap contributors",
    },
    cartodb: {
      name: "CartoDB Light",
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  };

  // Inicializar mapa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [-0.2201, -78.5123], // Quito
      zoom: 10,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: false,
    });

    const initialLayer = L.tileLayer(baseLayers[currentBaseLayer].url, {
      attribution: baseLayers[currentBaseLayer].attribution,
      maxZoom: 19,
      tileSize: 256,
    });

    initialLayer.addTo(map);
    mapInstanceRef.current = map;

    map.on("resize", () => {
      console.log("Map resized");
      map.invalidateSize();
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Cambiar capa base
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remover solo capas base, no WMS
    mapInstanceRef.current.eachLayer((layer) => {
      if (
        layer._url &&
        layer._url.includes("tile") &&
        layer.options &&
        layer.options.attribution
      ) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });

    const newLayer = L.tileLayer(baseLayers[currentBaseLayer].url, {
      attribution: baseLayers[currentBaseLayer].attribution,
      maxZoom: 19,
      tileSize: 256,
    });

    newLayer.addTo(mapInstanceRef.current);
  }, [currentBaseLayer]);

  // Actualizar marcadores
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    markersRef.current.forEach((marker) => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    if (coordinates.length === 0) return;

    const validCoordinates = [];

    coordinates.forEach((coord, index) => {
      let lat, lng;

      if (coord.transformation?.source) {
        lat = coord.transformation.source.y;
        lng = coord.transformation.source.x;
      } else if (coord.coordinates) {
        lat = coord.coordinates.latitude;
        lng = coord.coordinates.longitude;
      } else if (
        coord.latitude !== undefined &&
        coord.longitude !== undefined
      ) {
        lat = coord.latitude;
        lng = coord.longitude;
      }

      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        const marker = L.marker([lat, lng]);

        const popupContent = `
          <div class="p-2">
            <h4 class="font-bold text-lg mb-2">${
              coord.name || `Punto ${index + 1}`
            }</h4>
            <div class="text-sm space-y-1">
              <div><strong>Latitud:</strong> ${lat.toFixed(6)}°</div>
              <div><strong>Longitud:</strong> ${lng.toFixed(6)}°</div>
              ${
                coord.transformation?.target
                  ? `
                <div class="mt-2 pt-2 border-t">
                  <div><strong>Sistema:</strong> ${
                    coord.transformation.target.crs
                  }</div>
                  <div><strong>Este:</strong> ${coord.transformation.target.x.toFixed(
                    2
                  )} m</div>
                  <div><strong>Norte:</strong> ${coord.transformation.target.y.toFixed(
                    2
                  )} m</div>
                </div>
              `
                  : ""
              }
              ${
                coord.precision
                  ? `
                <div class="mt-1">
                  <span class="px-2 py-1 text-xs rounded ${
                    coord.precision.quality === "Excelente"
                      ? "bg-green-100 text-green-800"
                      : coord.precision.quality === "Muy buena"
                      ? "bg-blue-100 text-blue-800"
                      : coord.precision.quality === "Buena"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }">
                    Precisión: ${coord.precision.quality}
                  </span>
                </div>
              `
                  : ""
              }
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, {
          maxWidth: 300,
          className: "custom-popup",
        });

        marker.addTo(mapInstanceRef.current);
        markersRef.current.push(marker);
        validCoordinates.push([lat, lng]);
      }
    });

    if (validCoordinates.length > 0) {
      if (validCoordinates.length === 1) {
        mapInstanceRef.current.setView(validCoordinates[0], 14);
      } else {
        const group = new L.featureGroup(markersRef.current);
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }, [coordinates]);

  // Función para agregar WMS
  const addWMSLayer = () => {
    if (!mapInstanceRef.current || !wmsUrl.trim() || !wmsLayersText.trim()) {
      alert("Por favor ingrese URL y capas del servicio WMS");
      return;
    }

    try {
      const wmsLayer = L.tileLayer.wms(wmsUrl.trim(), {
        layers: wmsLayersText.trim(),
        format: "image/png",
        transparent: true,
        attribution: wmsName || "Servicio WMS",
        opacity: 0.75,
        crs: L.CRS.EPSG4326,
      });

      // Agregar la capa al mapa inmediatamente
      wmsLayer.addTo(mapInstanceRef.current);

      const newWmsLayer = {
        layer: wmsLayer,
        name: wmsName || `WMS ${wmsLayersRef.current.length + 1}`,
        url: wmsUrl,
        layers: wmsLayersText,
        visible: true,
      };

      // Agregar al ref
      wmsLayersRef.current.push(newWmsLayer);

      // Actualizar estado para UI
      setWmsLayers([...wmsLayersRef.current]);

      setWmsUrl("");
      setWmsLayersText("");
      setWmsName("");
      setShowWmsForm(false);

      console.log("✅ Capa WMS agregada exitosamente");
    } catch (error) {
      console.error("❌ Error agregando WMS:", error);
      alert(`Error al agregar capa WMS: ${error.message}`);
    }
  };

  // Toggle visibilidad - SOLUCIÓN DEFINITIVA
  const toggleWMSVisibility = (index) => {
    const wmsInfo = wmsLayersRef.current[index];
    if (!wmsInfo || !mapInstanceRef.current) return;

    const newVisibility = !wmsInfo.visible;
    wmsInfo.visible = newVisibility;

    // Actualizar el mapa inmediatamente
    if (newVisibility) {
      wmsInfo.layer.addTo(mapInstanceRef.current);
    } else {
      mapInstanceRef.current.removeLayer(wmsInfo.layer);
    }

    // Forzar re-render para actualizar la UI
    setWmsLayers([...wmsLayersRef.current]);
  };

  // Remover capa WMS
  const removeWMSLayer = (index) => {
    const layerToRemove = wmsLayersRef.current[index];
    if (layerToRemove && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(layerToRemove.layer);
      wmsLayersRef.current.splice(index, 1);
      setWmsLayers([...wmsLayersRef.current]);
    }
  };

  // Forzar redimensionamiento del mapa
  const refreshMap = () => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 100);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controles del mapa */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Selector de capa base */}
          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700">
              🗺️ Capa base:
            </label>
            <select
              value={currentBaseLayer}
              onChange={(e) => setCurrentBaseLayer(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(baseLayers).map(([key, layer]) => (
                <option key={key} value={key}>
                  {layer.name}
                </option>
              ))}
            </select>
          </div>

          {/* Botones de control */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowWmsForm(!showWmsForm)}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            >
              {showWmsForm ? "Ocultar WMS" : "+ WMS"}
            </button>
            <button
              onClick={refreshMap}
              className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
              title="Refrescar mapa"
            >
              🔄
            </button>
            <span className="text-sm text-gray-600">
              {coordinates.length} punto{coordinates.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Formulario WMS */}
        {showWmsForm && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <h4 className="font-medium text-gray-900 mb-3">
              🌐 Agregar Servicio WMS
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nombre (opcional)
                </label>
                <input
                  type="text"
                  value={wmsName}
                  onChange={(e) => setWmsName(e.target.value)}
                  placeholder="Mi capa WMS"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  URL del servicio *
                </label>
                <input
                  type="url"
                  value={wmsUrl}
                  onChange={(e) => setWmsUrl(e.target.value)}
                  placeholder="https://ejemplo.com/geoserver/wms"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Capas *
                </label>
                <input
                  type="text"
                  value={wmsLayersText}
                  onChange={(e) => setWmsLayersText(e.target.value)}
                  placeholder="capa1,capa2"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-between items-center">
              <div className="text-xs text-gray-600">
                💡 Ejemplo wms:{" "}
                <code>
                  https://geocatastro.quito.gob.ec:8443/geoserver/usigc/wms{" "}
                </code>
                <br />
                🗺️ Ejemplo capa: <code> Ortomosaico DMQ 2010 </code>
              </div>
              <button
                onClick={addWMSLayer}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                Agregar WMS
              </button>
            </div>
          </div>
        )}

        {/* Lista de capas WMS activas */}
        {wmsLayers.length > 0 && (
          <div className="mt-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">
              🗂️ Capas WMS activas:
            </h5>
            <div className="space-y-1">
              {wmsLayers.map((wms, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded text-sm"
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={wms.visible}
                      onChange={() => toggleWMSVisibility(index)}
                    />
                    <span className="font-medium">{wms.name}</span>
                    <span className="text-gray-600 ml-2">({wms.layers})</span>
                  </label>
                  <button
                    onClick={() => removeWMSLayer(index)}
                    className="text-red-600 hover:text-red-800 font-bold"
                    title="Remover capa"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contenedor del mapa con altura fija */}
      <div
        className="bg-white rounded-lg shadow-md overflow-hidden"
        style={{ height: "500px" }}
      >
        <div
          ref={mapRef}
          className="w-full h-full"
          style={{
            height: "100%",
            minHeight: "500px",
          }}
        />
      </div>

      {/* Información adicional */}
      {coordinates.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">
            📍 Información de puntos
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium text-blue-800">Total puntos:</div>
              <div className="text-blue-700">{coordinates.length}</div>
            </div>
            <div>
              <div className="font-medium text-blue-800">Exitosos:</div>
              <div className="text-green-600">
                {coordinates.filter((c) => c.status === "success").length}
              </div>
            </div>
            <div>
              <div className="font-medium text-blue-800">Con errores:</div>
              <div className="text-red-600">
                {coordinates.filter((c) => c.status === "error").length}
              </div>
            </div>
            <div>
              <div className="font-medium text-blue-800">Capas WMS:</div>
              <div className="text-blue-700">{wmsLayers.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* Ayuda para WMS */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-900 mb-2">
          💡 Servicios WMS populares para Ecuador:
        </h4>
        <div className="text-sm text-yellow-800 space-y-1">
          <div>
            <strong>IGM Ecuador: </strong>{" "}
            <code>https://www.geoportaligm.gob.ec/geoserver/mapabase/wms</code>
          </div>
          <div>
            <strong>Geoportal del MDMQ: </strong>{" "}
            <code>https://geomdmq.quito.gob.ec:8443/geoserver/smiq/wms</code>
          </div>
          <div>
            <strong>Ortofotos Catastro UIO: </strong>{" "}
            <code>
              https://geocatastro.quito.gob.ec:8443/geoserver/usigc/wms
            </code>
          </div>
          <div className="text-xs mt-2">
            ⚠️ Algunos servicios pueden requerir autenticación o tener
            restricciones de acceso.
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;
