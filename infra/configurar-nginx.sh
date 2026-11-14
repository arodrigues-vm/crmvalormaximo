#!/usr/bin/env bash
# Liga o CRM ao nginx já existente na VPS, com um endereço próprio e certificado HTTPS.
# NÃO altera os outros sites: cria apenas um ficheiro novo para este endereço e valida sempre a
# configuração do nginx antes de a aplicar (se algo falhar, desfaz).
#
# Uso (chamado pelo instalador):  sudo bash configurar-nginx.sh crm.valormaximo.pt 8090
set -euo pipefail

DOMINIO="$1"
PORTA="${2:-8090}"
SITE="/etc/nginx/sites-available/crm-${DOMINIO}"
ATIVO="/etc/nginx/sites-enabled/crm-${DOMINIO}"
WEBROOT="/var/www/letsencrypt"
CERT="/etc/letsencrypt/live/${DOMINIO}/fullchain.pem"

aplicar() {
  # Valida e recarrega; se a validação falhar, retira o ficheiro novo e mantém tudo como estava.
  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx
  else
    echo "ERRO: a configuração do nginx não é válida; a alteração foi desfeita."
    nginx -t || true
    rm -f "$ATIVO"
    nginx -t >/dev/null 2>&1 && systemctl reload nginx
    exit 1
  fi
}

# 1. O endereço tem de apontar para esta VPS (registo DNS).
IP_VPS=$(curl -fsS -4 https://api.ipify.org || hostname -I | awk '{print $1}')
IP_DNS=$(getent ahostsv4 "$DOMINIO" | awk 'NR==1{print $1}' || true)
if [[ "$IP_DNS" != "$IP_VPS" ]]; then
  echo
  echo "O endereço ${DOMINIO} ainda não aponta para esta VPS."
  echo "    IP desta VPS:           ${IP_VPS}"
  echo "    IP atual de ${DOMINIO}: ${IP_DNS:-(nenhum)}"
  echo "Crie o registo DNS (tipo A, nome '${DOMINIO%%.*}', valor ${IP_VPS}) e volte a correr o instalador"
  echo "daqui a 15–30 minutos. O CRM já está instalado; só falta este passo."
  exit 1
fi

# 2. Certbot (emissão do certificado HTTPS gratuito).
command -v certbot >/dev/null 2>&1 || apt-get install -y -qq certbot >/dev/null
mkdir -p "$WEBROOT"

escrever_http() {
  cat > "$SITE" <<NGINX
# CRM Valor Máximo — gerido por /opt/crm/infra/configurar-nginx.sh
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMINIO};

    location /.well-known/acme-challenge/ {
        root ${WEBROOT};
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}
NGINX
}

escrever_https() {
  escrever_http
  cat >> "$SITE" <<NGINX

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${DOMINIO};

    ssl_certificate     /etc/letsencrypt/live/${DOMINIO}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMINIO}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Fotografias até 15 MB.
    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:${PORTA};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 90s;
    }
}
NGINX
}

# 3. Primeiro só HTTP (para o Let's Encrypt validar o endereço), depois o certificado, depois HTTPS.
if [[ ! -f "$CERT" ]]; then
  escrever_http
  ln -sf "$SITE" "$ATIVO"
  aplicar
  echo "    A pedir o certificado HTTPS para ${DOMINIO}"
  certbot certonly --webroot -w "$WEBROOT" -d "$DOMINIO" --non-interactive --agree-tos \
    --register-unsafely-without-email --keep-until-expiring \
    --deploy-hook "systemctl reload nginx" >/dev/null
fi
escrever_https
ln -sf "$SITE" "$ATIVO"
aplicar
echo "    nginx configurado para https://${DOMINIO} (os outros sites não foram alterados)"
