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
| F1-04 Autenticação | Implementado, testado | Login por email (sessão Django, CSRF obrigatório incluindo no login), limite de 10 tentativas/min, mensagem genérica, recuperação por email com token (2 h), auditoria de entradas/saídas/falhas. **MFA ainda por fazer** (tarefa F1-04b). |
| F1-05 Permissões no servidor | Implementado, testado | 4 perfis; matriz perfil × módulo × operação → âmbito (nenhum/atribuídos/equipa/todos), configurável no admin; exceções por utilizador; serviço `filtrar()` e permissão DRF `PermissaoModulo` (nega por omissão). Matriz por omissão é proposta — ver DECISOES. |
| F1-06 Partilha, transferência, auditoria | Parcial | Registo de auditoria imutável criado. Partilha/transferência por fazer (precisam dos primeiros registos de negócio). |
| F1-07 Motor no-code (âmbito D-13) | Por fazer | |
| F1-08 Qualidade contínua | Parcial | CI ativo (ruff, pytest, eslint, vitest, build). |

## Limitações conhecidas
- O `docker compose` ainda não foi executado de ponta a ponta (o ambiente de desenvolvimento usado não tem Docker ativo). Backend e frontend foram testados diretamente contra PostgreSQL 16.
- Endereço IP na auditoria vem de REMOTE_ADDR; em produção, atrás do proxy, configurar o cabeçalho de IP real (F5-03).
- Logótipo provisório («VM» em texto) até receber o ficheiro aprovado.

## Utilizadores de demonstração (fictícios)
`python manage.py criar_utilizadores_demo --password <palavra-passe>` cria admin@, responsavel@, consultor@ e assistente@demo.local. Recusa-se a correr em produção.

## Próxima tarefa
F1-03 (Consulta/Edição, guardas de saída, componentes de formulário), F1-04b (MFA para Administradores) e F1-07 (motor no-code, âmbito D-13).
