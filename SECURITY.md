# Política de seguridad

## Reportar una vulnerabilidad

No abra un issue público. Use **Security → Report a vulnerability** (GitHub Private Vulnerability Reporting) o escriba al responsable del repositorio. Indique:

- descripción y pasos para reproducir,
- impacto estimado,
- versión o commit afectado.

Se dará acuse de recibo en un plazo de 5 días hábiles.

## Modelo de seguridad

- La aplicación es **100 % estática**: los archivos CSV/Excel se procesan en el navegador y no se envían a ningún servidor.
- La imagen Docker usa `nginx-unprivileged` (sin root), sistema de archivos de solo lectura (`docker-compose.yml`) y cabeceras de seguridad (CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`).
- Los nombres de puntos que vienen de archivos se escapan antes de mostrarlos en el mapa y en KML (prevención de XSS).
- Las exportaciones CSV neutralizan textos que empiezan con `=`, `+`, `-` o `@` (prevención de inyección de fórmulas).

## Vulnerabilidades conocidas

| Paquete | Aviso | Estado |
|---|---|---|
| `xlsx` 0.18.5 (npm) | [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) (Prototype Pollution), [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) (ReDoS) | SheetJS dejó de publicar en npm. Las correcciones están en `xlsx` ≥ 0.20.2, que se distribuye desde su CDN. **Mitigación actual:** el archivo se procesa solo en el navegador del propio usuario, con un límite de 10 MB. **Corrección recomendada:** `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` |
