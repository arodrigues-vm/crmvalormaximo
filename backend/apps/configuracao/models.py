"""Listas de valores editáveis pelo Administrador, sem programação.

Cada lista tem uma chave estável (usada pelo código) e um nome apresentado.
Os valores nunca são apagados: desativam-se, para preservar os registos que já
os usam (Especificação §37: personalização sem comprometer regras de negócio).
"""

from django.db import models
from simple_history.models import HistoricalRecords


class Lista(models.Model):
    chave = models.SlugField(max_length=60, unique=True)
    nome = models.CharField(max_length=100)
    modulo = models.CharField(max_length=40, help_text="Módulo onde a lista é usada.")
    descricao = models.CharField(max_length=255, blank=True)
    # Quando preenchido, cada valor tem de pertencer a uma destas categorias fixas, das quais
    # dependem regras da aplicação (ex.: operação venda/arrendamento). Formato: [{"valor", "nome"}].
    categorias = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["modulo", "nome"]
        verbose_name = "lista de valores"
        verbose_name_plural = "listas de valores"

    def __str__(self):
        return self.nome


class ValorLista(models.Model):
    lista = models.ForeignKey(Lista, on_delete=models.PROTECT, related_name="valores")
    nome = models.CharField(max_length=100)
    ordem = models.PositiveIntegerField(default=0)
    ativo = models.BooleanField(default=True)
    categoria = models.CharField(max_length=30, blank=True, help_text="Categoria fixa (ver Lista.categorias).")

    class Meta:
        ordering = ["lista", "ordem", "nome"]
        verbose_name = "valor de lista"
        verbose_name_plural = "valores de lista"
        constraints = [models.UniqueConstraint(fields=["lista", "nome"], name="valor_lista_unico")]

    def __str__(self):
        return self.nome


def campo_lista(chave: str, **kwargs):
    """ForeignKey para um valor de uma lista concreta."""
    kwargs.setdefault("null", True)
    kwargs.setdefault("blank", True)
    return models.ForeignKey(
        ValorLista,
        on_delete=models.PROTECT,
        related_name="+",
        limit_choices_to={"lista__chave": chave},
        **kwargs,
    )


def campo_lista_multipla(chave: str, **kwargs):
    kwargs.setdefault("blank", True)
    return models.ManyToManyField(ValorLista, related_name="+", limit_choices_to={"lista__chave": chave}, **kwargs)


class Disposicao(models.Model):
    """Disposição dos ecrãs de um módulo (D-43): ordem dos separadores, campos de cada separador e a sua
    ordem. Igual para todos os utilizadores; só o Administrador altera. Sem registo = disposição de origem.

    `blocos` = [{"chave": "comercializacao", "titulo": "Comercialização", "campos": ["operacao", ...]}, ...]
    """

    modulo = models.SlugField(max_length=40, unique=True)
    blocos = models.JSONField(default=list)
    # Nomes alterados pelo Administrador (D-44): {chave_do_campo: "novo nome"}. A chave nunca muda.
    rotulos = models.JSONField(default=dict, blank=True)
    atualizado_em = models.DateTimeField(auto_now=True)
    atualizado_por = models.ForeignKey(
        "contas.Utilizador", null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )

    historico = HistoricalRecords()

    class Meta:
        verbose_name = "disposição de ecrã"
        verbose_name_plural = "disposições de ecrã"

    def __str__(self):
        return self.modulo


class CampoPersonalizado(models.Model):
    """Campo acrescentado pelo Administrador a um ecrã (D-44), sem alterar a base de dados.

    A `chave` é estável (gerada a partir do nome na criação e nunca muda); o `nome` pode mudar à vontade.
    O tipo e o módulo relacionado não mudam depois de criado (para não invalidar valores já gravados).
    Nunca se apaga um campo com valores: desativa-se (os valores ficam guardados e voltam se o reativar).
    """

    TIPOS = [
        ("texto", "Texto"),
        ("texto_longo", "Texto longo"),
        ("inteiro", "Número inteiro"),
        ("decimal", "Número decimal"),
        ("moeda", "Valor em euros"),
        ("data", "Data"),
        ("email", "Email"),
        ("url", "Link (endereço de site)"),
        ("telefone", "Telefone"),
        ("lista", "Lista suspensa (uma opção)"),
        ("lista_multipla", "Lista suspensa (várias opções)"),
        ("sim_nao", "Sim / Não"),
        ("relacao", "Ligação a um registo de outro módulo"),
        ("relacao_multipla", "Ligação a vários registos de outro módulo"),
    ]

    ecra = models.SlugField(max_length=40, help_text="Ecrã/módulo onde o campo aparece (igual à disposição).")
    chave = models.SlugField(max_length=60)
    nome = models.CharField(max_length=80)
    tipo = models.CharField(max_length=20, choices=TIPOS)
    obrigatorio = models.BooleanField(default=False)
    ajuda = models.CharField(max_length=200, blank=True)
    ativo = models.BooleanField(default=True)
    lista = models.ForeignKey(Lista, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    modulo_relacao = models.SlugField(max_length=40, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey("contas.Utilizador", null=True, on_delete=models.PROTECT, related_name="+")

    historico = HistoricalRecords()

    class Meta:
        ordering = ["ecra", "criado_em"]
        verbose_name = "campo personalizado"
        verbose_name_plural = "campos personalizados"
        constraints = [models.UniqueConstraint(fields=["ecra", "chave"], name="campo_personalizado_unico")]

    def __str__(self):
        return f"{self.ecra}: {self.nome}"


class Parametro(models.Model):
    """Parâmetro de funcionamento editável pelo Administrador (ex.: limiares de aviso)."""

    chave = models.SlugField(max_length=60, unique=True)
    nome = models.CharField(max_length=120)
    descricao = models.CharField(max_length=255, blank=True)
    modulo = models.CharField(max_length=40)
    valor = models.JSONField()

    class Meta:
        ordering = ["modulo", "nome"]
        verbose_name = "parâmetro"
        verbose_name_plural = "parâmetros"

    def __str__(self):
        return self.nome


PARAMETROS = {
    # chave: (nome, módulo, descrição, valor inicial)
    "cmi_alertas_dias": (
        "Avisos de expiração do CMI (dias antes do fim)",
        "angariacoes",
        "Limiares de aviso; aprovados inicialmente: 120, 60 e 30 dias.",
        [120, 60, 30],
    ),
    "comissao_reparticao_angariacao": (
        "Repartição da comissão: % do lado da angariação",
        "faturacao",
        "Percentagem da comissão total que o CRM propõe para o lado da angariação (o resto é do lado da venda). "
        "Pode ser mudada em cada comissão.",
        50,
    ),
    "mfa_obrigatoria": (
        "Exigir início de sessão em dois passos aos Administradores",
        "contas",
        "Se escolher «Não», os Administradores deixam de ser obrigados a usar o código do telemóvel e podem "
        "desligá-lo na sua conta. Recomendado: «Sim».",
        True,
    ),
}


def parametro(chave: str):
    p = Parametro.objects.filter(chave=chave).values_list("valor", flat=True).first()
    return p if p is not None else PARAMETROS[chave][3]
