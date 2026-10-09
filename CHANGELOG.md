# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versionado [SemVer](https://semver.org/lang/es/).

## [1.1.0] - 2026-10-09

### Añadido
- Suite de tests con Vitest (279 casos): cada transformación WGS84 ↔ SIRES-DMQ ↔ UTM 17N/17S/18N/18S se compara con valores calculados por PROJ (pyproj), con tolerancia de 1 mm; además se prueban ida y vuelta, validaciones, lectura de CSV/Excel y exportadores.
- Script `scripts/generate_reference_points.py` para regenerar los valores de referencia.
- Reporte de validación por fila en la carga de archivos: número de fila y motivo de cada rechazo.
- Validación de rangos para UTM 17/18 N/S y detección de signo omitido, latitud/longitud intercambiadas y Este/Norte intercambiados.
- Validación de DMS (minutos y segundos < 60).
- La exportación CSV/Excel conserva todas las columnas del archivo original y agrega `Destino_X/Y`, `Destino_EPSG`, `WGS84_Lat/Lon`, `Estado` y `Observacion`.
- Dockerfile multi-etapa (tests incluidos) con nginx sin privilegios, cabeceras de seguridad y `/healthz`; `docker-compose.yml`.
- CI en GitHub Actions (lint, tests, build, imagen Docker), Dependabot, CODEOWNERS y plantillas de issues/PR.
- Documentación técnica (`docs/TECNICO.md`), `SECURITY.md`, `CONTRIBUTING.md` y guía de protección de rama.

### Corregido
- **Coma decimal ignorada en la entrada manual:** `-0,2201` se leía como `-0` y `498630,15` como `498630`. Ahora se interpretan correctamente.
- **Precisión de exportación:** las coordenadas geográficas destino se exportaban y mostraban con 2 decimales (≈ 1,1 km de error) y con unidad "m". Ahora se usan 8 decimales en grados y 3 en metros.
- **Mapa y KML con origen proyectado:** usaban metros como si fueran grados, por lo que los puntos UTM/SIRES no aparecían o quedaban fuera de lugar. Ahora se convierten a WGS84.
- **GeoJSON** no conforme a RFC 7946 (geometría en metros con `crs: "SIRES-DMQ"`, que QGIS/ArcGIS no reconocen). Ahora la geometría va en WGS84 y las coordenadas destino en las propiedades.
- Una sola fila inválida abortaba todo el lote; ahora queda marcada como `ERROR` y el resto se procesa.
- Excel: se leía el valor *formateado* de la celda (podía redondear coordenadas); ahora se lee el valor real.
- `parseNumber`: `9.975.649` se interpretaba como `9975.649`, y textos como `12abc` se aceptaban como `12`.
- Ejemplos de `getEcuadorSystems` y botones de ejemplo con coordenadas incorrectas (hasta 82 km de error en el ejemplo UTM-17S).
- Valores `0` exportados como celdas vacías.
- `decimalToDMS` podía producir `60.000″`.
- XSS: los nombres de puntos que vienen de archivos se insertaban sin escapar en los popups del mapa.
- Auto-detección: se eliminó una rama inalcanzable y se documentó la ambigüedad entre las zonas 17 y 18.

### Eliminado
- Dependencias no usadas: `axios`, `geolib`, `clsx`, `tailwind-merge`, `lucide-react`.
- Indicador de "Calidad de precisión", que nunca se calculaba.
