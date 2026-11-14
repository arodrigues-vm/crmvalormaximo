# Instalação na VPS Amen (instância de teste)

Guia passo a passo para instalar o CRM Valor Máximo na VPS (Ubuntu 24.04) com **dados fictícios**, para as
verificações intermédias. Demora cerca de 15 minutos. Não é preciso colar palavras-passe em lado nenhum: o
script gera-as na própria VPS.

O resultado é o endereço **https://crm.valormaximo.pt**, com HTTPS verdadeiro (certificado Let's Encrypt),
a funcionar ao lado dos sites que já existem na VPS.

---

## Passo 1 — Entrar na VPS

No PC, abra o **PowerShell** (tecla Windows → escreva *PowerShell* → Enter) e escreva, trocando pelo IP da
VPS e pelo utilizador que a Amen lhe deu:

```bash
ssh root@IP_DA_VPS
```

Na primeira vez pergunta *«Are you sure you want to continue connecting?»*: escreva `yes`. Depois a
palavra-passe (não aparece enquanto escreve; é normal).

> **Não entre como administrador para os passos 2 a 4.** Use o seu utilizador normal (ex.: `arodrigues`):
> a chave do GitHub fica guardada nesse utilizador. Só a instalação (passo 5) usa `sudo`.

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

De volta à VPS, crie a pasta (como administrador) e entregue-a ao seu utilizador. Troque `arodrigues` pelo
seu utilizador, se for outro:

```bash
sudo mkdir -p /opt/crm
```

```bash
sudo chown "$USER":"$USER" /opt/crm
```

```bash
git clone -b desenvolvimento git@github.com:arodrigues-vm/crmvalormaximo.git /opt/crm
```

Se perguntar *«Are you sure you want to continue connecting?»*, escreva `yes`.

## Passo 5 — Criar o endereço crm.valormaximo.pt (registo DNS)

A VPS já tem outros sites (por exemplo `alexandre.valormaximo.pt`), servidos pelo **nginx**. O CRM fica ao
lado deles, com o endereço próprio **crm.valormaximo.pt**, sem mexer nos outros sites.

Para isso, o endereço tem de "apontar" para a VPS:

1. Entre na **área de cliente da Amen** e abra o domínio **valormaximo.pt** → **Gestão de DNS** (ou *Zona DNS*).
2. Veja o registo do tipo **A** com o nome `alexandre` e anote o **IP** (é o IP da VPS).
3. Carregue em **Adicionar registo** e preencha:
   - **Tipo:** A
   - **Nome:** `crm`
   - **Valor / Destino:** o mesmo IP do ponto 2
   - **TTL:** deixe o valor proposto
4. Grave e espere **15 a 30 minutos**.

Para confirmar, na VPS escreva:

```bash
getent hosts crm.valormaximo.pt
```

Deve aparecer o IP da VPS. Se não aparecer nada, espere mais um pouco e repita.

## Passo 6 — Instalar

```bash
cd /opt/crm && git pull
```

```bash
sudo bash /opt/crm/infra/instalar-vps.sh --demo --nginx --dominio crm.valormaximo.pt
```

O que acontece:
- prepara o Docker, a firewall e as palavras-passe internas;
- compila e arranca o CRM (a primeira vez demora 5–10 minutos);
- cria **um ficheiro novo** no nginx só para `crm.valormaximo.pt` e pede o certificado HTTPS gratuito.
  Antes de aplicar, verifica sempre a configuração; se algo estiver errado, desfaz a alteração e os outros
  sites continuam como estavam;
- cria os utilizadores de demonstração.

No fim mostra:

```
Utilizadores: admin@demo.local, responsavel@demo.local, consultor@demo.local, assistente@demo.local
Palavra-passe (guardada em /opt/crm/.senha-demo): ...
Concluído. Abra: https://crm.valormaximo.pt
```

Guarde a palavra-passe de demonstração.

> Se aparecer *«O endereço crm.valormaximo.pt ainda não aponta para esta VPS»*, o passo 5 ainda não está
> ativo: espere e volte a correr o mesmo comando.

## Passo 7 — Abrir

Abra **https://crm.valormaximo.pt** no computador ou no telemóvel.

- Entre com `consultor@demo.local` (ou outro perfil) e a palavra-passe de demonstração.
- O `admin@demo.local` pede para ativar a verificação em dois passos (manual, cap. 1.5).

---

## Atualizar para a versão mais recente

Sempre que eu publicar alterações:

```bash
cd /opt/crm && git pull && sudo bash infra/instalar-vps.sh
```

(As opções `--nginx --dominio crm.valormaximo.pt` ficam guardadas; não é preciso repeti-las.)

Os dados mantêm-se (ficam em volumes Docker).

## Problemas frequentes

| Sintoma | Causa provável | O que fazer |
|---------|----------------|-------------|
| `could not create work tree dir '/opt/crm': Permission denied` | Pasta criada sem `sudo` | Fazer os dois comandos `sudo mkdir` e `sudo chown` do passo 4 |
| `Permission denied (publickey)` no passo 4 | Chave não autorizada no GitHub | Repetir o passo 3 com a linha completa `ssh-ed25519 …` |
| *«ainda não aponta para esta VPS»* | Registo DNS ainda não ativo | Esperar 15–30 min (passo 5) e repetir |
| O endereço não abre | Firewall do painel da Amen | No painel da Amen, permitir as portas 80 e 443 |
| Aviso de certificado | Certificado ainda a ser emitido | Esperar 2 minutos e recarregar |

Para ver o estado ou os registos (enviar-me o resultado, se algo falhar):

```bash
cd /opt/crm && sudo docker compose -f docker-compose.prod.yml --env-file .env.producao ps
```

```bash
cd /opt/crm && sudo docker compose -f docker-compose.prod.yml --env-file .env.producao logs --tail 50
```

## Segurança desta instância de teste

- Contém **apenas dados fictícios**. Não introduza dados reais de clientes antes da validação da fase F5
  (backups, RGPD e aprovação formal).
- As palavras-passe internas ficam em `/opt/crm/.env.producao` (só root) e nunca vão para o GitHub.
- A base de dados não está exposta à Internet; só o Caddy (portas 80/443) está.
- O endurecimento completo da VPS (acesso SSH só por chave, atualizações automáticas, monitorização, backups
  cifrados) faz parte da fase F5-03/F5-04.
