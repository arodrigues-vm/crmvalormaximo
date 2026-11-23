# 8. Visitas e Interesses

As **visitas** registam quando um cliente vai ver um imóvel e o que achou. Os **interesses** registam que um
cliente está interessado num imóvel, mesmo sem o ter visitado, e guardam o acompanhamento até ele decidir.
Referências: VIS-000001 (visitas) e INT-000001 (interesses).

## 8.1 Lista de visitas

Abra **Visitas** no menu. No topo pode escolher entre **Visitas** e **Interesses**.

- **Próximas:** visitas de hoje em diante, da mais próxima para a mais distante.
- **Realizadas** e **Todas:** da mais recente para a mais antiga.
- Pode pesquisar pelo cliente, pela referência ou localidade do imóvel e filtrar pelo estado.

## 8.2 Agendar uma visita

A forma mais rápida é a partir da ficha do imóvel (ou da entidade): secção **Visitas e interessados** →
**+ Agendar visita**. O imóvel (ou o cliente) já vem preenchido. Também pode usar **+ Nova visita** na lista.

1. Em **O imóvel está registado no CRM?**:
   - **Sim:** escolha o **imóvel** (pode escrever várias palavras, por exemplo «10 T3 Maia»);
   - **Não** (imóvel angariado por um agente externo ou da rede): escreva uma **descrição** curta (por exemplo
     «Moradia T4 com piscina») e uma **localização** breve (por exemplo «junto à praia de Matosinhos»). Não é
     preciso registar o imóvel.
2. Escolha o **cliente**. Quando não tem os dados do comprador (por exemplo, cliente de um agente externo),
   use uma entidade genérica, como «Cliente externo».
3. Indique o **agente responsável pelo comprador** e o **agente responsável pelo imóvel** (obrigatórios). Ambos
   têm de estar registados em **Agentes** (capítulo 18); se faltar algum, registe-o primeiro em **Agentes**.
4. Indique a **data** e, se quiser, a **hora de entrada** e a **hora de saída**.
5. Se forem mais pessoas, acrescente-as em **Acompanhantes**.
6. Carregue em **Guardar**. A visita fica *Agendada*.

Para **reagendar**, edite a visita e mude a data: a data anterior fica no histórico.

## 8.3 Estados

*Agendada*, *Confirmada*, *Realizada*, *Cancelada* e *Não compareceu* (lista editável pelo Administrador). Uma
visita com data futura não pode ficar *Realizada*. Se a visita não aconteceu, use *Cancelada* ou *Não
compareceu* em vez de a eliminar.

## 8.4 Ficha de visita (avaliação do cliente)

Depois da visita, edite-a, mude o estado para **Realizada** e preencha a secção **Avaliação do cliente**:

1. Para cada ponto — localização/zona, infraestruturas/serviços, qualidade de construção, acabamentos, áreas,
   planta, vista, estacionamento e preço — escolha de *Muito mau* a *Muito bom*.
2. Escreva **o que mais gostou** e **o que menos gostou** e, no fim, indique se **compraria este imóvel**.
3. Carregue em **Guardar**.

## 8.5 Interesses

Quando agenda uma visita a um **imóvel registado** com um cliente **acompanhado pela nossa agência** (o agente
do comprador é um utilizador do CRM ou pertence a uma agência do tipo *Própria*), o CRM cria automaticamente o
**interesse** desse cliente nesse imóvel (com origem *Visita*), se ainda não existir. Visitas a imóveis não
registados ou com clientes de agentes externos/da rede não criam interesses. Há só um interesse por cliente e imóvel. Quando a visita fica *Realizada*, o
interesse mostra a data da **última visita**. Visitas canceladas ou faltas não criam interesse.

Também pode registar um interesse à mão — por exemplo, quando um cliente telefona a perguntar por um imóvel —
em **Visitas → Interesses → + Novo interesse**, ou na ficha do imóvel ou da entidade.

Na ficha do interesse:
- indique a **origem**, o **grau de interesse** (*Muito baixo* a *Muito alto*) e o **estado** (*Ativo*, *Em
  negociação*, *Desistiu*, *Concluído*);
- veja todas as visitas desse cliente a esse imóvel;
- registe os **acompanhamentos** (chamadas, emails, reuniões…) em **+ Registar contacto**;
- carregue em **+ Agendar visita** para marcar nova visita.

## 8.6 Nas fichas do imóvel e da entidade

A secção **Visitas e interessados** (no imóvel) ou **Visitas e interesses** (na entidade) mostra as últimas
visitas e interesses, com botões para agendar uma visita ou registar um interesse.

## 8.7 Quem pode fazer o quê

As visitas e os interesses seguem as permissões do módulo **Visitas** (por exemplo, o Consultor vê as suas e
as partilhadas). Só pode marcar visitas para clientes e imóveis a que tem acesso.

## 8.8 Gerar uma proposta

Numa visita *Realizada*, o botão **Gerar Proposta** abre uma proposta pré-preenchida (capítulo 9).
