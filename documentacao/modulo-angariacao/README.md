# Módulo «Apoio à Angariação» — pacote de entrega

Este pasta reúne tudo o que foi preparado fora do CRM (numa sessão própria) para integrar no CRM
o **Assistente de Angariação**: guiões, respostas a objeções, checklist da reunião de angariação e treino,
construídos a partir de duas formações gravadas (Angariação imobiliária e Ultrapassar objeções com PNL).

**Estado: proposta para aprovação.** Nada disto está implementado no CRM. As decisões em aberto estão
em `ESPECIFICACAO.md`, secção 9 (D-40, a aprovar pelo proprietário antes de começar).

## Para o proprietário (em linguagem simples)

1. Esta pasta não muda nada no CRM que já funciona: só acrescenta documentos.
2. Quando quiser avançar, abra a sessão do Claude Code do CRM e escreva:
   «Lê a pasta `documentacao/modulo-angariacao` e apresenta-me as decisões D-40 para aprovar.»
3. Depois de aprovar as decisões, peça: «Implementa a Fase A do módulo de apoio à angariação.»
   As fases seguintes pedem-se uma a uma, como nos outros módulos.
4. Para ver como a ferramenta funciona hoje, abra o ficheiro `prototipo/assistente-angariacao.html`
   no navegador (duplo clique depois de o descarregar). É só uma referência: os textos que editar
   aí não passam para o CRM.

## Para o agente que vai implementar

Leia por esta ordem:

1. `ESPECIFICACAO.md` — o que construir, como ligar aos módulos existentes, fases e testes.
2. `dados/*.json` — o conteúdo a importar (fonte única dos textos; não copiar textos do protótipo).
3. `prototipo/assistente-angariacao.html` — referência de ecrãs, interação e tom. Não é para reutilizar o
   código: o CRM usa React + TypeScript e componentes próprios (F1-03).
4. `notas/` — resumo das 15 gravações por sessão, para verificar a origem de cada técnica.
   Os nomes dos participantes foram retirados.

Regras do `CLAUDE.md` do repositório que se aplicam aqui com especial atenção:

- As decisões do proprietário (`DECISOES.md`) prevalecem sobre esta especificação.
- Listas de escolha sempre configuráveis (D-34), regras e permissões no servidor, testes em cada alteração,
  manual atualizado quando a funcionalidade ficar visível, `CONTINUIDADE.md` atualizado no fim.
- **Conteúdo «Não recomendado»** (categoria «Consultar com cuidado»): manter sempre separado, com a etiqueta,
  os riscos e a alternativa honesta visíveis; nunca o sugerir automaticamente num fluxo de contacto.
- Matérias jurídicas e fiscais referidas nas notas são opiniões do formador: não as transformar em regras
  do CRM sem confirmação do proprietário (ver CLAUDE.md: «não inventar regras de negócio, fiscais ou prazos legais»).

## Conteúdo da pasta

| Ficheiro | O que é |
|----------|---------|
| `ESPECIFICACAO.md` | Especificação funcional e técnica, ligação aos módulos existentes, fases, testes, decisões D-40. |
| `dados/fontes.json` | Gravações de origem, categorias de origem, campos variáveis dos textos. |
| `dados/guioes.json` | 38 guiões (telefone, presencial, cartas, mensagens, redes, fidelização, compradores e 9 «Consultar com cuidado»). |
| `dados/objecoes.json` | 24 objeções com resposta, passos, caminhos por causa, porque funciona e cuidados. |
| `dados/checklist_reuniao.json` | 7 fases e 60 itens da reunião de angariação. |
| `dados/treino_perguntas.json` | 25 perguntas de situação com explicação. |
| `dados/treino_simulacoes.json` | 5 simulações de conversa em árvore. |
| `dados/principios.json` | Princípios de comunicação (PNL), de prospeção e pontos a não aplicar. |
| `prototipo/assistente-angariacao.html` | A ferramenta atual, como referência visual. |
| `notas/notas-formacao-angariacao.md` | Notas das 7 gravações da formação de angariação. |
| `notas/notas-formacao-pnl.md` | Notas das 8 gravações da formação de objeções com PNL. |
