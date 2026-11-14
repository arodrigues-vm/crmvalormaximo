"""Campos de serializer para valores de listas configuráveis."""

from rest_framework import serializers

from .models import ValorLista


class CampoValorLista(serializers.PrimaryKeyRelatedField):
    """Aceita um valor da lista indicada. Valores desativados só são aceites se o
    registo já os tinha (para não obrigar a mudar dados antigos ao editar outra coisa)."""

    def __init__(self, chave: str, **kwargs):
        self.chave = chave
        kwargs.setdefault("queryset", ValorLista.objects.filter(lista__chave=chave))
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        valor = super().to_internal_value(data)
        if not valor.ativo and valor.pk not in self._valores_atuais():
            raise serializers.ValidationError(f"«{valor.nome}» está desativado.")
        return valor

    def _valores_atuais(self) -> set[int]:
        instancia = getattr(self.root, "instance", None)
        if instancia is None:
            return set()
        if isinstance(self.parent, serializers.ManyRelatedField):
            return set(getattr(instancia, self.parent.source).values_list("pk", flat=True))
        return {getattr(instancia, f"{self.source}_id", None)}


def opcoes_lista(chave: str) -> list[dict]:
    return list(ValorLista.objects.filter(lista__chave=chave, ativo=True).values("id", "nome"))
