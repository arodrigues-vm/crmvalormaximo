# Especificação — Módulo «Apoio à Angariação»

Versão 0.1 (proposta) · 25/11/2026 · **Por aprovar** (decisões D-40, secção 9)

## 1. Objetivo

Levar para dentro do CRM o método das duas formações (Angariação imobiliária; Ultrapassar objeções com PNL),
de forma a que o consultor:

1. tenha o **guião certo** no momento do contacto, já preenchido com os dados do proprietário e do imóvel;
2. **registe o resultado** de cada contacto em poucos toques, com data, objeção ouvida e próximo passo;
3. prepare e conduza a **reunião de angariação** com a checklist, guardando o que foi feito;
4. **treine** (perguntas, simulações, ensaio de objeções);
5. veja **estatísticas** do funil e das objeções a partir dos registos reais.

O conteúdo (textos) é **dados**, editável na aplicação por quem tiver permissão, nunca fixo no código.

## 2. Princípios que vêm das formações e se traduzem em regras do módulo

| Princípio | Consequência no CRM |
|-----------|--------------------|
| O 1.º contacto serve para marcar a reunião, não para angariar | O registo de contacto tem «Reunião marcada» como resultado principal e pede data/hora. |
| «Não quero imobiliária» resolve-se em duas etapas | Resultado «Recusou — deixar porta aberta» sugere um próximo contacto (prazo por omissão configurável; as gravações usam 30 dias). |
| Angariação reativa: quando há comprador, ligar a quem recusou | Cruzamento Procuras ↔ oportunidades recusadas (secção 5.4). |
| Confirmar a visita no turno anterior | Lembrete automático quando a Agenda existir (F4-02). |
| Medir: contactos → visitas ao imóvel → contratos; mínimos 20 % e 30 % | Estatísticas com rácios e limiares configuráveis (Parâmetros). |
| Medir a origem das angariações | Usa a origem já existente na Oportunidade. |
| Dias até à venda, como argumento verdadeiro | Calculado (início do CMI → proposta aceite/transação), nunca escrito à mão. |
| Só prometer o que se faz | O catálogo de serviços apresentado na reunião é configurável (decisão D-40 e). |
| Técnicas que implicam mentira ficam separadas | Origem «Não recomendado»: nunca sugerida automaticamente (secção 4.3). |

## 3. Ligação aos módulos existentes

O módulo **não duplica** registos: usa os que existem.

| Módulo existente | Como é usado |
|------------------|--------------|
| Entidades (F2-01) | Proprietário/comprador do contacto; nome e tratamento nos campos variáveis; **oposição a marketing** bloqueia sugestões de contacto proativo. |
| Oportunidades (F3-01) | É o «cartão» de cada proprietário em angariação. Os contactos e a reunião registam-se a partir da ficha. Usa os campos existentes: estado (Contacto, Pré-angariação, ACM apresentado, Pendente, Angariado, Cancelado), origem, preço pretendido, motivo da venda, como chegou ao valor, objeções, porque não aceitou. |
| Interações (core.Interacao) | **Cada contacto continua a ser uma Interação** (diário imutável, com anulação auditada). O módulo acrescenta dados estruturados ligados a ela (secção 5.2), sem alterar o seu comportamento. |
| Procuras e correspondências (F3-01/F3-02) | Fonte dos compradores para a angariação reativa. |
| Imóveis e CMI (F2-02/F2-03) | A reunião pode terminar em CMI (criado como hoje, a partir do imóvel). O CMI dá o início para «dias até à venda» e para o indicador de preço (secção 5.6). |
| Visitas e Propostas (F3-03/F3-04) | Contagem real de visitas e propostas por imóvel para o «alvo de ajuste de preço». |
| Agentes e Agências (F2-05) | Agência própria fornece denominação e **licença AMI** para as cartas e mensagens. |
| Tarefas e Agenda (F4-01/F4-02, por fazer) | Os «próximos contactos» passam a tarefas/compromissos quando estes módulos existirem. Até lá, ficam numa lista própria (secção 5.3). |
| Estatísticas (F4-06, por fazer) | Os indicadores da secção 6 entram no Dashboard quando existir; até lá, um ecrã simples no módulo. |
| Parâmetros (F1-07b) | Prazos e limiares do módulo (secção 7). |

## 4. Conteúdos (biblioteca)

### 4.1 Modelos de dados propostos (app Django `angariacao_apoio`)

Todos com `RegistoBase` (versão, histórico, auditoria) quando editáveis; desativar em vez de apagar (D-23).

- **Guiao** — título, categoria (lista `categorias_guiao`), quando usar, origem (lista com categoria fixa, ver 4.2),
  fontes (lista `fontes_formacao`, múltipla), texto de carta, se recusar, pontos-chave (lista de textos),
  cuidado, alternativa honesta, ativo, ordem.
- **PassoGuiao** — guião, ordem, tipo (fala/nota), texto.
- **Objecao** — o que o cliente diz, momento (lista `momentos_objecao`: Telefone, Reunião, Comprador), origem, fontes,
  resposta, porque funciona, nota, próximo passo, cuidado, guião relacionado (opcional), ativo, ordem.
- **PassoObjecao** — objeção, ordem, texto.
- **CaminhoObjecao** — objeção, causa, nota; com **PassoCaminho** (ordem, texto).
- **FaseChecklist** — nome, descrição, ordem, ativo; **ItemChecklist** — fase, texto, detalhe, fonte, ordem, ativo.
- **PerguntaTreino** — situação, opções (lista ordenada), índice da certa, explicação, fonte, ativo.
- **SimulacaoTreino** — título, introdução, árvore em JSON validado no servidor (estrutura de `treino_simulacoes.json`).
- **Principio** — grupo (comunicação PNL / prospeção e serviço / não aplicar), título, texto, fontes, ativo, ordem.

As listas novas ficam em `listas_sistema.py` com os valores iniciais de `dados/fontes.json`.

### 4.2 Origem do conteúdo (lista com categoria fixa, como D-25)

Categorias: `formacao`, `adaptacao`, `proposta_complementar`, `nao_recomendado`, `texto_proprio`.
Rótulos editáveis; a categoria não muda depois de criada, porque tem comportamento (4.3).

### 4.3 Regras para conteúdo «Não recomendado»

- Mostrado só na categoria «Consultar com cuidado», com etiqueta vermelha, **Riscos** e **Alternativa honesta** visíveis.
- Nunca sugerido no fluxo «Contactar» nem nas sugestões automáticas.
- Não pode ser marcado como usado num registo de contacto (o servidor recusa).

### 4.4 Campos variáveis nos textos

`{proprietario}`, `{tipologia}`, `{zona}`, `{urbanizacao}`, `{preco}`, `{hora1}`, `{hora2}`, `{dia}`, `{meuNome}`, `{agencia}`, `{ami}`, `{telefone}`.

| Campo | Origem no CRM |
|-------|---------------|
| `{proprietario}` | Entidade da oportunidade (nome; tratamento «Senhor/Senhora Dona» conforme a ficha — decisão D-40 f). |
| `{tipologia}`, `{zona}`, `{preco}` | Imóvel ligado, ou campos provisórios da oportunidade; `{preco}` = preço pretendido formatado (NULL → «[preço]»). |
| `{urbanizacao}` | Localização comercial/descritiva do imóvel, se existir. |
| `{hora1}`, `{hora2}`, `{dia}` | Escolhidos no ecrã no momento (não gravados). |
| `{meuNome}`, `{telefone}` | Utilizador / agente ligado ao utilizador. |
| `{agencia}`, `{ami}` | Agência do tipo *Própria* (denominação e licença AMI). |

A substituição faz-se no cliente só para apresentação; os textos guardados ficam com os campos.
Campo sem valor aparece como `[nome do campo]` (nunca vazio, para não enviar uma carta incompleta sem se notar).

### 4.5 Importação inicial

Comando `importar_conteudos_angariacao <pasta>`: lê os JSON de `dados/`, **idempotente** (usa o `id` dos JSON como
chave externa estável; voltar a correr não duplica nem apaga edições feitas na aplicação — só cria o que falta,
salvo opção `--repor` com confirmação). Testes com os ficheiros reais.

### 4.6 Edição na aplicação

- Ecrã de edição como no protótipo: passos com subir/descer, acrescentar/remover, caminhos por causa, itens da checklist.
- Botão «Repor original» para conteúdo importado (guardar o texto original importado).
- Permissões: por omissão, Administrador e Responsável editam; Consultor e Assistente consultam (D-40 c).

## 5. Fluxos ligados aos registos

### 5.1 «Contactar» na ficha da Oportunidade (e da Entidade)

1. Botão **Contactar** → escolhe o guião (sugere os de origem ≠ «Não recomendado», filtrados pelo estado da oportunidade:
   em *Contacto* sugere o 1.º contacto; com recusa anterior sugere o 2.º telefonema; etc. — tabela configurável, D-40 d).
2. O guião aparece preenchido com os dados (4.4), com **Copiar** e ações de contacto existentes (Ligar/WhatsApp/Email, F1-03, sem envio).
3. No fim, **registar o resultado** (secção 5.2) — um ecrã, poucos toques.

### 5.2 Registo de contacto estruturado

Novo modelo **RegistoContactoAngariacao**, ligado 1:1 a uma `core.Interacao` (criada no mesmo passo, atómico):

- guião usado (opcional), canal (lista existente `tipos_interacao`),
- **resultado** (lista com categoria fixa `resultados_contacto`: `reuniao_marcada`, `recusou`, `ligar_mais_tarde`,
  `sem_resposta`, `nao_esta_a_venda`, `ja_vendido`; rótulos editáveis),
- objeções ouvidas (múltipla, ligadas à biblioteca) e **causa** quando houver caminhos (ex.: «quer rapidez»),
- data/hora da reunião marcada (se resultado = reunião), **próximo contacto** (data) e nota.

Regras (servidor): reunião marcada exige data/hora futura; anular a Interação anula o registo; oposição a marketing
na entidade impede próximo contacto proativo (aviso e recusa, salvo contacto pedido pelo cliente).
Opcional (D-40 g): resultado «reunião marcada» passa a oportunidade de *Contacto* para *Pré-angariação* — **sugerido, não automático**, por coerência com D-32 f.

### 5.3 Próximos contactos (até existir a Agenda)

Lista «Contactos a fazer» (hoje, atrasados, próximos 7 dias) a partir dos registos 5.2, respeitando as permissões
das oportunidades. Quando F4-01/F4-02 existirem, cada próximo contacto passa a ser uma Tarefa/compromisso
(a origem continua a ser a fonte de verdade, como manda o capítulo 17 da especificação).

### 5.4 Angariação reativa (comprador sem imóvel)

Na ficha da **Procura**, ação «Procurar proprietários que recusaram»: lista oportunidades em estado de categoria
«perdida» ou com último resultado `recusou`, compatíveis com a procura (tipologia, localização, preço pretendido
dentro do valor de aquisição previsto + tolerância). Reutilizar a lógica de `procuras/correspondencias.py` onde for
possível; os campos provisórios da oportunidade (tipologia, localidade) entram como «por confirmar».
Da lista abre-se o guião «Segundo telefonema» já preenchido com a história do comprador (sem identificar o comprador).

### 5.5 Reunião de angariação

Novo modelo **ReuniaoAngariacao** ligado à Oportunidade (e ao imóvel, se existir):

- data/hora, participantes (entidades: proprietários e decisores — o método pede que estejam todos),
- **checklist em fotografia**: ao criar, copia as fases e itens ativos (texto incluído) e guarda marcado/não marcado;
  mudanças posteriores na biblioteca não alteram reuniões passadas (mesmo princípio das propostas, AT-11),
- regime pretendido pelo proprietário, objeções ouvidas e causa, resultado (lista com categoria: `acordo_exclusivo`,
  `acordo_nao_exclusivo`, `nova_reuniao`, `recusou`), CMI ligado quando existir.

O CMI continua a criar-se na ficha do imóvel (D-35 d). A reunião só **liga** ao CMI criado.

### 5.6 Ferramentas de preço

- **Alvo de ajuste de preço** na ficha do CMI/imóvel, calculado com dados reais desde o início do CMI:
  n.º de visitas *Realizadas* e de propostas. Faixas e percentagens nos Parâmetros (valores das gravações:
  muitas visitas sem propostas ≈ 5 %; poucas ≈ 5–8 %; nenhuma ≈ 10–12 %; «muitas/poucas» definidas por limiares). Só indicação, nunca altera o preço.
- **Tempo até ao valor pedido**: valor de mercado (ex.: valor ACM do CMI), preço pedido e valorização anual (parâmetro
  editável, com fonte indicada pelo utilizador) → meses = ln(pedido/mercado) / ln(1+taxa) × 12. Cálculo no servidor, `Decimal`.

## 6. Estatísticas (até F4-06; depois integram o Dashboard)

Por período, consultor (respeitando âmbitos), origem e zona:

- contactos registados; reuniões marcadas; reuniões realizadas; acordos (exclusivo / não exclusivo);
- **rácios** contacto→reunião e reunião→acordo, com aviso abaixo dos mínimos (parâmetros, por omissão 20 % e 30 %);
- objeções mais ouvidas e % das reuniões com essa objeção que terminaram em acordo;
- guiões mais usados e taxa de reunião marcada por guião;
- dias desde o início do CMI até à proposta aceite (média, por consultor);
- carteira face à meta de exclusivos residenciais (meta configurável; as gravações usam 10).

Sem projeções apresentadas como resultados; métricas calculadas no servidor.

## 7. Parâmetros novos (Configurações → Parâmetros)

| Chave | Valor inicial | Uso |
|-------|---------------|-----|
| `angariacao_dias_recontacto` | 30 | Próximo contacto sugerido após «recusou». |
| `angariacao_racio_min_reuniao` | 20 | % mínima contacto → reunião. |
| `angariacao_racio_min_acordo` | 30 | % mínima reunião → acordo. |
| `angariacao_meta_exclusivos` | 10 | Meta de carteira. |
| `preco_alvo_faixas` | ver 5.6 | Limiares de visitas e % sugeridas. |
| `preco_valorizacao_anual` | vazio | Sem valor por omissão: o utilizador indica a taxa e a fonte. |

## 8. Fases de implementação

| Fase | Conteúdo | Depende de |
|------|----------|------------|
| A | Modelos 4.1, listas, importação 4.5, ecrãs Biblioteca (guiões, objeções, princípios) e Treino, edição 4.6, permissões | — |
| B | Contactar + registo estruturado 5.1–5.2, lista de próximos contactos 5.3 | A |
| C | Reunião de angariação 5.5 com checklist em fotografia | A |
| D | Angariação reativa 5.4; ferramentas de preço 5.6 | B, C |
| E | Estatísticas 6 | B, C |
| F | Integração com Tarefas/Agenda (lembretes: recontacto, confirmação no turno anterior, pós-escritura 8/30 dias e aniversário) | F4-01, F4-02, F3-05 |

Cada fase: testes (pytest + vitest), capítulo do manual (`documentacao/manual/`), atualização de `CONTINUIDADE.md`.

### Testes mínimos

- Importação idempotente; reimportar não altera conteúdo editado; `--repor` só com confirmação.
- Conteúdo «Não recomendado» nunca devolvido nas sugestões e recusado num registo de contacto.
- Registo de contacto atómico com a Interação; anulação em cascata controlada; reunião marcada exige data futura.
- Oposição a marketing impede próximo contacto proativo.
- Checklist da reunião em fotografia: editar a biblioteca não altera reuniões passadas.
- Permissões por âmbito em todas as listas e estatísticas (Consultor vê só os seus, D-18).
- Cálculos de rácios e de «tempo até ao valor pedido» com `Decimal` e casos-limite (zero contactos, preço ≤ mercado).

## 9. Decisões a aprovar pelo proprietário (D-40)

| | Questão | Recomendação |
|---|---------|--------------|
| a | Nome do módulo no menu | «Apoio à Angariação», com separadores Guiões, Objeções, Reunião, Treino, Método. |
| b | Novo módulo no menu (M23) ou dentro de Oportunidades | Módulo próprio para a biblioteca e treino; ações «Contactar» e «Reunião» dentro das Oportunidades. |
| c | Quem edita os textos | Administrador e Responsável de Equipa; Consultor e Assistente só consultam. |
| d | Sugestão automática de guião por estado da oportunidade | Sim, com tabela configurável; o consultor pode sempre escolher outro. |
| e | Catálogo de serviços apresentado na reunião (análise de concorrência, SWOT, relatório, home staging, fotografia, vídeo, plano de marketing…) | Lista configurável com «disponível sim/não»; a checklist só mostra os disponíveis (não prometer o que não se faz). |
| f | Tratamento nos guiões («Senhor/Senhora Dona») | Campo opcional na Entidade «forma de tratamento» (lista configurável); sem ele usa só o nome. |
| g | «Reunião marcada» muda o estado da oportunidade | Não automaticamente: o CRM sugere e o consultor confirma (coerente com D-32 f). |
| h | Conteúdo «Não recomendado» no CRM | Manter, só para consulta, com riscos e alternativa (como no protótipo); retirável desativando-o. |
| i | Ordem face ao plano atual | Fases A–C a seguir à F3-05 (Transações), antes de F4-01; ou já, se o proprietário der prioridade. |

## 10. Fora do âmbito

Envio automático de mensagens/cartas (F4-07/F4-08 tratam envios); gravação ou análise de chamadas; IA a gerar
respostas (pode estudar-se depois); importar o conteúdo editado no protótipo (os JSON desta pasta são a fonte).
