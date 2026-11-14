#!/usr/bin/env bash
# Instala (ou atualiza) o CRM Valor Máximo numa VPS Ubuntu 24.04.
#
# Pré-requisito: o repositório já clonado em /opt/crm (ver documentacao/INSTALACAO_VPS.md).
#
# Uso:
#   sudo bash /opt/crm/infra/instalar-vps.sh [opções]
#
# Opções:
#   --demo              cria utilizadores e dados FICTÍCIOS (só para a instância de teste)
#   --dominio NOME      endereço do CRM (ex.: crm.valormaximo.pt); por omissão IP.sslip.io
#   --nginx             a VPS já tem o nginx a servir outros sites: o CRM fica atrás dele
#                       (o nginx trata do HTTPS; os outros sites não são alterados)
#
# É idempotente: pode ser executado de novo para atualizar a aplicação (as opções ficam guardadas).
set -euo pipefail

PASTA=/opt/crm
ENV_FICHEIRO="$PASTA/.env.producao"
DEMO=0
DOMINIO_PEDIDO=""
MODO_PEDIDO=""
PORTA_INTERNA=8090

while [[ $# -gt 0 ]]; do
  case "$1" in
    --demo) DEMO=1 ;;
    --dominio) DOMINIO_PEDIDO="${2:-}"; shift ;;
    --nginx) MODO_PEDIDO="nginx" ;;
    *) echo "Opção desconhecida: $1"; exit 1 ;;
  esac
  shift
done

if [[ $EUID -ne 0 ]]; then echo "Execute com sudo: sudo bash $0"; exit 1; fi
cd "$PASTA"
# O repositório pertence ao utilizador que fez o clone; permitir que o git (como root) o leia.
git config --global --add safe.directory "$PASTA" 2>/dev/null || true

# Altera (ou acrescenta) uma linha CHAVE=valor no ficheiro de configuração.
definir() {
  local chave="$1" valor="$2"
  if grep -q "^${chave}=" "$ENV_FICHEIRO"; then
    sed -i "s|^${chave}=.*|${chave}=${valor}|" "$ENV_FICHEIRO"
  else
    echo "${chave}=${valor}" >> "$ENV_FICHEIRO"
  fi
}

echo "==> 1/7 Pacotes do sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ufw git openssl curl >/dev/null
# Docker: aproveitar o que já existir (ex.: docker-ce do repositório oficial); só instalar se faltar.
if ! command -v docker >/dev/null 2>&1; then
  echo "    A instalar o Docker"
  apt-get install -y -qq docker.io >/dev/null
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "    A instalar o Docker Compose"
  if dpkg -s docker-ce >/dev/null 2>&1; then
    apt-get install -y -qq docker-compose-plugin >/dev/null
  else
    apt-get install -y -qq docker-compose-v2 >/dev/null
  fi
fi
systemctl enable --now docker >/dev/null
echo "    $(docker --version) · $(docker compose version | head -1)"

# Com 2 GB de RAM, a compilação da interface pode esgotar a memória: criar 2 GB de swap se não houver.
if ! swapon --show | grep -q .; then
  echo "    A criar ficheiro de swap de 2 GB"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> 2/7 Firewall: SSH, HTTP e HTTPS"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

echo "==> 3/7 Configuração e segredos"
if [[ ! -f "$ENV_FICHEIRO" ]]; then
  umask 077
  cat > "$ENV_FICHEIRO" <<CONF
# Gerado em $(date -Iseconds). NÃO partilhar nem enviar para o Git.
CRM_AMBIENTE=${CRM_AMBIENTE:-teste}
DJANGO_SECRET_KEY=$(openssl rand -base64 48 | tr -d '\n')
DJANGO_HSTS_SECONDS=31536000
CRM_CONFIAR_PROXY=true
POSTGRES_DB=crm
POSTGRES_USER=crm
POSTGRES_PASSWORD=$(openssl rand -hex 24)
CONF
  echo "    Criado $ENV_FICHEIRO"
fi
set -a; source "$ENV_FICHEIRO"; set +a

# Domínio: o pedido agora, o já guardado, ou IP.sslip.io.
if [[ -n "$DOMINIO_PEDIDO" ]]; then
  DOMINIO="$DOMINIO_PEDIDO"
elif [[ -n "${CRM_DOMINIO:-}" ]]; then
  DOMINIO="$CRM_DOMINIO"
else
  IP=$(curl -fsS -4 https://api.ipify.org || hostname -I | awk '{print $1}')
  DOMINIO="$(echo "$IP" | tr '.' '-').sslip.io"
fi
MODO="${MODO_PEDIDO:-${CRM_MODO:-direto}}"

# Deteção: se o nginx já ocupa a porta 80 e não foi pedido o modo nginx, parar com explicação.
if [[ "$MODO" == "direto" ]] && ss -tlnp 2>/dev/null | grep -E ':80 ' | grep -q nginx; then
  echo
  echo "ATENÇÃO: o nginx desta VPS já está a usar as portas 80/443 (outros sites)."
  echo "Instale o CRM ao lado dele, com um endereço próprio, por exemplo:"
  echo "    sudo bash $PASTA/infra/instalar-vps.sh --nginx --dominio crm.valormaximo.pt"
  exit 1
fi

definir CRM_DOMINIO "$DOMINIO"
definir CRM_MODO "$MODO"
definir CRM_URL_FRONTEND "https://$DOMINIO"
definir DJANGO_ALLOWED_HOSTS "$DOMINIO"
definir DJANGO_CSRF_TRUSTED_ORIGINS "https://$DOMINIO"
if [[ "$MODO" == "nginx" ]]; then
  if ss -tlnp 2>/dev/null | grep -E ":${PORTA_INTERNA} " | grep -vq docker; then
    echo "A porta interna ${PORTA_INTERNA} já está a ser usada por outro programa. Contacte o suporte."; exit 1
  fi
  definir CRM_ENDERECO_SITE ":80"
  definir CRM_PUBLICAR_HTTP "127.0.0.1:${PORTA_INTERNA}"
  definir CRM_PUBLICAR_HTTPS "127.0.0.1:8453"
  definir CRM_CADDY_PROXIES_CONFIAVEIS "private_ranges"
  definir CRM_PROTOCOLO_ORIGEM "https"
  definir CRM_NUMERO_PROXIES "2"
else
  definir CRM_ENDERECO_SITE "$DOMINIO"
  definir CRM_PUBLICAR_HTTP "80"
  definir CRM_PUBLICAR_HTTPS "443"
  definir CRM_CADDY_PROXIES_CONFIAVEIS "127.0.0.1/32"
  definir CRM_PROTOCOLO_ORIGEM ""
  definir CRM_NUMERO_PROXIES "1"
fi
set -a; source "$ENV_FICHEIRO"; set +a
echo "    Endereço: https://$DOMINIO (modo: $MODO)"

echo "==> 4/7 Construir e arrancar (pode demorar alguns minutos na primeira vez)"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FICHEIRO" up -d --build --remove-orphans

echo "==> 5/7 Aguardar o servidor"
for _ in $(seq 1 60); do
  if docker compose -f docker-compose.prod.yml --env-file "$ENV_FICHEIRO" exec -T backend \
       python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/api/saude/')" 2>/dev/null; then
    break
  fi
  sleep 3
done

if [[ "$MODO" == "nginx" ]]; then
  echo "==> 6/7 Ligar ao nginx (os outros sites não são alterados)"
  bash "$PASTA/infra/configurar-nginx.sh" "$DOMINIO" "$PORTA_INTERNA"
else
  echo "==> 6/7 HTTPS tratado pelo Caddy (certificado automático)"
fi

if [[ $DEMO -eq 1 ]]; then
  echo "==> 7/7 Dados de demonstração (fictícios)"
  if [[ "${CRM_AMBIENTE}" == "producao" ]]; then echo "Recusado: ambiente de produção."; exit 1; fi
  SENHA_DEMO_FICHEIRO="$PASTA/.senha-demo"
  if [[ ! -f "$SENHA_DEMO_FICHEIRO" ]]; then
    (umask 077; openssl rand -base64 18 | tr -d '/+=\n' > "$SENHA_DEMO_FICHEIRO")
  fi
  SENHA_DEMO=$(cat "$SENHA_DEMO_FICHEIRO")
  docker compose -f docker-compose.prod.yml --env-file "$ENV_FICHEIRO" exec -T backend \
    python manage.py criar_utilizadores_demo --password "$SENHA_DEMO" >/dev/null
  docker compose -f docker-compose.prod.yml --env-file "$ENV_FICHEIRO" exec -T backend \
    python manage.py criar_entidades_demo >/dev/null
  echo "    Utilizadores: admin@demo.local, responsavel@demo.local, consultor@demo.local, assistente@demo.local"
  echo "    Palavra-passe (guardada em $SENHA_DEMO_FICHEIRO): $SENHA_DEMO"
else
  echo "==> 7/7 Concluído (sem novos dados de demonstração)."
fi

echo
echo "Concluído. Abra: https://$DOMINIO"
