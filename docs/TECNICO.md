# Documentación técnica

Este documento describe los sistemas de referencia, las fórmulas, la precisión esperada y las limitaciones del Transformador de Coordenadas Quito. Está dirigido a técnicos catastrales, analistas SIG y a quienes mantienen el código.

## 1. Sistemas soportados

| Código interno | Nombre | EPSG | Tipo | Definición PROJ |
|---|---|---|---|---|
| `EPSG:4326` | WGS84 geográficas | 4326 | Geográfico (grados) | `+proj=longlat +datum=WGS84 +no_defs` |
| `SIRES-DMQ` | Sistema de Referencia Espacial del DMQ | — (sin código oficial) | Transversa de Mercator local | `+proj=tmerc +lat_0=0 +lon_0=-78.5 +k=1.0004584 +x_0=500000 +y_0=10000000 +ellps=WGS84 +datum=WGS84 +units=m +no_defs` |
| `UTM-17N` | WGS84 / UTM zona 17N | 32617 | UTM | `+proj=utm +zone=17 +north +datum=WGS84` |
| `UTM-17S` | WGS84 / UTM zona 17S | 32717 | UTM | `+proj=utm +zone=17 +south +datum=WGS84` |
| `UTM-18N` | WGS84 / UTM zona 18N | 32618 | UTM | `+proj=utm +zone=18 +north +datum=WGS84` |
| `UTM-18S` | WGS84 / UTM zona 18S | 32718 | UTM | `+proj=utm +zone=18 +south +datum=WGS84` |

Las definiciones están en `src/utils/coordinateTransformations.js` (`COORDINATE_SYSTEMS`).

### 1.1 Parámetros de SIRES-DMQ

| Parámetro | Valor | Comentario |
|---|---|---|
| Proyección | Transversa de Mercator (TM) | |
| Elipsoide | WGS84 (a = 6 378 137 m, 1/f = 298.257223563) | |
| Latitud de origen (φ₀) | 0° | Ecuador terrestre |
| Meridiano central (λ₀) | −78.5° (78° 30′ W) | Atraviesa Quito |
| Factor de escala (k₀) | 1.0004584 | Lleva las distancias de la proyección a la altura media del DMQ (~2 900 m s.n.m.) |
| Falso Este (FE) | 500 000 m | |
| Falso Norte (FN) | 10 000 000 m | |

El factor de escala responde a `k₀ ≈ 1 + h/R`. Con R ≈ 6 378 km, k₀ = 1.0004584 equivale a una altura de referencia h ≈ 2 924 m. Así, una distancia medida con estación total en Quito coincide (a nivel de mm/km) con la distancia calculada sobre el plano SIRES-DMQ, cosa que no ocurre con UTM (k₀ = 0.9996).

> **Verificación oficial.** Los parámetros son los que se usan habitualmente en el MDMQ. Antes de usar la herramienta en producción catastral, contrástelos con la ordenanza o resolución vigente de la Secretaría de Territorio / Dirección de Catastro y con puntos de control de la red GNSS del DMQ.

### 1.2 Diferencia típica entre sistemas (Plaza Grande, −0.2201°, −78.5123°)

| Sistema | Este (m) | Norte (m) |
|---|---|---|
| SIRES-DMQ | 498 630.153 | 9 975 651.444 |
| UTM-17S | 776 904.297 | 9 975 649.232 |
| UTM-18S | 108 925.157 | 9 975 626.245 |

SIRES-DMQ y UTM-17S difieren en unos 278 km en el Este (por el cambio de meridiano central, −78.5° frente a −81°) y en unos 2 m en el Norte (por el factor de escala). **Confundir los dos sistemas es el error más frecuente**, y la validación de rangos lo detecta (sección 4).

## 2. Fórmulas

### 2.1 Transversa de Mercator

proj4js (≥ 2.4) resuelve `+proj=tmerc` y `+proj=utm` con el algoritmo **Extended Transverse Mercator** (`etmerc`, Poder/Engsager), basado en las series de Krüger de 6.º orden. Es el mismo algoritmo que usa PROJ por defecto. Su error es menor a 1 mm hasta unos 3 900 km del meridiano central.

Forma general (directa):

```
E = FE + k₀ · A · ( ξ' + Σ αⱼ · sin(2jξ') · cosh(2jη') )
N = FN + k₀ · A · ( η' ... )      (series de Krüger en n = f / (2 − f))
```

donde `A` es el radio rectificante del elipsoide y `ξ'`, `η'` son las coordenadas conformes. La inversa usa los coeficientes `βⱼ`. Las ecuaciones completas están en Karney (2011), *Transverse Mercator with an accuracy of a few nanometers*, J. Geodesy 85:475–485.

### 2.2 UTM

UTM es una TM con k₀ = 0.9996, FE = 500 000 m y FN = 0 m (norte) o 10 000 000 m (sur). El meridiano central es `λ₀ = −183° + 6°·zona`: −81° en la zona 17 y −75° en la zona 18.

### 2.3 Grados-minutos-segundos

```
decimal = ±(G + M/60 + S/3600)        (negativo para S y W)
```

`decimalToDMS` redondea los segundos a 3 decimales (~3 cm) y propaga el acarreo para no producir valores como `59′ 60.000″`.

### 2.4 Distancia (Haversine)

`calculateDistance` usa la fórmula de Haversine sobre una esfera de R = 6 371 000 m. Es una distancia **aproximada** (error ≤ 0.5 %) y sirve como referencia rápida. No sirve para replanteo ni para linderos: en esos casos se calcula la distancia sobre el plano SIRES-DMQ o se usa una geodésica (Vincenty o Karney).

## 3. Precisión esperada

| Fuente de error | Magnitud | Nota |
|---|---|---|
| Algoritmo de proyección (proj4js `etmerc`) | < 1 mm | Verificado contra PROJ 9 en el rango de Ecuador continental, incluso a 5° del meridiano central |
| Redondeo de salida en metros | 0.5 mm | 3 decimales |
| Redondeo de salida en grados | ≈ 0.6 mm | 8 decimales (1e-8° ≈ 1.1 mm) |
| Ida y vuelta (WGS84 → proyectada → WGS84) | < 1e-9° | Ver tests |
| **Datum / marco de referencia** | **cm a dm (ver §5)** | No se modela |

Los tests automatizados (`npm test`) comparan cada transformación con valores calculados por PROJ (vía `pyproj`) en 10 puntos de Ecuador (Quito, Guayaquil, Cuenca, Esmeraldas, Tena, Nueva Loja…), con una tolerancia de **1 mm**. Para regenerar los valores de referencia:

```bash
pip install pyproj
python scripts/generate_reference_points.py > src/utils/__tests__/fixtures/reference-points.json
```

## 4. Validación de entrada

Las reglas están en `validateCoordinates`, `validateProjectedCoordinates`, `validateDMS` y `rowsToCoordinates`.

| Verificación | Regla | Mensaje |
|---|---|---|
| Formato numérico | Se acepta punto o coma decimal (`-0.2201`, `-0,2201`) y separadores de miles (`9.975.649,23`, `9,975,649.23`). Se rechazan textos como `12abc` (antes se truncaban en silencio) | "valor no numérico o vacío en …" |
| Latitud / longitud | Latitud entre −90° y 90°, longitud entre −180° y 180° | "Latitud debe estar entre -90 y 90 grados" |
| Ecuador | Latitud entre −5° y 2°, longitud entre −92° y −75° (incluye Galápagos) | "fuera del rango típico de Ecuador" |
| Signo omitido | Longitud entre +75° y +92° | "¿falta el signo negativo (oeste)?" |
| Columnas cruzadas | Lat ≈ −78 y lon ≈ 0 / Este ↔ Norte | "intercambiadas" / "intercambiados" |
| SIRES-DMQ | Este de 450 000 a 550 000 m, Norte de 9 950 000 a 10 050 000 m | "fuera del rango típico de SIRES-DMQ" |
| UTM sur (17S/18S) | Este de 100 000 a 900 000 m, Norte de 9 400 000 a 10 200 000 m | "fuera del rango típico de UTM-17S" |
| UTM norte (17N/18N) | Este de 100 000 a 900 000 m, Norte de −600 000 a 200 000 m | idem |
| DMS | Minutos y segundos en [0, 60) | "Minutos deben estar entre 0 y 59" |
| Archivo | Máximo 10 MB y 50 000 filas | Mensaje en pantalla |

En la carga por lotes, **una fila inválida no detiene el proceso**. Las filas rechazadas se listan con su número de fila y el motivo. Las filas que fallan en la transformación aparecen como `ERROR` en los resultados y en la exportación (columna `Observacion`).

## 5. Limitaciones

1. **Datum único (WGS84).** Todos los sistemas se definen sobre WGS84 y no se aplican transformaciones de datum. En la práctica WGS84 (G2139) y SIRGAS-ECU / ITRF coinciden a nivel de pocos centímetros, lo que basta para catastro urbano. **No se soporta PSAD56** (EPSG:24877/24878, datum de la cartografía antigua del IGM y de catastros anteriores a ~2010), que difiere en **~250–300 m**. Si los datos de origen están en PSAD56, transfórmelos antes con QGIS/PROJ usando los parámetros oficiales del IGM.
2. **Época de referencia.** No se modela la velocidad de la placa (~1 cm/año en Quito). Para trabajos geodésicos de precisión (< 5 cm) use software geodésico con el marco SIRGAS y la época correspondiente.
3. **Auto-detección del sistema de origen.** Las zonas UTM 17 y 18 tienen rangos numéricos superpuestos, así que **no pueden distinguirse por los valores**. La auto-detección asume zona 17. Para datos de la Amazonía en zona 18 (o para cualquier dato cuyo sistema se conozca), **seleccione el sistema de origen explícitamente**.
4. **UTM fuera de zona.** Proyectar en una zona UTM puntos alejados de su meridiano central (por ejemplo, Guayaquil en 18S) da resultados matemáticamente correctos pero con distorsión de escala alta. La validación rechaza Este < 100 000 m o > 900 000 m.
5. **Alturas.** Solo se transforman coordenadas horizontales. No se convierten alturas elipsoidales/ortométricas (EGM96/EGM2008).
6. **Archivos Excel.** Se lee la primera hoja. La librería `xlsx` 0.18.5 del registro npm tiene vulnerabilidades conocidas (ver `SECURITY.md`): abra solo archivos de origen confiable.
7. **GeoJSON.** Conforme a RFC 7946, la geometría se exporta siempre en WGS84 (lon, lat). Las coordenadas del sistema destino van en las propiedades `Destino_X` y `Destino_Y`.
8. **Procesamiento local.** Todo el cálculo ocurre en el navegador y ningún dato se envía a servidores. Las capas base del mapa y las capas WMS sí se descargan de servicios externos.

## 6. Formato de exportación (CSV / Excel)

Primero van las columnas originales del archivo, en el mismo orden, y luego estas:

| Columna | Descripción |
|---|---|
| `Punto` | Nombre o identificador del punto |
| `Estado` | `OK` o `ERROR` |
| `Observacion` | Motivo del error, si lo hay |
| `Origen_Sistema`, `Origen_X`, `Origen_Y` | Coordenadas de entrada normalizadas |
| `Destino_Sistema`, `Destino_EPSG` | Sistema destino y código EPSG (vacío para SIRES-DMQ) |
| `Destino_X`, `Destino_Y` | Coordenadas transformadas (3 decimales en metros, 8 en grados) |
| `WGS84_Lat`, `WGS84_Lon` | Posición geográfica, útil para verificar en un visor web |

El CSV usa UTF-8 con BOM, separador `,` y punto decimal. Los textos que empiezan con `=`, `+`, `-` o `@` se anteponen con `'` para evitar la inyección de fórmulas al abrir el archivo en Excel.

## 7. Referencias

- PROJ — *Transverse Mercator*. https://proj.org/operations/projections/tmerc.html
- Karney, C. F. F. (2011). *Transverse Mercator with an accuracy of a few nanometers*. J. Geodesy 85(8):475–485.
- Poder, K. & Engsager, K. (1998). *Some conformal mappings and transformations for geodesy and topographic cartography*.
- EPSG Geodetic Parameter Dataset. https://epsg.org
- IGM Ecuador — Red GNSS de Monitoreo Continuo / SIRGAS-ECU.
- RFC 7946 — *The GeoJSON Format*.
