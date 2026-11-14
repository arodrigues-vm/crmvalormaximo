# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt requirements-dev.txt ./
ARG REQUISITOS=requirements.txt
# Certificado de autoridade extra opcional (apenas para redes com proxy próprio; sem efeito na VPS).
RUN --mount=type=secret,id=ca_extra,required=false \
    if [ -f /run/secrets/ca_extra ]; then export PIP_CERT=/run/secrets/ca_extra; fi; \
    pip install -r ${REQUISITOS}

COPY . .

RUN useradd --create-home crm && mkdir -p /dados/media && chown -R crm /app /dados
USER crm

EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60"]
