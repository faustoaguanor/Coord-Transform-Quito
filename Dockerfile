# syntax=docker/dockerfile:1

# ---------- Etapa 1: compilación ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# Ejecutar los tests dentro de la imagen garantiza que no se publique una
# versión con transformaciones incorrectas.
RUN npm test

# Ruta pública de la aplicación ("/" en servidor propio; cambiar con
# --build-arg BASE_PATH=/coordenadas/ si se publica bajo un subdirectorio).
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
RUN npm run build

# ---------- Etapa 2: servidor web ----------
# nginx sin privilegios de root, escucha en el puerto 8080
FROM nginxinc/nginx-unprivileged:1.31-alpine AS runtime

LABEL org.opencontainers.image.title="Coord-Transform-Quito" \
      org.opencontainers.image.description="Transformador de coordenadas WGS84 / SIRES-DMQ / UTM 17-18 para el DMQ" \
      org.opencontainers.image.source="https://github.com/faustoaguanor/Coord-Transform-Quito" \
      org.opencontainers.image.licenses="MIT"

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
