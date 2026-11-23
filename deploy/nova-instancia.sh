#!/usr/bin/env bash
# Instala uma nova cópia independente da app num subdomínio (dados e utilizadores próprios).
#
# Uso:   sudo bash /opt/orcamento/deploy/nova-instancia.sh SUBDOMINIO PORTA
# Ex.:   sudo bash /opt/orcamento/deploy/nova-instancia.sh orcamentopais.valormaximo.pt 18096
#
# Antes: criar no DNS um registo A do subdomínio a apontar para o IP da VPS.
set -euo pipefail

DOMINIO="${1:-}"
PORTA="${2:-}"
if [ -z "$DOMINIO" ] || [ -z "$PORTA" ]; then
  echo "Uso: sudo bash $0 SUBDOMINIO PORTA   (ex.: orcamentopais.valormaximo.pt 18096)"; exit 1
fi
[ "$(id -u)" -eq 0 ] || { echo "Execute com sudo."; exit 1; }

NOME="${DOMINIO%%.*}"                      # ex.: orcamentopais
DESTINO="/opt/$NOME"
ORIGEM="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(git -C "$ORIGEM" remote get-url origin)"
RAMO="$(git -C "$ORIGEM" rev-parse --abbrev-ref HEAD)"
NGINX_CONF="/etc/nginx/sites-available/$DOMINIO"

echo "==> Verificações"
[ -e "$DESTINO" ] && { echo "ERRO: a pasta $DESTINO já existe."; exit 1; }
[ -e "$NGINX_CONF" ] && { echo "ERRO: já existe configuração Nginx para $DOMINIO."; exit 1; }
if ss -tln | grep -q ":$PORTA "; then echo "ERRO: a porta $PORTA já está ocupada. Escolha outra."; exit 1; fi
getent hosts "$DOMINIO" >/dev/null || { echo "ERRO: o DNS de $DOMINIO ainda não responde. Crie o registo A e aguarde."; exit 1; }
echo "    $DOMINIO -> $(getent hosts "$DOMINIO" | awk '{print $1}') | porta $PORTA | pasta $DESTINO"

echo "==> A descarregar a app ($RAMO)"
git clone -q -b "$RAMO" --single-branch "$REPO" "$DESTINO"
cat > "$DESTINO/.env" <<CONF
ORC_PORTA=$PORTA
ORC_URL=https://$DOMINIO
CONF

echo "==> A compilar e arrancar (alguns minutos)"
(cd "$DESTINO" && docker compose up -d --build)
for i in $(seq 1 30); do
  curl -fs "http://127.0.0.1:$PORTA/api/health" >/dev/null && break
  sleep 2
done
curl -fs "http://127.0.0.1:$PORTA/api/health" >/dev/null || { echo "ERRO: a app não respondeu na porta $PORTA."; exit 1; }
echo "    app a responder em 127.0.0.1:$PORTA"

echo "==> Nginx"
sed -e "s/orcamento\.valormaximo\.pt/$DOMINIO/g" \
    -e "s/127\.0\.0\.1:[0-9]*;/127.0.0.1:$PORTA;/" \
    "$DESTINO/deploy/nginx-orcamento.conf" > "$NGINX_CONF"
ln -s "$NGINX_CONF" "/etc/nginx/sites-enabled/$DOMINIO"
if ! nginx -t; then
  rm -f "/etc/nginx/sites-enabled/$DOMINIO" "$NGINX_CONF"
  echo "ERRO na configuração Nginx: nada foi alterado nos outros sites."; exit 1
fi
systemctl reload nginx

echo "==> Certificado HTTPS"
certbot --nginx -d "$DOMINIO"

echo
echo "Concluído. Abra https://$DOMINIO e crie a conta de administrador desta instalação."
echo "Para atualizar no futuro:  cd $DESTINO && sudo git pull && sudo docker compose up -d --build"
