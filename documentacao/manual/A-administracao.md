# A. Administração

Esta parte destina-se ao **Administrador**.

## A.1 Listas de valores

Todas as listas suspensas da aplicação (tipos de imóvel, tipologias, estados de comercialização, papéis de
entidade, origens de contacto, zonas comerciais, …) editam-se em **Configurações → Listas de valores**, sem
qualquer programação.

![Listas de valores](imagens/20-configuracoes-listas.png)

1. Escolha a lista à esquerda (agrupadas por módulo; o número indica os valores ativos).
2. Para **acrescentar**, escreva o novo valor em *Novo valor* e carregue em **+ Adicionar**.
3. Para **mudar o nome**, carregue em **Renomear**, altere e carregue em **Guardar**. O novo nome passa a
   aparecer em todos os registos que já usavam esse valor.
4. Para **mudar a ordem** em que aparecem nas listas suspensas, use as setas **↑** e **↓**.
5. Para **deixar de usar** um valor, carregue em **Desativar**.

**Porque não há «Apagar»?** Para não estragar registos antigos. Um valor desativado:
- deixa de aparecer nas listas para novos registos;
- continua a aparecer nos registos que já o tinham (e pode ser mantido ao editá-los);
- pode ser **reativado** a qualquer momento.

Todas as alterações às listas ficam registadas na auditoria.

> **Status** dos imóveis (Ativo, Inativo, Arquivado) e **Operação** (Venda, Arrendamento) não são listas
> editáveis, porque deles dependem regras da aplicação (por exemplo, o cálculo de comissões de venda e de
> arrendamento é diferente).
