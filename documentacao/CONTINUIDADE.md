# Continuidade do desenvolvimento

Estado real do repositório. Atualizar no fim de cada tarefa.

Legenda: **Implementado** → **Testado (automático)** → **Verificado pelo proprietário** → **Aceite** → **Em produção**.
Estes estados não são equivalentes.

## Fase 0 — Preparação
| Tarefa | Estado | Notas |
|--------|--------|-------|
| F0 | Concluída | Repositório novo; fontes normativas em `documentacao/fontes/`; decisões D-11 a D-17. |

## Fase 1 — Fundação
| Tarefa | Estado | Notas |
|--------|--------|-------|
| F1-01 Estrutura inicial | Implementado, testado | Django 5.2 + DRF + drf-spectacular; React 19 + TS + Vite + PWA; navegação lateral com os 23 módulos; endpoint `/api/saude/`. |
| F1-02 PostgreSQL e ambientes | Implementado, testado | `DATABASE_URL` por variável de ambiente; `.env` fora do Git; Docker Compose (db/backend/frontend); CI com PostgreSQL 16. |
| F1-03 Identidade e padrões de interação | Por fazer | Layout base feito; falta Consulta/Edição, guardas de saída, componentes de formulário. |
| F1-04 Autenticação | Por fazer | |
| F1-05 Permissões no servidor | Por fazer | |
| F1-06 Partilha, transferência, auditoria | Por fazer | |
| F1-07 Motor no-code (âmbito D-13) | Por fazer | |
| F1-08 Qualidade contínua | Parcial | CI ativo (ruff, pytest, eslint, vitest, build). |

## Limitações conhecidas
- O `docker compose` ainda não foi executado de ponta a ponta (o ambiente de desenvolvimento usado não tem Docker ativo). Backend e frontend foram testados diretamente contra PostgreSQL 16.
- Logótipo provisório («VM» em texto) até receber o ficheiro aprovado.

## Próxima tarefa
F1-03 (padrões de interação) e F1-04 (autenticação individual e sessões).
