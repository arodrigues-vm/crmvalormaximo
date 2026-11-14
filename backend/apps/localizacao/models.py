"""Divisão administrativa portuguesa segundo a CAOP (Carta Administrativa Oficial de Portugal).

Os dados são carregados a partir dos ficheiros oficiais com o comando
`importar_caop`; nada é inventado no código. Os códigos DICO/DICOFRE são
preservados como identificadores estáveis.
"""

from django.db import models


class Distrito(models.Model):
    codigo = models.CharField("código (DI)", max_length=2, unique=True)
    nome = models.CharField(max_length=80)
    regiao_autonoma = models.BooleanField(default=False)

    class Meta:
        ordering = ["nome"]
        verbose_name = "distrito / região autónoma"
        verbose_name_plural = "distritos / regiões autónomas"

    def __str__(self):
        return self.nome


class Concelho(models.Model):
    codigo = models.CharField("código (DICO)", max_length=4, unique=True)
    nome = models.CharField(max_length=80)
    distrito = models.ForeignKey(Distrito, on_delete=models.PROTECT, related_name="concelhos")

    class Meta:
        ordering = ["nome"]
        verbose_name = "concelho"
        verbose_name_plural = "concelhos"

    def __str__(self):
        return self.nome


class Freguesia(models.Model):
    codigo = models.CharField("código (DICOFRE)", max_length=6, unique=True)
    nome = models.CharField(max_length=200)
    concelho = models.ForeignKey(Concelho, on_delete=models.PROTECT, related_name="freguesias")
    ativa = models.BooleanField(
        default=True, help_text="Freguesias extintas mantêm-se para preservar registos históricos."
    )

    class Meta:
        ordering = ["nome"]
        verbose_name = "freguesia"
        verbose_name_plural = "freguesias"

    def __str__(self):
        return f"{self.nome} ({self.concelho.nome})"
