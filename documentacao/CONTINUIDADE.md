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
| F1-03 Identidade e padrões de interação | Implementado, testado | Componentes reutilizáveis: Bloco expansível (abre com erros), campos com erro por campo, seleção múltipla explícita, diálogo, guarda de saída (navegação + fecho do separador), paginação, ações de contacto (Ligar/WhatsApp/Email sem envio), seletor de telefone internacional, seletor CAOP dependente. Router de dados (React Router). |
| F1-04 Autenticação | Implementado, testado | Login por email (sessão Django, CSRF obrigatório incluindo no login), limite de 10 tentativas/min, mensagem genérica, recuperação por email com token (2 h), auditoria de entradas/saídas/falhas. MFA concluída (F1-04b). |
| F1-04b MFA | Implementado, testado | TOTP (Google/Microsoft Authenticator) obrigatório para Administrador (configurável: `CRM_MFA_PERFIS_OBRIGATORIOS`); segredo cifrado; anti-reutilização de códigos; 10 códigos de recuperação de uso único; até configurar, a API e o admin ficam bloqueados; o Administrador pode repor o MFA de um utilizador no admin. Mudar a `DJANGO_SECRET_KEY` invalida as configurações MFA. |
| F1-05 Permissões no servidor | Implementado, testado | 4 perfis; matriz perfil × módulo × operação → âmbito (nenhum/atribuídos/equipa/todos), configurável no admin; exceções por utilizador; serviço `filtrar()` e permissão DRF `PermissaoModulo` (nega por omissão). Matriz por omissão é proposta — ver DECISOES. |
| F1-06 Partilha, transferência, auditoria | Parcial | Registo de auditoria imutável criado. Partilha/transferência por fazer (precisam dos primeiros registos de negócio). |
| F1-07 Motor no-code (âmbito D-13) | Por fazer | |
| F1-08 Qualidade contínua | Parcial | CI ativo (ruff, pytest, eslint, vitest, build). |

## Fase 2 — Núcleo CRM
| Tarefa | Estado | Notas |
|--------|--------|-------|
| F2-01 Entidades | Implementado, testado | Pessoa singular/coletiva, NIF/NIPC validado (PT), telefones múltiplos E.164 com país, email, morada FT-01 + freguesia CAOP, papéis (6 da especificação, configuráveis), origem (configurável, nenhuma instalada), responsável, partilhas, RGPD (consentimento com data, oposição). Pesquisa sem acentos; deteção de duplicados (NIF/email/telefone bloqueiam com confirmação; nome semelhante só avisa; sem revelar dados de registos não acessíveis). Controlo de versão (409), lixeira e restauro, histórico (simple-history) e auditoria com campos alterados, transferência de responsável só com permissão e âmbito. |
| F2-01c Relações entre entidades | Implementado, testado | D-22. Tipos configuráveis (direto/inverso, simétricos), sem auto-relação nem duplicados (também ao contrário nos simétricos), exige acesso às duas entidades, entidade sem acesso aparece anónima, auditoria e histórico. Seletor pesquisável reutilizável (teclado e toque). |
| F2-01b Catálogo CAOP2025 | Parcial | Modelos, API e comando `importar_caop` prontos e testados. **Faltam os dados oficiais**: os sites da DGT/dados.gov.pt estão bloqueados neste ambiente. |

## Limitações conhecidas
- O `docker compose` ainda não foi executado de ponta a ponta (o ambiente de desenvolvimento usado não tem Docker ativo). Backend e frontend foram testados diretamente contra PostgreSQL 16.
- Endereço IP na auditoria vem de REMOTE_ADDR; em produção, atrás do proxy, configurar o cabeçalho de IP real (F5-03).

## Manual de utilizador
Capítulos 1 (Entrar, sair e segurança) e 3 (Entidades) escritos. Ver `documentacao/manual/README.md`.

## Utilizadores de demonstração (fictícios)
`python manage.py criar_utilizadores_demo --password <palavra-passe>` cria admin@, responsavel@, consultor@ e assistente@demo.local. Recusa-se a correr em produção. `python manage.py criar_entidades_demo` cria 8 entidades fictícias.

## Próxima tarefa
F2-02 Imóveis (coproprietários e quotas) e F2-03 Angariações/CMI. Em paralelo: carregar a CAOP2025; F1-06 (interface de partilha/transferência); F1-07 (motor no-code, âmbito D-13).
