#!/usr/bin/env bash
# Instala (ou atualiza) o CRM Valor Máximo numa VPS Ubuntu 24.04.
#
# Pré-requisito: o repositório já clonado em /opt/crm (ver documentacao/INSTALACAO_VPS.md).
# Uso (como root):   bash /opt/crm/infra/instalar-vps.sh [--demo]
#   --demo   cria utilizadores e dados FICTÍCIOS de demonstração (só para a instância de teste).
#
# O script é idempotente: pode ser executado de novo para atualizar a aplicação.
set -euo pipefail

PASTA=/opt/crm
ENV_FICHEIRO="$PASTA/.env.producao"
DEMO=0
[[ "${1:-}" == "--demo" ]] && DEMO=1

if [[ $EUID -ne 0 ]]; then echo "Execute como root (sudo -i)."; exit 1; fi
cd "$PASTA"

echo "==> 1/6 Pacotes do sistema (Docker, firewall)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 ufw git openssl curl >/dev/null
systemctl enable --now docker >/dev/null

# Com 2 GB de RAM, a compilação da interface pode esgotar a memória: criar 2 GB de swap se não houver.
if ! swapon --show | grep -q .; then
  echo "    A criar ficheiro de swap de 2 GB"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> 2/6 Firewall: só SSH, HTTP e HTTPS"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

echo "==> 3/6 Configuração e segredos"
if [[ ! -f "$ENV_FICHEIRO" ]]; then
  IP=$(curl -fsS -4 https://api.ipify.org || hostname -I | awk '{print $1}')
  DOMINIO="${CRM_DOMINIO:-$(echo "$IP" | tr '.' '-').sslip.io}"
  umask 077
  cat > "$ENV_FICHEIRO" <<CONF
# Gerado em $(date -Iseconds). NÃO partilhar nem enviar para o Git.
CRM_AMBIENTE=${CRM_AMBIENTE:-teste}
CRM_DOMINIO=$DOMINIO
CRM_URL_FRONTEND=https://$DOMINIO
CRM_CONFIAR_PROXY=true
DJANGO_SECRET_KEY=$(openssl rand -base64 48 | tr -d '\n')
DJANGO_ALLOWED_HOSTS=$DOMINIO
DJANGO_CSRF_TRUSTED_ORIGINS=https://$DOMINIO
DJANGO_HSTS_SECONDS=31536000
POSTGRES_DB=crm
POSTGRES_USER=crm
POSTGRES_PASSWORD=$(openssl rand -hex 24)
CONF
  echo "    Criado $ENV_FICHEIRO (domínio: $DOMINIO)"
else
  echo "    $ENV_FICHEIRO já existe: mantido."
fi
set -a; source "$ENV_FICHEIRO"; set +a

echo "==> 4/6 Construir e arrancar (pode demorar alguns minutos na primeira vez)"
docker compose -f docker-compose.prod.yml --env-file "$ENV_FICHEIRO" up -d --build

echo "==> 5/6 Aguardar o servidor"
for i in $(seq 1 60); do
  if docker compose -f docker-compose.prod.yml --env-file "$ENV_FICHEIRO" exec -T backend \
       python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/api/saude/')" 2>/dev/null; then
    break
  fi
  sleep 3
done

if [[ $DEMO -eq 1 ]]; then
  echo "==> 6/6 Dados de demonstração (fictícios)"
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
  echo "==> 6/6 Sem dados de demonstração. Crie o primeiro Administrador com:"
  echo "    docker compose -f docker-compose.prod.yml --env-file $ENV_FICHEIRO exec backend python manage.py createsuperuser"
fi

echo
echo "Concluído. Abra: https://$CRM_DOMINIO"
echo "(O certificado HTTPS pode demorar 1–2 minutos a ser emitido no primeiro arranque.)"
