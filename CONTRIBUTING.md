# Guía de contribución

## Flujo de trabajo

1. Cree una rama desde `main`: `git checkout -b feat/descripcion-corta`.
2. Haga sus cambios con commits pequeños y descriptivos (se recomienda [Conventional Commits](https://www.conventionalcommits.org/es/): `feat:`, `fix:`, `docs:`, `test:`, `chore:`).
3. Ejecute las verificaciones locales:
   ```bash
   npm run check   # lint + tests + build
   ```
4. Abra un Pull Request hacia `main`. La rama `main` está protegida: el PR necesita que el CI pase y la aprobación del responsable (ver `CODEOWNERS`).

## Cambios en transformaciones

La precisión es crítica para el catastro. Todo cambio en `src/utils/coordinateTransformations.js`:

- debe tener tests en `src/utils/__tests__/`,
- si modifica parámetros geodésicos, debe regenerar los valores de referencia con PROJ:
  ```bash
  pip install pyproj
  python scripts/generate_reference_points.py > src/utils/__tests__/fixtures/reference-points.json
  ```
  y citar la fuente oficial del parámetro en el PR,
- debe actualizar `docs/TECNICO.md`.

## Estilo

- ESLint (`npm run lint`) sin errores.
- Textos de interfaz y mensajes de error en español, claros y accionables ("Este fuera del rango típico de SIRES-DMQ (450.000 – 550.000)").
