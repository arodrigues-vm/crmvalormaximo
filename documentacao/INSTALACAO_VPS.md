# Instalação na VPS Amen (instância de teste)

Guia passo a passo para instalar o CRM Valor Máximo na VPS (Ubuntu 24.04) com **dados fictícios**, para as
verificações intermédias. Demora cerca de 15 minutos. Não é preciso colar palavras-passe em lado nenhum: o
script gera-as na própria VPS.

O resultado é um endereço do tipo `https://203-0-113-10.sslip.io` (o IP da VPS com traços), com HTTPS
verdadeiro (certificado Let's Encrypt). Quando houver um domínio próprio (ex.: `crm.valormaximo.pt`),
muda-se numa linha.

---

## Passo 1 — Entrar na VPS

No PC, abra o **PowerShell** (tecla Windows → escreva *PowerShell* → Enter) e escreva, trocando pelo IP da
VPS e pelo utilizador que a Amen lhe deu:

```bash
ssh root@IP_DA_VPS
```

Na primeira vez pergunta *«Are you sure you want to continue connecting?»*: escreva `yes`. Depois a
palavra-passe (não aparece enquanto escreve; é normal).

> Se o utilizador não for `root`, depois de entrar escreva `sudo -i` para passar a administrador.

## Passo 2 — Criar a chave de leitura do repositório

O repositório é privado: a VPS precisa de uma chave que só permite **ler** o código. Na VPS, escreva:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/crm_github -N "" -C "vps-crm-leitura"
```

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/crm_github\n  IdentitiesOnly yes\n' >> ~/.ssh/config
```

```bash
cat ~/.ssh/crm_github.pub
```

O último comando mostra uma linha a começar por `ssh-ed25519 …`. **Copie-a** (selecione com o rato; no
PowerShell, selecionar já copia). Esta é a parte **pública** da chave: não é secreta.

## Passo 3 — Autorizar a chave no GitHub

1. No browser, abra <https://github.com/arodrigues-vm/crmvalormaximo/settings/keys>.
2. Carregue em **Add deploy key**.
3. **Title:** `VPS Amen (leitura)`. **Key:** cole a linha copiada.
4. **Não** marque *Allow write access*. Carregue em **Add key**.

## Passo 4 — Descarregar o CRM para a VPS

De volta à VPS:

```bash
git clone -b desenvolvimento git@github.com:arodrigues-vm/crmvalormaximo.git /opt/crm
```

Se perguntar *«Are you sure you want to continue connecting?»*, escreva `yes`.

## Passo 5 — Instalar

```bash
bash /opt/crm/infra/instalar-vps.sh --demo
```

O script instala o Docker, ativa a firewall (só SSH, HTTP e HTTPS), gera as palavras-passe internas, compila e
arranca a aplicação e cria os utilizadores de demonstração. A primeira vez demora 5–10 minutos.

No fim mostra algo como:

```
Utilizadores: admin@demo.local, responsavel@demo.local, consultor@demo.local, assistente@demo.local
Palavra-passe (guardada em /opt/crm/.senha-demo): ...
Concluído. Abra: https://203-0-113-10.sslip.io
```

Guarde a palavra-passe de demonstração (fica também no ficheiro indicado, só legível pelo administrador da VPS).

## Passo 6 — Abrir

Abra o endereço indicado no browser do PC ou do telemóvel. O certificado HTTPS pode demorar 1–2 minutos na
primeira vez.

- Entre com `consultor@demo.local` (ou outro perfil) e a palavra-passe de demonstração.
- O `admin@demo.local` pede para ativar a verificação em dois passos (manual, cap. 1.5).

---

## Atualizar para a versão mais recente

Sempre que eu publicar alterações:

```bash
cd /opt/crm && git pull && bash infra/instalar-vps.sh
```

Os dados mantêm-se (ficam em volumes Docker).

## Problemas frequentes

| Sintoma | Causa provável | O que fazer |
|---------|----------------|-------------|
| `Permission denied (publickey)` no passo 4 | Chave não autorizada no GitHub | Repetir o passo 3 com a linha completa `ssh-ed25519 …` |
| O endereço não abre | Firewall do painel da Amen | No painel da Amen, permitir as portas 80 e 443 |
| Aviso de certificado | Certificado ainda a ser emitido | Esperar 2 minutos e recarregar |

Para ver o estado ou os registos (enviar-me o resultado, se algo falhar):

```bash
cd /opt/crm && docker compose -f docker-compose.prod.yml --env-file .env.producao ps
```

```bash
cd /opt/crm && docker compose -f docker-compose.prod.yml --env-file .env.producao logs --tail 50
```

## Segurança desta instância de teste

- Contém **apenas dados fictícios**. Não introduza dados reais de clientes antes da validação da fase F5
  (backups, RGPD e aprovação formal).
- As palavras-passe internas ficam em `/opt/crm/.env.producao` (só root) e nunca vão para o GitHub.
- A base de dados não está exposta à Internet; só o Caddy (portas 80/443) está.
- O endurecimento completo da VPS (acesso SSH só por chave, atualizações automáticas, monitorização, backups
  cifrados) faz parte da fase F5-03/F5-04.
