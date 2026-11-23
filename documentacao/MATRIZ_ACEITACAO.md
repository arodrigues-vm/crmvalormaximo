# Matriz de aceitação AT-01 a AT-16

Critérios completos: Especificação V1.4 §16 (em `fontes/`). Estados: Pendente / Aprovado (testes automáticos) / Reprovado / Aceite (proprietário).

| ID | Cenário | Tarefas | Testes automáticos | Estado |
|----|---------|---------|--------------------|--------|
| AT-01 | Sessões, perfis e APIs | F1-04/05; F5-02 | `contas/tests/test_autenticacao.py`, `test_permissoes.py` (parcial: falta anexos/exportações) | Em curso |
| AT-02 | Partilha e transferência | F1-05/06 | `test_permissoes.py::TestFiltrar` (âmbitos; falta partilha/transferência) | Em curso |
| AT-03 | Registos e vistas | F1-03; F2-04 | `entidades.test.tsx` (Consulta→Editar, guarda de saída, erros por bloco); falta Cartões/Kanban (F2-04) | Em curso |
| AT-04 | CMI original e renovação | F2-03; F4-04 | `angariacoes/tests/test_api.py` (data original estável, correção material, ciclos de renovação); falta escolha de ciclo de marketing (F4-04) | Em curso |
| AT-05 | Plano de marketing 45 | F4-03 | — | Pendente |
| AT-06 | Dashboard e finanças | F3-08; F4-06 | — | Pendente |
| AT-07 | Pagamentos e estornos | F3-07/08 | — | Pendente |
| AT-08 | Proposta a partir de Visita | F3-04 | `apps/propostas/tests/test_api.py` (prévia sem gravar, participantes pré-preenchidos, confirmação, duplicados, acesso) | Aprovado (testes automáticos) |
| AT-09 | Transação e estados | F3-05/06 | — | Pendente |
| AT-10 | Match Imóvel/Procura | F3-02 | `procuras/tests/test_correspondencias.py` (teto 250 000 € + 20% = 300 000 €, exclusão acima, obrigatórios excluem, preferenciais ordenam e explicam) | Aprovado (testes automáticos) |
| AT-11 | Participantes históricos | F2-02; F3-05/09 | Propostas: `test_gerar_proposta_da_visita_sem_duplicados` (fotografia dos participantes) — falta Transações | Em curso |
| AT-12 | Importação Excel/Outlook | F2-07; F5-01 | — | Pendente |
| AT-13 | Configuração no-code | F1-07; F2-05/06; F5-05 | `configuracao/tests.py` (listas: adicionar, renomear, desativar, ordenar, categorias fixas) | Em curso |
| AT-14 | Brevo e WhatsApp | F4-07/08 | — | Pendente |
| AT-15 | VPS e segurança | F5-02/03 | — | Pendente |
| AT-16 | Backup e aprovação | F5-04/06 | — | Pendente |
