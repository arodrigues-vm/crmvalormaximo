# Instruções para agentes — CRM Valor Máximo

Responder sempre em **português de Portugal**.

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

## Comandos
- Backend: `cd backend && .venv/bin/pytest`
- Frontend: `cd frontend && npm test`
- Ambiente completo: `docker compose up --build`
