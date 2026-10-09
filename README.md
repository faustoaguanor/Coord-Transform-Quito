# Transformador de Coordenadas Quito

[![CI](https://github.com/faustoaguanor/Coord-Transform-Quito/actions/workflows/ci.yml/badge.svg)](https://github.com/faustoaguanor/Coord-Transform-Quito/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE.txt)

Aplicación web para transformar coordenadas entre los sistemas de referencia usados en el Distrito Metropolitano de Quito y en Ecuador: **WGS84**, **SIRES-DMQ** y **UTM 17N/17S/18N/18S**. Está pensada para el trabajo catastral: procesa lotes de miles de puntos desde CSV/Excel, valida cada fila y exporta el resultado conservando las columnas originales.

**Demo:** https://faustoaguanor.github.io/Coord-Transform-Quito

## Características

| | |
|---|---|
| **Sistemas** | WGS84 (EPSG:4326), SIRES-DMQ, UTM 17N/17S/18N/18S (EPSG:32617/32717/32618/32718) |
| **Entrada manual** | Grados decimales, DMS o coordenadas proyectadas, con vista previa en tiempo real |
| **Lotes** | CSV (`,` `;` o tabulación) y Excel, hasta 50 000 filas / 10 MB; detección automática de columnas y del sistema |
| **Validación** | Formato numérico (punto o coma decimal), rangos por sistema, columnas intercambiadas, signo omitido; reporte por número de fila |
| **Exportación** | CSV y Excel (columnas originales + transformadas), GeoJSON (RFC 7946), KML |
| **Precisión** | < 1 mm frente a PROJ, verificada con 279 tests automáticos |
| **Privacidad** | Todo se procesa en el navegador; los datos no salen del equipo |
| **Mapa** | Leaflet con capas base y soporte para WMS (geoportales del MDMQ e IGM) |

## Inicio rápido

Requisitos: Node.js ≥ 20.19 (ver `.nvmrc`).

```bash
npm ci
npm run dev        # http://localhost:5173/Coord-Transform-Quito/
```

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests unitarios (Vitest) |
| `npm run lint` | ESLint |
| `npm run build` | Compilación de producción en `dist/` |
| `npm run check` | lint + tests + build (lo mismo que ejecuta el CI) |
| `npm run deploy` | Publica `dist/` en GitHub Pages |

## Despliegue en un servidor (Docker)

```bash
docker compose up -d --build
# http://<servidor>:8080
```

O sin Compose:

```bash
docker build -t coord-transform-quito .
docker run -d --name coord-transform -p 8080:8080 --restart unless-stopped coord-transform-quito
```

- La imagen ejecuta los tests durante la construcción: si una transformación falla, la imagen no se genera.
- Usa nginx sin privilegios (puerto 8080), con cabeceras de seguridad, caché de recursos y `GET /healthz` para monitoreo.
- Para publicar bajo un subdirectorio (p. ej. `https://intranet.quito.gob.ec/coordenadas/`): `docker build --build-arg BASE_PATH=/coordenadas/ .`
- Detrás de un proxy inverso institucional (Apache/nginx), redirija el tráfico al puerto 8080 del contenedor y termine TLS en el proxy.

## Carga por lotes

Nombres de columna reconocidos (no distingue mayúsculas de minúsculas):

| Dato | Encabezados |
|---|---|
| Latitud / Longitud | `lat`, `latitude`, `latitud` / `lon`, `lng`, `long`, `longitude`, `longitud` |
| Este / Norte | `x`, `este`, `easting`, `utm_x`, `coord_x`, `coordenada_x` / `y`, `norte`, `northing`, `utm_y`, `coord_y`, `coordenada_y` |
| Identificador | `nombre`, `name`, `punto`, `id`, `codigo`, `clave`, `clave_catastral` |

Ejemplo:

```csv
clave_catastral;uso;este;norte
1010101001;residencial;776904,297;9975649,232
1010101002;comercial;780503,543;9988936,224
```

> Las zonas UTM 17 y 18 no se distinguen por sus valores numéricos. Para datos en **zona 18** (Amazonía), seleccione el sistema de origen en lugar de usar "Auto-detectar".

## Documentación

- [Documentación técnica](docs/TECNICO.md): parámetros EPSG/PROJ, fórmulas, precisión esperada, reglas de validación y limitaciones (datum, PSAD56, zonas).
- [Protección de la rama `main`](docs/PROTECCION_RAMA.md)
- [Guía de contribución](CONTRIBUTING.md) · [Seguridad](SECURITY.md) · [Cambios](CHANGELOG.md)

## Estructura

```
├── src/
│   ├── components/            # CoordinateInput, FileUpload, MapComponent
│   ├── utils/
│   │   ├── coordinateTransformations.js   # Motor: sistemas, validación, lotes
│   │   ├── fileParsing.js                 # Lectura CSV/Excel → puntos
│   │   ├── exporters.js                   # CSV, Excel, GeoJSON, KML
│   │   └── __tests__/                     # Tests + valores de referencia PROJ
│   └── App.jsx
├── scripts/generate_reference_points.py   # Genera los valores de referencia con pyproj
├── docker/nginx.conf
├── Dockerfile · docker-compose.yml
└── .github/                   # CI, CODEOWNERS, plantillas, Dependabot
```

## Licencia

[MIT](LICENSE.txt). Proyecciones con [proj4js](https://github.com/proj4js/proj4js); mapas con [Leaflet](https://leafletjs.com/) y [OpenStreetMap](https://www.openstreetmap.org/).
