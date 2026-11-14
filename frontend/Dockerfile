# syntax=docker/dockerfile:1
# Compila a interface e serve-a com o Caddy (HTTPS automático e proxy para a API).
FROM node:22-alpine AS compilacao
WORKDIR /app
COPY package.json package-lock.json ./
# Certificado de autoridade extra opcional (apenas para redes com proxy próprio; sem efeito na VPS).
RUN --mount=type=secret,id=ca_extra,required=false \
    if [ -f /run/secrets/ca_extra ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca_extra; fi; \
    npm ci
COPY . .
RUN npm run build

FROM caddy:2.10.2-alpine
COPY --from=compilacao /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
