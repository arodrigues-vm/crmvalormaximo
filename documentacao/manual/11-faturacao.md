# 11. Faturação e Comissões

Neste capítulo: **comissões** (já disponível). A faturação, os recebimentos e os estornos (F3-08) serão
acrescentados quando estiverem prontos.

## 11.1 Como o CRM calcula a comissão

A **comissão total** vem do **CMI** escolhido na transação e do **valor acordado**:

| Modalidade do CMI | Cálculo |
|-------------------|---------|
| Percentagem sobre o valor do negócio | valor acordado × taxa |
| Valor fixo | o valor fixo |
| Número de rendas (arrendamento) | n.º de rendas × renda mensal (o valor acordado da transação) |
| Percentagem sobre base contratual | não se calcula (a base está descrita em texto): indica-se à mão |

- Nunca fica abaixo da **remuneração mínima** do CMI.
- Os valores são **sem IVA**. Se o CMI diz que os valores têm IVA incluído, o CRM retira-o. O IVA e o total com
  IVA aparecem ao lado.
- O CRM guarda uma **fotografia** da base de cálculo (CMI e versão, modalidade, taxa, mínimo, IVA). Se o CMI
  mudar depois, a comissão não muda sozinha; use **Recalcular** para tirar uma nova fotografia.
- Sem CMI (por exemplo, imóvel de outra agência), a comissão fica **Por apurar** até indicar o valor. Por apurar
  não é o mesmo que zero: para «sem comissão», indique 0.

## 11.2 Os dois lados: angariação e venda

A comissão total divide-se em dois lados:

- **Angariação**: da agência que tem o imóvel;
- **Venda**: da agência que tem o comprador.

Por omissão o CRM propõe **50 % / 50 %** (pode mudar este valor em **Configurações → Parâmetros**, e em cada
comissão). Exemplo: venda de 200.000 € com 5 % → comissão total 10.000 € → 5.000 € para cada lado.

Só controlamos os lados que são **nossos**: a angariação, quando o responsável pelo imóvel é da nossa Equipa; a
venda, quando o responsável pelo comprador é da nossa Equipa; ou os dois.

## 11.3 Consultores

Em cada lado nosso, o consultor recebe de uma de duas formas:

- **Percentagem do lado** — ex.: 50 % do lado da angariação: 5.000 € × 50 % = 2.500 €;
- **Lado menos um valor fixo que fica para a agência** — ex.: 5.000 € − 450 € = 4.550 €.

O resto fica para a agência. A forma habitual de cada consultor define-se na sua ficha da **Equipa** (separador
*Comissão habitual*); o CRM propõe-a em cada comissão, onde pode ser mudada.

## 11.4 Apurar a comissão de uma transação

1. Abra a transação (capítulo 10).
2. No separador **Comissão**, carregue em **Apurar comissão**.
3. Abre-se a ficha da comissão com o cálculo, a repartição por lados e os consultores propostos.
4. Para mudar a repartição ou os consultores, carregue em **Editar repartição**, faça as alterações e
   **Guardar**. Os consultores não podem receber mais do que o lado.

![Comissão apurada](imagens/50-comissao-consulta.png)

## 11.5 Mudar o valor calculado (exceção)

O valor calculado a partir do CMI **não se edita diretamente**. Para o mudar:

1. Na ficha da comissão, carregue em **Pedir exceção ao valor**.
2. Indique o **valor proposto** e o **motivo**. Carregue em **Enviar pedido**.
3. O pedido fica **pendente**: o valor em vigor não muda até ser aprovado.
4. Outra pessoa autorizada (Administrador ou Responsável de equipa) abre a comissão e carrega em **Decidir**
   para **Aprovar** ou **Recusar** (a recusa exige motivo).

Regras: ninguém aprova o próprio pedido; quem recebe parte da comissão também não pode decidir (conflito de
interesses). Fica registado o valor original, o proposto, o final, quem pediu, quem decidiu e quando.

## 11.6 Quem pode fazer o quê

Por omissão: o **Administrador** apura e edita comissões; o **Responsável de equipa** consulta e aprova
exceções da sua equipa; o **Consultor** consulta as comissões dos seus negócios. A matriz pode ser alterada pelo
Administrador.
