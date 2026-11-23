# Orçamento — app de orçamento pessoal e profissional

Aplicação web instalável (PWA) para registar despesas e receitas, analisar movimentos por categoria e prever despesas mensais e anuais. Funciona no telemóvel e no computador, com sincronização em tempo real e vários utilizadores.

## Funcionalidades

| Área | O que faz |
|---|---|
| **Painel** | Receitas, despesas, saldo e valores por pagar do mês; despesas por categoria; orçamento vs real; receitas/despesas e fixas/variáveis dos últimos 12 meses |
| **Movimentos** | Registo rápido (botão +), filtros por mês/ano, tipo, categoria, responsável, estado e pesquisa; anexos (foto da fatura ou PDF); exportação e importação CSV |
| **Análise** | Mapa anual mês a mês (como o `Mapa_TotaisMes` da folha) agrupado por categoria, grupo, fixa/variável, fornecedor, responsável, método ou âmbito; comparação com os 2 anos anteriores |
| **Previsão** | Previsão mensal e anual (ano corrente ou próximos 12 meses) por categoria, separando despesas **fixas** e **variáveis** |
| **Recorrentes** | Renda, salário, Vodafone, EDP, seguros, propinas… lançados automaticamente na data (mensal, bimestral, trimestral, semestral, anual) |
| **Configurar** | Categorias, fornecedores, métodos de pagamento, responsáveis, utilizadores e definições, tudo editável no ecrã, **sem código** |
| **Pessoal / Profissional** | Cada movimento tem um âmbito; o seletor no topo filtra toda a app (Tudo / Pessoal / Profissional) |
| **Sem rede** | A app abre sem ligação; movimentos registados offline são enviados quando a rede voltar |
| **Multi-utilizador** | Todos os utilizadores partilham os mesmos dados; alterações aparecem nos outros aparelhos em tempo real. Papéis: *administrador* (configura tudo) e *membro* (regista movimentos) |

## Arquitetura

```
Telemóvel / PC (browser ou app instalada)
        │ HTTPS
   Nginx (orcamento.valormaximo.pt)  ──  certificado Let's Encrypt
        │
   PocketBase (um único executável)
     ├── API REST + tempo real (SSE) + autenticação
     ├── pb_hooks/      lógica do servidor (recorrências, validações, 1.º arranque)
     ├── pb_migrations/ esquema da base de dados + dados iniciais
     ├── pb_public/     a aplicação (HTML/CSS/JS, sem build)
     └── pb_data/       base de dados SQLite + anexos + cópias de segurança
```

Não há dependências externas em produção: um executável e uma pasta de dados.

---

## Instalação na VPS (Docker, recomendado)

### 1. DNS
No painel do domínio `valormaximo.pt`, crie um registo **A** `orcamento` a apontar para o IP da VPS (e **AAAA** se tiver IPv6).

### 2. Copiar o projeto e arrancar
```bash
scp -r orcamento utilizador@IP_DA_VPS:/opt/
```
```bash
ssh utilizador@IP_DA_VPS
```
```bash
cd /opt/orcamento && sudo docker compose up -d --build
```
A app fica a correr em `127.0.0.1:8095` (a 8090 já está ocupada na VPS), acessível só a partir da própria VPS.

### 3. Nginx + HTTPS
```bash
sudo cp deploy/nginx-orcamento.conf /etc/nginx/sites-available/orcamento.valormaximo.pt
```
```bash
sudo ln -s /etc/nginx/sites-available/orcamento.valormaximo.pt /etc/nginx/sites-enabled/
```
```bash
sudo nginx -t && sudo systemctl reload nginx
```
```bash
sudo certbot --nginx -d orcamento.valormaximo.pt
```
(Se usar Caddy em vez de Nginx, veja `deploy/Caddyfile`: o HTTPS é automático.)

### 4. Primeiro acesso
1. Abra **https://orcamento.valormaximo.pt**. Aparece o ecrã **Criar administrador**: é a sua conta na app.
2. Crie a conta de gestão técnica (painel avançado em `/_/`):
   ```bash
   sudo docker compose exec orcamento /app/orcamento-server superuser upsert O_SEU_EMAIL UMA_PALAVRA_PASSE_FORTE
   ```
3. Em **https://orcamento.valormaximo.pt/_/** → *Settings*:
   - **Application**: URL `https://orcamento.valormaximo.pt`; em *Trusted proxy* indique o cabeçalho `X-Forwarded-For`.
   - **Backups**: ative cópias automáticas diárias (ex.: `0 3 * * *`, guardar 14).
   - **Mail settings** (opcional): SMTP para recuperação de palavra-passe.
4. Na app, em **Configurar → Utilizadores**, adicione as outras pessoas.

### 5. Instalar no telemóvel
- **Android (Chrome)**: menu ⋮ → *Instalar aplicação*.
- **iPhone (Safari)**: botão Partilhar → *Adicionar ao ecrã principal*.

---

## Alternativa sem Docker (systemd)
O executável `orcamento-server` incluído foi compilado para Linux x86-64.
```bash
sudo useradd --system --home /opt/orcamento orcamento
```
```bash
sudo cp -r orcamento /opt/ && sudo chown -R orcamento:orcamento /opt/orcamento
```
```bash
sudo cp /opt/orcamento/deploy/orcamento.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now orcamento
```
Depois siga os passos 3 e 4 acima (o comando do superuser passa a ser `sudo -u orcamento /opt/orcamento/orcamento-server superuser upsert EMAIL PASS`, executado dentro de `/opt/orcamento`).

Para compilar noutra arquitetura (ex.: ARM): `cd server && GOARCH=arm64 CGO_ENABLED=0 go build -o ../orcamento-server .` (requer Go ≥ 1.27).

---

## Configuração sem código

| O quê | Onde |
|---|---|
| Categorias (despesa/receita, **fixa/variável**, grupo, âmbito por omissão, orçamento mensal, ativa) | Configurar → Categorias |
| Fornecedores (com categoria sugerida automaticamente) | Configurar → Fornecedores (qualquer utilizador pode criar um novo ao registar um movimento) |
| Métodos de pagamento, responsáveis | Configurar → separadores respetivos |
| Utilizadores e papéis | Configurar → Utilizadores (só administradores) |
| Nº de meses da média da previsão (`meses_media`), antecedência das recorrências, nome da app | Configurar → Definições |
| Novos campos, regras de acesso, cópias de segurança, registos | Painel avançado `/_/` (superuser) |

Para ocultar uma categoria ou fornecedor antigo, desmarque **Ativo**: o histórico mantém-se. Eliminar só é possível se não tiver movimentos associados.

## Como é feita a previsão
Para cada categoria e cada mês futuro:
- **Fixa com recorrência registada**: soma das recorrências que vencem nesse mês. Respeita a periodicidade: o seguro anual só conta no mês em que vence.
- **Fixa sem recorrência, ou variável**: média dos últimos *N* meses completos (`meses_media`, por omissão 6), mais eventuais recorrências.
- **Sem histórico**: orçamento mensal da categoria, se estiver definido.
- **Mês corrente**: o maior entre o já registado e o previsto.
- **Previsão anual**: real dos meses passados + previsão dos meses que faltam.

Dica: registe como **recorrências** as despesas fixas (Vodafone, mesada, propinas, seguro, Claude…) para a previsão ficar exata.

## Importar dados
Movimentos → **Importar** aceita CSV (no Excel: *Guardar como → CSV UTF-8*). Colunas reconhecidas: `Data; Tipo; Categoria; Valor; Ambito; Fornecedor; Metodo; Responsavel; Pago; Descricao`. Os nomes das colunas da folha `Orçamento.xlsx` (`Tipo_Movimentos`, `Categoria_Movimentos`, `Metodos_Pagamento`, `Fornecedores`, `Responsaveis`…) também são aceites. Datas `dd/mm/aaaa` ou `aaaa-mm-dd`; valores `1.234,56` ou `1234.56`.

## Atualizar a app
Substitua os ficheiros (exceto `pb_data/`) e:
```bash
sudo docker compose up -d --build
```
As migrações de base de dados aplicam-se sozinhas no arranque.

## Cópias de segurança
- Automáticas: painel `/_/` → Settings → Backups (ficam em `pb_data/backups`, podem ir para S3).
- Manual: copiar a pasta `pb_data/` com o serviço parado, ou descarregar um backup no painel.

## Desenvolvimento local
```bash
./orcamento-server serve
```
Abra http://127.0.0.1:8090. O frontend está em `pb_public/` (JavaScript sem passo de compilação: basta editar e recarregar). Ao alterar ficheiros JS/CSS, aumente `VERSAO` em `pb_public/sw.js` para os telemóveis receberem a nova versão.

## Estrutura
```
server/           main.go + go.mod (PocketBase v0.40.6)
pb_migrations/    esquema + dados iniciais (categorias da folha, fornecedores, métodos, responsáveis)
pb_hooks/         recorrências automáticas (cron 06:05), validações, criação do 1.º admin
pb_public/        app: index.html, css/, js/ (core, gráficos, previsão, vistas), sw.js, manifest
deploy/           nginx, Caddy, systemd
Dockerfile, docker-compose.yml
```
