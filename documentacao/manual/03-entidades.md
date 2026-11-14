# 3. Entidades

As **Entidades** são as pessoas e empresas com quem trabalha: proprietários, compradores, vendedores,
arrendatários, senhorios, contactos profissionais, etc. Cada pessoa existe **uma só vez** no CRM, mesmo que
tenha vários papéis (por exemplo, é proprietária de um imóvel e compradora de outro).

> O papel comercial de uma entidade não lhe dá qualquer acesso à aplicação.

## 3.1 Lista de entidades

Abra **Entidades** no menu lateral.

![Lista de entidades](imagens/10-entidades-lista.png)

- **Pesquisa:** escreva parte do nome, NIF, email, telefone ou a referência (ENT-…). A pesquisa ignora
  acentos e maiúsculas: «jose» encontra «José».
- **Filtros:** papel, tipo de pessoa (singular/coletiva) e estado (ativa/inativa).
- **Ordenar:** por nome, mais recentes ou referência.
- Clique numa linha para abrir a ficha.

Só vê as entidades a que o seu perfil dá acesso (por exemplo, o Consultor vê as suas e as que lhe foram
partilhadas; o Responsável de Equipa vê as da equipa).

No telemóvel, a lista aparece em cartões:

![Lista no telemóvel](imagens/16-entidades-telemovel.png)

## 3.2 Criar uma entidade

1. Na lista, carregue em **+ Nova entidade**.
2. Escolha o **tipo de pessoa**. Para empresas, escolha *Pessoa coletiva*: o campo passa a chamar-se
   *Denominação social* e não há apelido nem data de nascimento.
3. Preencha os dados. Só o **nome** é obrigatório.
4. Carregue em **Guardar**.

A referência (ENT-000001, ENT-000002, …) é atribuída automaticamente e nunca muda. Fica como responsável
quem cria a entidade.

### Telefones

- O país começa em **Portugal (+351)**; pode escolher outro país na lista.
- Escreva o número sem o indicativo (por exemplo, 912 345 678). A aplicação valida-o para o país escolhido.
- Pode ter vários telefones; marque um como **Principal**.
- Para acrescentar, carregue em **+ Adicionar telefone**; para remover, em **✕**.

### NIF/NIPC

O NIF português é validado (9 dígitos e dígito de controlo). Para contribuintes estrangeiros, altere o
**País fiscal** (ES, FR, …): nesse caso o número não é validado.

### Possíveis duplicados

Enquanto preenche, a aplicação procura entidades parecidas e mostra-as num aviso amarelo:

![Aviso de possíveis duplicados](imagens/11-entidade-nova-duplicado.png)

Se tentar guardar uma entidade com o **mesmo NIF, email ou telefone** de outra já existente, a aplicação pede
confirmação:

![Confirmação de duplicado](imagens/12-entidade-dialogo-duplicado.png)

- Abra a entidade indicada para confirmar se é a mesma pessoa. Se for, **não crie outra**: use a existente.
- Se tiver a certeza de que são pessoas diferentes, carregue em **Gravar mesmo assim** (fica registado).
- Se a outra entidade pertencer a um colega, verá apenas que existe um registo semelhante, sem os dados.
  Fale com o Responsável de Equipa.

Nomes parecidos só geram um aviso; não impedem a gravação.

## 3.3 Consultar uma entidade

A ficha abre sempre em **modo de consulta**:

![Ficha de consulta](imagens/13-entidade-consulta.png)

- Junto de cada telefone tem **Ligar** e **WhatsApp**; junto do email, **Email**. Estes botões apenas abrem
  a aplicação respetiva: **não enviam mensagens** nem as registam como enviadas.
- As secções abrem e fecham com um clique no título. *Proteção de dados*, *Observações* e *Histórico*
  começam fechadas.
- **Histórico:** mostra quem criou e alterou a entidade, quando, e o que mudou (valor antigo → novo).

## 3.4 Editar

1. Na ficha, carregue em **Editar** (canto superior direito).
2. Altere os dados e carregue em **Guardar**. Volta à ficha de consulta.

![Edição](imagens/14-entidade-edicao.png)

- Se houver um erro, a secção correspondente abre-se automaticamente e o campo fica assinalado a vermelho:

  ![Erro de validação](imagens/15-entidade-erro-nif.png)

- Se tentar sair com alterações por guardar, a aplicação pergunta se quer mesmo sair.
- Se outra pessoa alterar a mesma entidade enquanto está a editar, ao guardar aparece a mensagem *«Esta
  entidade foi alterada por outra pessoa entretanto»*. Recarregue a ficha e volte a fazer as suas alterações;
  assim nenhuma alteração é perdida sem aviso.

## 3.5 Proteção de dados (RGPD)

Na secção **Proteção de dados** registe:

- **Consentimento de marketing:** *Desconhecido / não recolhido* (valor inicial), *Concedido* ou *Recusado*.
  Se for *Concedido*, indique a **data** em que foi obtido.
- **Oposição a marketing:** se a pessoa se opôs, marque esta opção. Prevalece sobre qualquer consentimento.

Criar ou importar um contacto **não** significa que a pessoa deu consentimento.

## 3.6 Eliminar e restaurar

- Na ficha, **Eliminar** envia a entidade para a **lixeira**. Nada é apagado definitivamente.
- Um utilizador autorizado (por omissão, o Responsável de Equipa ou o Administrador) pode **restaurá-la**.
- Se a entidade deixou apenas de estar ativa (por exemplo, já não é cliente), prefira desmarcar
  **Entidade ativa** em vez de a eliminar.

## 3.7 Quem pode fazer o quê

| Ação | Administrador | Responsável de Equipa | Consultor | Assistente |
|------|:---:|:---:|:---:|:---:|
| Consultar | Todas | Da equipa | As suas e partilhadas | Atribuídas e partilhadas |
| Criar / editar | Sim | Sim (equipa) | Sim (as suas) | Sim (atribuídas) |
| Eliminar (lixeira) | Sim | Sim (equipa) | Sim (as suas) | Não |
| Restaurar | Sim | Sim (equipa) | Não | Não |
| Mudar o responsável | Sim | Dentro da equipa | Não | Não |

O Administrador pode ajustar estas permissões.
