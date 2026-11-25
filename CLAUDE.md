# Instruções para agentes — CRM Valor Máximo

Responder sempre em **português de Portugal**.

## Sobre o proprietário (importante)
- **Não é técnico e não conhece programação.** Usar sempre linguagem simples e clara, sem jargão (ou
  explicá-lo numa frase), e dar indicações **passo a passo**, numeradas, um comando de cada vez.
- Antes de pedir para correr um comando, dizer o que ele faz e o que se espera ver.
- Nunca pedir para alterar ou desligar algo no servidor sem primeiro confirmar o que é.

## Servidor (VPS Amen)
- Ubuntu 24.04, utilizador `arodrigues` (não root; usa `sudo`). Repositório em `/opt/crm`.
- A VPS **já tem o nginx** (portas 80/443) a servir alexandre.valormaximo.pt, certificados.valormaximo.pt e
  ferramentas.valormaximo.pt (inclui a versão antiga do CRM feita com o Codex). **Não alterar esses sites.**
- O CRM fica em **crm.valormaximo.pt** atrás desse nginx (D-31): `infra/instalar-vps.sh --nginx --dominio …`.
- Domínio da empresa: **valormaximo.pt** (DNS na Amen).

## Fontes normativas (por ordem)
1. Decisões do proprietário registadas em `documentacao/DECISOES.md` (prevalecem).
2. Especificação V1.4 e Plano V1.0, transcritos em `documentacao/fontes/CRM_Valor_Maximo_Prompt_Mestre_Integral.txt`.
3. `documentacao/CONTINUIDADE.md` — estado real do desenvolvimento.
4. `documentacao/MATRIZ_ACEITACAO.md` — AT-01 a AT-16.

Não inventar regras de negócio, fiscais ou prazos legais. Em ambiguidade, apresentar opções com recomendação.

## Regras de execução
- Trabalhar no ramo `desenvolvimento`. Commits e push para este ramo estão autorizados; **nunca** alterar `main` sem aprovação.
- Nunca colocar segredos, dados reais de clientes ou credenciais no Git. Só dados fictícios.
- Toda a autorização, validação de estados e cálculo financeiro é feita no servidor (Django). O React nunca é fonte de verdade.
- Valores monetários: `Decimal`/`NUMERIC`, nunca `float`. Distinguir "desconhecido" (NULL) de "zero confirmado".
- Datas: `USE_TZ=True`, referência `Europe/Lisbon`; datas civis como `DateField`.
- Operações críticas atómicas e idempotentes; histórico e auditoria preservados; sem eliminação em cascata silenciosa.
- Ações que criam registos a partir de outros (Gerar Proposta, Gerar Transação, Criar plano) exigem ação expressa e confirmação.
- Cada alteração vem com testes. Antes de enviar: `ruff check`, `ruff format --check`, `pytest` (backend); `npm run lint`, `npm test`, `npm run build` (frontend).
- No fim de cada tarefa, atualizar `documentacao/CONTINUIDADE.md` e, se aplicável, a matriz de aceitação.
- Quando uma funcionalidade visível ao utilizador fica pronta, escrever/atualizar o capítulo respetivo do
  manual em `documentacao/manual/` (linguagem simples, passos numerados, capturas com dados fictícios).
- **Campos de escolha (D-34):** sempre **listas suspensas** (também as de escolha múltipla, com o componente
  `CampoMultiplo`), e as opções vêm **sempre de listas configuráveis** (`campo_lista`/`ValorLista`), nunca
  fixas no código — em todos os módulos, existentes e futuros.
- **Tudo o que se cria pode ser editado (D-42):** em todos os módulos, existentes e futuros, cada registo e
  sub-registo (linhas, rondas, renovações, contactos, ligações, nomes de equipas, valores de listas…) tem forma
  de ser corrigido no ecrã. A edição guarda sempre o valor anterior (histórico ou auditoria) e respeita as
  regras de negócio e as permissões. Exceção: os próprios registos de auditoria/histórico, que não se alteram.
- **Disposição configurável (D-43):** em todos os módulos, existentes e futuros, os campos dos formulários e das
  fichas são desenhados pela disposição configurável (`BlocosConfiguraveis` + `DefinicaoEcra` do módulo, registada
  em `modulos/configuracoes/ecras.ts`), para o Administrador poder mudar a ordem dos separadores, o separador de
  cada campo e a sua posição. A consulta segue a mesma disposição da edição.
- Identidade visual: usar apenas o logótipo aprovado (`documentacao/marca/`); nunca o redesenhar.

## Comandos
- Backend: `cd backend && .venv/bin/pytest`
- Frontend: `cd frontend && npm test`
- Ambiente completo: `docker compose up --build`
