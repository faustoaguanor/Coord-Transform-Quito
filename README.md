# Transformador de Coordenadas Quito

Aplicación web React para transformación de coordenadas entre sistemas de referencia espacial utilizados en Quito, incluyendo WGS84, SIRES-DMQ, UTM 17N/S y UTM 18N/S.

## Características Principales

### Sistemas de Coordenadas Soportados
- **WGS84 Geográficas** - Latitud/Longitud en grados decimales y DMS
- **SIRES-DMQ** - Sistema de Referencia Espacial del Distrito Metropolitano de Quito
- **UTM Zona 17 Norte/Sur** - Ecuador occidental (incluye Quito, Guayaquil)
- **UTM Zona 18 Norte/Sur** - Ecuador oriental (región amazónica)

### Métodos de Entrada
- **Entrada manual** con tres formatos:
  - Grados decimales (ej: -0.2201, -78.5123)
  - Grados, minutos, segundos (DMS)
  - Coordenadas proyectadas (UTM/SIRES)
- **Carga de archivos** en formatos:
  - CSV y Excel (.xlsx, .xls)

- **Ejemplos predefinidos** para pruebas rápidas

### Funcionalidades
- **Auto-detección** del sistema de coordenadas óptimo según ubicación
- **Vista previa en tiempo real** de transformaciones
- **Validación automática** de coordenadas con mensajes específicos
- **Procesamiento por lotes** para archivos con múltiples puntos
- **Mapa interactivo** con múltiples capas base y soporte WMS
- **Manejo inteligente de formatos numéricos** (puntos/comas decimales y separadores de miles)

### Exportación
- **CSV** - Compatible con Excel, incluye BOM UTF-8
- **Excel** - Formato nativo con columnas ajustadas (proximamente)
- **GeoJSON** - Estándar para sistemas SIG (proximamente)
- **KML** - Compatible con Google Earth (proximamente)

### Características Técnicas
- Transformaciones precisas usando **proj4.js**
- Interfaz responsive con **Tailwind CSS**
- Mapa interactivo con **Leaflet** y OpenStreetMap
- Soporte para servicios **WMS** personalizados
- Manejo robusto de errores y validaciones
- Procesamiento asíncrono con indicadores de progreso

## Instalación

### Prerrequisitos
- Node.js (versión 16 o superior)
- npm o yarn

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/coordtransform-quito.git
cd coordtransform-quito
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Iniciar el servidor de desarrollo**
```bash
npm run dev
```

4. **Abrir en el navegador**
```
http://localhost:5173
```

### Dependencias Principales
```json
{
  "react": "^18.0.0",
  "proj4": "^2.9.0",
  "leaflet": "^1.9.0",
  "react-leaflet": "^4.2.0",
  "xlsx": "^0.18.0"
}
```

## Estructura del Proyecto

```
Coord-Transform-Quito/
├── src/
│   ├── components/
│   │   ├── CoordinateInput.jsx      # Formulario de entrada manual
│   │   ├── FileUpload.jsx           # Carga de archivos (CSV/Excel/GeoJSON/KML)
│   │   └── MapComponent.jsx         # Mapa interactivo con Leaflet
│   ├── utils/
│   │   └── coordinateTransformations.js  # Motor de transformaciones
│   ├── App.jsx                      # Componente principal
│   └── main.jsx                     # Punto de entrada
├── public/
├── package.json
└── README.md
```

## Uso

### Entrada Manual
1. Seleccionar modo de entrada (decimales, DMS, o proyectadas)
2. Ingresar coordenadas
3. El sistema sugiere automáticamente el sistema de destino óptimo
4. Vista previa en tiempo real de la transformación
5. Confirmar transformación

### Carga de Archivos
1. Arrastrar archivo o usar botón de selección
2. Formatos soportados: CSV, Excel 
3. Auto-detección de columnas de coordenadas
4. Configurar sistema de origen y destino
5. Procesamiento automático con barra de progreso

### Formatos de Columnas (CSV/Excel)
- **Geográficas:** `lat`, `latitude`, `latitud`, `lon`, `lng`, `longitude`, `longitud`
- **Proyectadas:** `x`, `este`, `easting`, `utm_x`, `y`, `norte`, `northing`, `utm_y`
- **Nombres:** `name`, `nombre`, `punto`, `id`, `identificador`

### Visualización
- Mapa interactivo con múltiples capas base
- Marcadores con información detallada
- Soporte para capas WMS personalizadas
- Auto-ajuste de vista para mostrar todos los puntos

### Exportación
- Seleccionar formato de exportación deseado
- Descarga automática del archivo
 

## Ejemplos de Uso

### Coordenadas de Prueba
- **Quito Centro:** -0.2201, -78.5123 (sugiere SIRES-DMQ)
- **Guayaquil:** -2.1894, -79.8890 (sugiere UTM 17S)
- **Amazonía:** -1.0000, -77.0000 (sugiere UTM 18S)

### Archivo CSV de Ejemplo
```csv
nombre,latitud,longitud
Quito,-0.2201,-78.5123
Guayaquil,-2.1894,-79.8890
Cuenca,-2.9001,-79.0059
```

## Scripts de Desarrollo

```bash
# Desarrollo
npm run dev

# Construcción para producción
npm run build

# Vista previa de build
npm run preview

# Linting
npm run lint
```

## Configuración para Producción

1. **Construir la aplicación**
```bash
npm run build
```

2. **Servir archivos estáticos**
Los archivos generados en `dist/` pueden servirse desde cualquier servidor web estático.


## Consideraciones Técnicas

### Precisión
- Transformaciones implementadas usando definiciones oficiales proj4
- SIRES-DMQ configurado según especificaciones del MDMQ
- Validaciones específicas para rangos de Ecuador

### Limitaciones
- Servicios WMS requieren CORS habilitado
- Archivos grandes (>1000 puntos) pueden requerir procesamiento por lotes


### Navegadores Soportados
- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Licencia

MIT License - ver archivo LICENSE para detalles

## Créditos

- Proyecciones geodésicas: [proj4js](https://github.com/proj4js/proj4js)
- Mapas: [Leaflet](https://leafletjs.com/) y [OpenStreetMap](https://www.openstreetmap.org/)
- Interfaz: [Tailwind CSS](https://tailwindcss.com/)
- Sistemas de referencia: MDMQ


---

Desarrollado específicamente para las necesidades de transformación de coordenadas en Quito.