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
| D-19 | 14/11/2026 | **MFA obrigatória para Administradores** (proposta técnica aplicada, sugestão 12); disponível para os restantes perfis. Lista de perfis configurável. |
| D-20 | 14/11/2026 | **Logótipo aprovado** recebido (`marca/logotipo-valor-maximo-original.webp`). Na interface usa-se o mesmo logótipo com o fundo removido, para assentar no azul-marinho; ícones da aplicação a partir do monograma VM (recorte, sem redesenho). |
| D-21 | 14/11/2026 | **Manual de utilizador escrito à medida** que cada módulo fica pronto (`documentacao/manual/`), com revisão e versão final (PDF) no fim. |
| D-22 | 14/11/2026 | **Relações entre entidades** (requisito novo do proprietário): tipos configuráveis, com nome direto e inverso; iniciais: Cônjuge, Familiar, Sócio de / Tem como sócio, Gerente de / Tem como gerente. A relação aparece nas duas fichas; respeita as permissões das duas pontas. |
| D-23 | 14/11/2026 | **Todas as listas suspensas são editáveis na aplicação** (Configurações → Listas de valores), sem código; valores desativam-se, não se apagam. Inclui papéis e origens das Entidades. Exceções (regras de negócio): Operação e Status. |
| D-24 | 14/11/2026 | Imóveis: «Fase comercial» passa a **Status** (Ativo, Inativo, Arquivado); «Estado comercial» passa a **Estado de comercialização** (lista editável). Listas iniciais aprovadas: tipos, tipologias, estados, condições físicas, zonas exteriores, áreas (m²); acrescentadas classes de certificado energético e zonas comerciais (vazia). |
| D-25 | 14/11/2026 | **Operação e Status também são listas configuráveis.** Para preservar as regras de negócio, cada valor tem uma categoria fixa escolhida ao criar (operação: venda/arrendamento; status: ativo/inativo/arquivado) que não muda depois. |
| D-26 | 14/11/2026 | **Ficheiros:** cada imóvel guarda **uma** fotografia principal no CRM (identificação). As restantes fotografias e **todos os documentos** ficam no OneDrive ou noutro serviço, registados no CRM como **ligações externas** (tipo, título, endereço). Substitui o armazenamento privado de documentos previsto em §21 da especificação (versões, descarregamento privado): o controlo de acesso aos ficheiros passa a ser feito no serviço externo. |
| D-27 | 14/11/2026 | **CMI — regras confirmadas pelo proprietário (14/11/2026), exceto (e), substituída por D-28:** (a) fim = início + prazo em meses − 1 dia; (b) regime como lista com categoria Exclusivo/Não exclusivo; um CMI **exclusivo** impede outro CMI em curso **sobreposto** no mesmo imóvel e na mesma categoria de operação (não exclusivos podem coexistir); (c) modalidades de remuneração por operação — venda: percentagem ou valor fixo; arrendamento: n.º de rendas, valor fixo ou percentagem sobre base contratual identificada; (d) situação: em curso / concluída / cancelada, reabrir exige aprovação; (e) correção material e reabertura exigem a operação «aprovar» (Responsável/Administrador); (f) renovação começa depois do fim do ciclo atual. |
| D-28 | 14/11/2026 | **CMI: correção excecional e reabertura** podem ser feitas por **quem pode editar o CMI** (incluindo o Consultor responsável), sempre com motivo (e evidência na correção) e registo na auditoria. |
| D-29 | 14/11/2026 | **Instância de teste na VPS Amen** (dados fictícios) para as verificações intermédias; acesso por SSH a partir do PC do proprietário. |
| D-30 | 14/11/2026 | **Comunicação com o proprietário:** não é técnico; linguagem simples e instruções passo a passo (registado em CLAUDE.md). |
| D-31 | 14/11/2026 | A VPS já serve outros sites (alexandre/certificados/ferramentas.valormaximo.pt, incluindo a versão antiga do Codex) com **nginx**: o CRM fica **ao lado**, em **crm.valormaximo.pt**, com o nginx a tratar do HTTPS (ficheiro próprio, validado antes de aplicar) e o CRM só acessível internamente (127.0.0.1:8090). Os outros sites não são alterados. |

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

- Ficheiro «Tabelas Completo.xlsx» (inventário histórico de campos, Q09) — necessário na F2-06.
