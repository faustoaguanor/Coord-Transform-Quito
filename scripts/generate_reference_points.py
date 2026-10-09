"""Genera valores de referencia para los tests de transformación.

Usa PROJ (vía pyproj), una implementación independiente de proj4js, para
calcular las coordenadas esperadas en cada sistema soportado.

Uso:
    pip install pyproj
    python scripts/generate_reference_points.py > src/utils/__tests__/fixtures/reference-points.json
"""

import json

import pyproj
from pyproj import Transformer

SIRES_DMQ = (
    "+proj=tmerc +lat_0=0 +lon_0=-78.5 +k=1.0004584 +x_0=500000 "
    "+y_0=10000000 +ellps=WGS84 +units=m +no_defs"
)

SYSTEMS = {
    "SIRES-DMQ": SIRES_DMQ,
    "UTM-17N": "EPSG:32617",
    "UTM-17S": "EPSG:32717",
    "UTM-18N": "EPSG:32618",
    "UTM-18S": "EPSG:32718",
}

# (nombre, latitud, longitud, sistemas en los que el punto es "natural")
POINTS = [
    ("Plaza Grande, Quito", -0.2201, -78.5123, ["SIRES-DMQ", "UTM-17S"]),
    ("Carcelén, Quito", -0.0950, -78.4800, ["SIRES-DMQ", "UTM-17S"]),
    ("Quitumbe, Quito", -0.2960, -78.5530, ["SIRES-DMQ", "UTM-17S"]),
    ("Tumbaco", -0.2110, -78.4000, ["SIRES-DMQ", "UTM-17S"]),
    ("Mitad del Mundo", -0.0022, -78.4558, ["SIRES-DMQ", "UTM-17S"]),
    ("Guayaquil", -2.1894, -79.8890, ["UTM-17S"]),
    ("Cuenca", -2.9001, -79.0059, ["UTM-17S"]),
    ("Esmeraldas", 0.9682, -79.6517, ["UTM-17N", "UTM-17S"]),
    ("Tena", -0.9938, -77.8129, ["UTM-18S"]),
    ("Nueva Loja", 0.0847, -76.8828, ["UTM-18N", "UTM-18S"]),
]


def main():
    points = []
    for name, lat, lon, natural in POINTS:
        projected = {}
        for code, crs in SYSTEMS.items():
            transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
            x, y = transformer.transform(lon, lat)
            projected[code] = {"x": round(x, 4), "y": round(y, 4)}
        points.append(
            {"name": name, "lat": lat, "lon": lon, "natural": natural, "projected": projected}
        )

    print(
        json.dumps(
            {
                "generator": "scripts/generate_reference_points.py",
                "proj_version": pyproj.proj_version_str,
                "pyproj_version": pyproj.__version__,
                "points": points,
            },
            indent=2,
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
