from rest_framework import serializers

from apps.configuracao.campos import CampoValorLista
from apps.contas.models import Utilizador
from apps.entidades.models import Entidade
from apps.imoveis.models import Imovel

from .models import Compromisso


class CompromissoSerializer(serializers.ModelSerializer):
    tipo = CampoValorLista("tipos_compromisso", allow_null=True, required=False)
    tipo_nome = serializers.CharField(source="tipo.nome", read_only=True, default=None)
    estado_nome = serializers.CharField(source="estado.nome", read_only=True, default=None)
    estado_categoria = serializers.CharField(source="estado.categoria", read_only=True, default=None)
    entidade = serializers.PrimaryKeyRelatedField(queryset=Entidade.objects.ativos(), allow_null=True, required=False)
    entidade_nome = serializers.SerializerMethodField()
    imovel = serializers.PrimaryKeyRelatedField(queryset=Imovel.objects.ativos(), allow_null=True, required=False)
    imovel_descricao = serializers.SerializerMethodField()
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Compromisso
        fields = [
            "id", "referencia", "titulo", "tipo", "tipo_nome", "inicio", "fim", "local", "descricao", "estado",
            "estado_nome", "estado_categoria", "motivo_estado", "entidade", "entidade_nome", "imovel",
            "imovel_descricao", "responsavel", "responsavel_nome", "criado_em", "atualizado_em", "versao",
            "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = ["referencia", "estado", "motivo_estado", "criado_em", "atualizado_em", "eliminado_em"]

    def _visivel(self, chave, pk):
        return pk in self.context.get(chave, set())

    def get_entidade_nome(self, c) -> str | None:
        if not c.entidade_id:
            return None
        return c.entidade.nome_completo if self._visivel("entidades_visiveis", c.entidade_id) else "Entidade sem acesso"

    def get_imovel_descricao(self, c) -> str | None:
        if not c.imovel_id:
            return None
        if not self._visivel("imoveis_visiveis", c.imovel_id):
            return "Imóvel sem acesso"
        from apps.propostas.serializers import descricao_imovel

        return descricao_imovel(c)

    def get_acoes(self, c) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(c.pk, {})

    def validate_titulo(self, v):
        v = v.strip()
        if not v:
            raise serializers.ValidationError("Indique o título.")
        return v

    def validate_entidade(self, e):
        if (
            e
            and not (self.instance and self.instance.entidade_id == e.pk)
            and not self._visivel("entidades_visiveis", e.pk)
        ):
            raise serializers.ValidationError("Entidade inexistente ou sem acesso.")
        return e

    def validate_imovel(self, i):
        if (
            i
            and not (self.instance and self.instance.imovel_id == i.pk)
            and not self._visivel("imoveis_visiveis", i.pk)
        ):
            raise serializers.ValidationError("Imóvel inexistente ou sem acesso.")
        return i

    def validate(self, d):
        inicio = d.get("inicio", getattr(self.instance, "inicio", None))
        fim = d.get("fim", getattr(self.instance, "fim", None))
        if inicio and fim and fim < inicio:
            raise serializers.ValidationError({"fim": "O fim não pode ser antes do início."})
        return d

    def create(self, d):
        from apps.tarefas.servicos import valor_categoria

        d.pop("versao", None)
        return Compromisso.objects.create(**d, estado=valor_categoria("estados_compromisso", "agendado"))

    def update(self, c, d):
        d.pop("versao", None)
        for k, v in d.items():
            setattr(c, k, v)
        c.save()
        return c


class MudarEstadoCompromissoSerializer(serializers.Serializer):
    estado = CampoValorLista("estados_compromisso")
    motivo = serializers.CharField(required=False, allow_blank=True, default="")


class DispensarAvisoSerializer(serializers.Serializer):
    chave = serializers.CharField(max_length=80)
