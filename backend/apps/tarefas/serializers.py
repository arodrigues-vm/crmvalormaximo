from django.utils import timezone
from rest_framework import serializers

from apps.configuracao.campos import CampoValorLista
from apps.contas.models import Utilizador
from apps.transacoes.models import Transacao

from .models import ModeloTarefa, Tarefa


class ModeloTarefaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModeloTarefa
        fields = ["id", "nome", "descricao", "dias_apos", "ativo", "ordem"]
        read_only_fields = ["id"]

    def validate_nome(self, v):
        v = v.strip()
        if not v:
            raise serializers.ValidationError("Indique o nome da tarefa.")
        return v


class TarefaListaSerializer(serializers.ModelSerializer):
    estado_nome = serializers.CharField(source="estado.nome", read_only=True, default=None)
    estado_categoria = serializers.CharField(source="estado.categoria", read_only=True, default=None)
    prioridade_nome = serializers.CharField(source="prioridade.nome", read_only=True, default=None)
    transacao_referencia = serializers.CharField(source="transacao.referencia", read_only=True, default=None)
    cliente_nome = serializers.SerializerMethodField()
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)
    atrasada = serializers.SerializerMethodField()

    class Meta:
        model = Tarefa
        fields = [
            "id", "referencia", "titulo", "estado", "estado_nome", "estado_categoria", "prioridade_nome", "prazo",
            "atrasada", "transacao", "transacao_referencia", "cliente_nome", "responsavel_nome", "criado_em",
        ]  # fmt: skip

    def get_cliente_nome(self, t) -> str | None:
        if not t.transacao_id:
            return None
        e = t.transacao.entidade
        return e.nome_completo if e.pk in self.context.get("entidades_visiveis", set()) else None

    def get_atrasada(self, t) -> bool:
        aberta = t.estado is None or t.estado.categoria in ("aberta", "em_curso")
        return bool(aberta and t.prazo and t.prazo < timezone.localdate())


class TarefaSerializer(TarefaListaSerializer):
    transacao = serializers.PrimaryKeyRelatedField(queryset=Transacao.objects.ativos())
    categoria = CampoValorLista("categorias_tarefa", allow_null=True, required=False)
    estado = CampoValorLista("estados_tarefa", allow_null=True, required=False)
    prioridade = CampoValorLista("prioridades", allow_null=True, required=False)
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    modelo_nome = serializers.CharField(source="modelo.nome", read_only=True, default=None)
    imovel_descricao = serializers.SerializerMethodField()
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Tarefa
        fields = [
            *TarefaListaSerializer.Meta.fields, "descricao", "categoria", "prioridade", "concluida_em", "modelo_nome",
            "imovel_descricao", "responsavel", "atualizado_em", "versao", "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = ["referencia", "concluida_em", "criado_em", "atualizado_em", "eliminado_em"]

    def get_imovel_descricao(self, t) -> str | None:
        from apps.propostas.serializers import descricao_imovel

        return descricao_imovel(t.transacao) if t.transacao_id else None

    def get_acoes(self, t) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(t.pk, {})

    def validate_titulo(self, v):
        v = v.strip()
        if not v:
            raise serializers.ValidationError("Indique o título da tarefa.")
        return v

    def validate_transacao(self, tr):
        if self.instance is not None and tr.pk == self.instance.transacao_id:
            return tr
        if tr.pk not in self.context.get("transacoes_visiveis", set()):
            raise serializers.ValidationError("Transação inexistente ou sem acesso.")
        # Pós-venda: só depois do marco efetivo (escritura / contrato) — Cap. 15.
        if not tr.estado or tr.estado.categoria != "concluida":
            raise serializers.ValidationError("As tarefas de pós-venda são de transações concluídas.")
        return tr

    def _defaults(self, d):
        from .servicos import valor_categoria

        if not d.get("categoria"):
            d["categoria"] = valor_categoria("categorias_tarefa", "pos_venda")
        if not d.get("estado"):
            d["estado"] = valor_categoria("estados_tarefa", "aberta")
        return d

    def create(self, d):
        d.pop("versao", None)
        return Tarefa.objects.create(**self._defaults(d))

    def update(self, t, d):
        d.pop("versao", None)
        if "estado" in d and d["estado"] is None:
            d.pop("estado")
        novo = d.get("estado", t.estado)
        concluida = bool(novo and novo.categoria == "concluida")
        if concluida and not t.concluida_em:
            t.concluida_em = timezone.now()
        elif not concluida:
            t.concluida_em = None
        for k, v in d.items():
            setattr(t, k, v)
        t.save()
        return t


class CriarDeModelosSerializer(serializers.Serializer):
    transacao = serializers.PrimaryKeyRelatedField(queryset=Transacao.objects.ativos())
    modelos = serializers.PrimaryKeyRelatedField(queryset=ModeloTarefa.objects.filter(ativo=True), many=True)
