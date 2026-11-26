from rest_framework import serializers

from apps.angariacoes.models import Angariacao
from apps.tarefas.serializers import TarefaListaSerializer

from .models import PedidoRecalculo, PlanoMarketing
from .servicos import indicadores


class PedidoRecalculoSerializer(serializers.ModelSerializer):
    pedido_por_nome = serializers.CharField(source="pedido_por.nome", read_only=True)
    decidido_por_nome = serializers.CharField(source="decidido_por.nome", read_only=True, default=None)

    class Meta:
        model = PedidoRecalculo
        fields = [
            "id", "data_base_anterior", "data_base_nova", "motivo", "pedido_por", "pedido_por_nome", "pedido_em",
            "estado", "decidido_por_nome", "decidido_em", "motivo_decisao",
        ]  # fmt: skip
        read_only_fields = fields


class PlanoListaSerializer(serializers.ModelSerializer):
    imovel_descricao = serializers.SerializerMethodField()
    angariacao_referencia = serializers.CharField(source="angariacao.referencia", read_only=True)
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)
    indicadores = serializers.SerializerMethodField()

    class Meta:
        model = PlanoMarketing
        fields = [
            "id", "referencia", "imovel", "imovel_descricao", "angariacao", "angariacao_referencia", "ciclo",
            "data_base", "ativo", "responsavel", "responsavel_nome", "indicadores", "criado_em",
        ]  # fmt: skip

    def get_imovel_descricao(self, p) -> str:
        from apps.configuracao.personalizados import titulo_registo

        return titulo_registo(p.imovel)

    def _tarefas(self, p):
        cache = self.context.setdefault("_tarefas", {})
        if p.pk not in cache:
            cache[p.pk] = list(p.tarefas.filter(eliminado_em__isnull=True).select_related("estado", "responsavel",
                                                                                          "prioridade"))  # fmt: skip
        return cache[p.pk]

    def get_indicadores(self, p) -> dict:
        return indicadores(self._tarefas(p))


class PlanoSerializer(PlanoListaSerializer):
    ocorrencias = serializers.SerializerMethodField()
    # Data de que o plano depende (início do CMI ou da renovação), para detetar correções (recálculo).
    angariacao_data_inicio = serializers.SerializerMethodField()
    pedido_pendente = serializers.SerializerMethodField()
    pedidos = PedidoRecalculoSerializer(source="pedidos_recalculo", many=True, read_only=True)
    plano_anterior_referencia = serializers.CharField(source="plano_anterior.referencia", read_only=True, default=None)
    ciclos_seguintes = serializers.SerializerMethodField()
    renovacao_data_inicio = serializers.DateField(source="renovacao.data_inicio", read_only=True, default=None)
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = PlanoMarketing
        fields = [
            *PlanoListaSerializer.Meta.fields, "ocorrencias", "angariacao_data_inicio", "pedido_pendente", "pedidos",
            "plano_anterior", "plano_anterior_referencia", "ciclos_seguintes", "renovacao", "renovacao_data_inicio",
            "origem_ciclo", "destino_pendentes",
            "observacoes", "atualizado_em", "versao", "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = [f for f in fields if f not in ("observacoes", "versao", "responsavel")]
        validators = []  # a unicidade (um plano por ciclo de CMI) é garantida na criação, com bloqueio

    def get_ocorrencias(self, p) -> list[dict]:
        ts = sorted(self._tarefas(p), key=lambda t: t.mk_numero or 0)
        return TarefaListaSerializer(ts, many=True, context=self.context).data

    def get_angariacao_data_inicio(self, p):
        from .servicos import data_base_origem

        d = data_base_origem(p)
        return d.isoformat() if d else None

    def get_ciclos_seguintes(self, p) -> list[dict]:
        return [{"id": x.pk, "referencia": x.referencia, "ciclo": x.ciclo}
                for x in p.ciclos_seguintes.filter(eliminado_em__isnull=True)]  # fmt: skip

    def get_pedido_pendente(self, p) -> dict | None:
        x = p.pedidos_recalculo.filter(estado=PedidoRecalculo.Estado.PENDENTE).first()
        return PedidoRecalculoSerializer(x).data if x else None

    def get_acoes(self, p) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(p.pk, {})

    def update(self, p, d):
        d.pop("versao", None)
        for k, v in d.items():
            setattr(p, k, v)
        p.save()
        return p


class CriarPlanoSerializer(serializers.Serializer):
    angariacao = serializers.PrimaryKeyRelatedField(queryset=Angariacao.objects.ativos())
    excluidos = serializers.ListField(child=serializers.IntegerField(min_value=1, max_value=45), required=False,
                                      default=list)  # fmt: skip


class NovoCicloSerializer(CriarPlanoSerializer):
    origem = serializers.ChoiceField(choices=["catalogo", "anterior"])
    destino = serializers.ChoiceField(choices=["manter", "encerrar"])


class IncluirSerializer(serializers.Serializer):
    tarefa = serializers.IntegerField()
    incluida = serializers.BooleanField()


class PedirRecalculoSerializer(serializers.Serializer):
    motivo = serializers.CharField()


class DecidirRecalculoSerializer(serializers.Serializer):
    aprovar = serializers.BooleanField()
    motivo = serializers.CharField(required=False, allow_blank=True, default="")
