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
| F1-07a Listas de valores | Implementado, testado | D-23. Listas com chave estável, valores ordenáveis, renomear, desativar/reativar (sem apagar), auditoria; ecrã Configurações → Listas de valores (só Administrador); valores desativados mantêm-se nos registos e não podem ser escolhidos de novo. |
| F2-02 Imóveis | Implementado, testado | D-24. Referência IMO-, listas editáveis, operação, status, preço (NULL ≠ 0), localização administrativa/comercial/descritiva, áreas, características, zonas exteriores; proprietários com quotas (soma ≤ 100 %, proprietários sem acesso preservados e anónimos); secção na ficha da Entidade; filtros/pesquisa; versão, lixeira, histórico com nomes legíveis, auditoria. Fotografia principal (D-26): validada e re-codificada em WebP (sem EXIF/GPS), 1600 px + miniatura 480 px, armazenamento privado servido só com permissão. Operação e Status como listas com categoria (D-25). Ligações externas genéricas (qualquer módulo) para pastas OneDrive/outros. |
| F2-03 Angariações/CMI | Implementado, testado | D-27. Contrato (imóvel, n.º, operação, regime, assinatura, início original, prazo, fim calculado, fim em vigor), partes com fotografia própria (pré-preenchidas com os proprietários), remuneração por modalidade/operação, IVA, condições de pagamento; dados contratuais bloqueados após assinatura; correção material (aprovar, motivo, evidência, registo); renovações como ciclos autónomos; impedimento de sobreposição exclusiva; estados derivados; avisos 120/60/30 configuráveis (Parâmetros); concluir/cancelar/reabrir; ligações; histórico/auditoria; secção no imóvel. **Ligação ao Plano de Marketing (F4-03/F4-04) por fazer.** |
| F1-07b Parâmetros | Implementado, testado | Configurações → Parâmetros (limiares de aviso do CMI), validação e auditoria. |
| F3-01 Oportunidades e Procuras | Implementado, testado | D-32, D-33 (procura: «O cliente pretende: Comprar/Arrendar» em vez de operação). Oportunidades (proprietário, imóvel existente ou provisório, estado, qualificação, origem, motivação, preço, prazo, conversão expressa e idempotente em imóvel/CMI). Procuras (interessado, operação, estado, urgência, qualificação, orçamento + tolerância, critérios com importância, localização por concelho/freguesia/zona). Interações genéricas (diário de contactos). Secções na ficha da entidade. |
| Alterações 17/11 (D-34) | Parcial | **Feito e testado:** listas suspensas de escolha múltipla; Entidades (Tipo de cliente, Status em lista, quem recomendou, imóvel de contacto, visitou/porquê, dados pessoais, entidades relacionadas com aniversário); pesquisa de imóveis por palavras; CMI sem data de assinatura, data fim de contrato única, sinal mínimo e momento do pagamento; Oportunidades e Procuras com qualificação completa (Excel), prazos em texto, URL do anúncio, sem «qualificação inicial/completa». **Falta:** campos do Excel «Dados Imoveis» e «Imoveis» no Imóvel/CMI e reorganização dos separadores (proposta enviada ao proprietário: fase de angariação, cores dos alertas, Valor ACM/vendido/comissão); atualizar capturas do manual. |
