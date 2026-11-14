# Registo de decisões

As decisões D-01 a D-10, Q01 a Q16 e V01 a V04 da Especificação V1.4 mantêm-se em vigor
(ver `fontes/`). Este ficheiro regista as decisões tomadas a partir de 14/11/2026.

| Ref. | Data | Decisão |
|------|------|---------|
| D-11 | 14/11/2026 | **Desenvolvimento de raiz (Modo A)** num repositório novo `arodrigues-vm/crmvalormaximo`. A implementação anterior (Codex) não é reutilizada. |
| D-12 | 14/11/2026 | Commits e push autorizados no ramo `desenvolvimento`. O ramo `main` só é alterado com aprovação do proprietário. |
| D-13 | 14/11/2026 | **Âmbito V1 do motor no-code:** campos personalizados, rótulos, ordem, secções, colunas, filtros e vistas configuráveis. A **criação de módulos novos** passa para a V2. |
| D-14 | 14/11/2026 | **Ordem:** motor de automações e Marketing de Entidades são implementados depois do núcleo comercial e financeiro (Fase 3). |
| D-15 | 14/11/2026 | **Verificações intermédias** pelo proprietário (~30 min) no fim da Fase 2 e da Fase 3, além da avaliação funcional final. |
| D-16 | 14/11/2026 | VPS Amen X2 (2 GB) mantém-se; upgrade só se as medições o justificarem. Por isso: fila de tarefas sobre PostgreSQL (sem Redis). |
| D-17 | 14/11/2026 | Ambiente de desenvolvimento e produção em **Docker Compose**; testes automáticos no **GitHub Actions**. |
| D-18 | 14/11/2026 | **Consultor vê só os seus registos** (atribuídos ou partilhados), não os da equipa. Confirma a matriz por omissão. |

## Decisões técnicas propostas (aplicadas salvo indicação em contrário)

- Núcleo de negócio em modelos Django tipados; campos personalizados numa camada JSONB com metadados.
- Tipos TypeScript gerados a partir do esquema OpenAPI (drf-spectacular).
- Pesquisa insensível a acentos com `unaccent` + `pg_trgm` do PostgreSQL.
- Backups com `restic`/`rclone` para OneDrive (a validar na F5-04).
- Catálogo das 45 tarefas: designação original preservada + nome de apresentação opcional (a confirmar).

## Matriz de permissões por omissão (alterável no admin)

| Perfil | Módulos comerciais | Faturação | Equipa/Agentes/Agências/Glossário | Configurações |
|--------|--------------------|-----------|-----------------------------------|---------------|
| Administrador | Tudo, todos os registos | Tudo | Tudo | Tudo |
| Responsável de Equipa | Tudo (exceto administrar) sobre registos da equipa, incluindo partilhar/transferir | Consultar, aprovar e exportar (equipa) | Consultar; criar/editar Agentes, Agências e Glossário | Sem acesso |
| Consultor | Consultar, criar, editar, eliminar e exportar os seus registos; sem partilhar/transferir/aprovar | Consultar os seus | Consultar | Sem acesso |
| Assistente | Consultar, criar e editar registos atribuídos/partilhados | Sem acesso | Consultar | Sem acesso |

Confirmada pela decisão D-18.

## Pendentes do proprietário

- Ficheiro do logótipo aprovado (VM dourado sobre azul-marinho). Até lá é usado um marcador provisório.
- Ficheiro «Tabelas Completo.xlsx» (inventário histórico de campos, Q09) — necessário na F2-06.
