"""Listas de valores editáveis pelo Administrador, sem programação.

Cada lista tem uma chave estável (usada pelo código) e um nome apresentado.
Os valores nunca são apagados: desativam-se, para preservar os registos que já
os usam (Especificação §37: personalização sem comprometer regras de negócio).
"""

from django.db import models


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
