from django.utils import timezone
from rest_framework import serializers

from apps.configuracao.campos import CampoValorLista
from apps.contas.models import Utilizador
from apps.transacoes.models import Transacao

from .models import ORIGENS, ModeloTarefa, Tarefa


class ModeloTarefaSerializer(serializers.ModelSerializer):
    modulo_nome = serializers.CharField(source="get_modulo_display", read_only=True)

    class Meta:
        model = ModeloTarefa
        fields = ["id", "modulo", "modulo_nome", "nome", "descricao", "dias_apos", "ativo", "ordem"]
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
    pos_venda = serializers.BooleanField(read_only=True)
    marketing = serializers.BooleanField(read_only=True)
    plano_referencia = serializers.CharField(source="plano.referencia", read_only=True, default=None)
    origem = serializers.SerializerMethodField()

    class Meta:
        model = Tarefa
        fields = [
            "id", "referencia", "titulo", "estado", "estado_nome", "estado_categoria", "prioridade", "prioridade_nome",
            "prazo", "atrasada", "pos_venda", "marketing", "plano", "plano_referencia", "mk_numero", "mk_semana",
            "incluida", "transacao", "transacao_referencia", "cliente_nome", "origem",
            "responsavel", "responsavel_nome", "criado_em",
        ]  # fmt: skip

    def get_origem(self, t) -> dict | None:
        from .servicos import descrever_origem

        return descrever_origem(self.context["request"].user, t) if "request" in self.context else None

    def get_cliente_nome(self, t) -> str | None:
        if not t.transacao_id:
            return None
        e = t.transacao.entidade
        return e.nome_completo if e.pk in self.context.get("entidades_visiveis", set()) else None

    def get_atrasada(self, t) -> bool:
        aberta = t.estado is None or t.estado.categoria in ("aberta", "em_curso")
        return bool(aberta and t.prazo and t.prazo < timezone.localdate())


class TarefaSerializer(TarefaListaSerializer):
    transacao = serializers.PrimaryKeyRelatedField(queryset=Transacao.objects.ativos(), allow_null=True, required=False)
    categoria = CampoValorLista("categorias_tarefa", allow_null=True, required=False)
    origem_modulo = serializers.ChoiceField(choices=ORIGENS, allow_blank=True, required=False)
    origem_id = serializers.IntegerField(allow_null=True, required=False, min_value=1)
    prioridade = CampoValorLista("prioridades", allow_null=True, required=False)
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    modelo_nome = serializers.CharField(source="modelo.nome", read_only=True, default=None)
    imovel_descricao = serializers.SerializerMethodField()
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Tarefa
        fields = [
            *TarefaListaSerializer.Meta.fields, "descricao", "categoria", "origem_modulo", "origem_id", "concluida_em",
            "motivo_estado", "modelo_nome", "imovel_descricao", "atualizado_em", "versao", "eliminado_em", "acoes",
        ]  # fmt: skip
        # O estado muda só pela ação expressa «mudar-estado» (concluir / reabrir com motivo).
        read_only_fields = [
            "referencia", "estado", "concluida_em", "motivo_estado", "criado_em", "atualizado_em", "eliminado_em",
            "plano", "mk_numero", "mk_semana", "incluida",
        ]  # fmt: skip

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
        if tr is None:
            return tr
        if self.instance is not None and tr.pk == self.instance.transacao_id:
            return tr
        if tr.pk not in self.context.get("transacoes_visiveis", set()):
            raise serializers.ValidationError("Transação inexistente ou sem acesso.")
        # Pós-venda: só depois do marco efetivo (escritura / contrato) — Cap. 15.
        if not tr.estado or tr.estado.categoria != "concluida":
            raise serializers.ValidationError("As tarefas de pós-venda são de transações concluídas.")
        return tr

    def validate(self, d):
        from .servicos import obter_origem, valor_categoria

        t = self.instance
        if t is not None and t.inscricao_id:
            # Tarefa de marketing de entidades: ligação à entidade e ao plano fixas.
            for k in ("transacao", "origem_modulo", "origem_id", "categoria"):
                d.pop(k, None)
            return d
        if t is not None and t.plano_id:
            # Ocorrência do plano: designação literal do catálogo e ligação fixas; muda-se prazo, responsável…
            if "titulo" in d and d["titulo"] != t.titulo:
                raise serializers.ValidationError({"titulo": "A designação das tarefas do plano não se altera."})
            for k in ("transacao", "origem_modulo", "origem_id", "categoria"):
                d.pop(k, None)
            return d
        transacao = d.get("transacao", t.transacao if t else None)
        if t is not None and "transacao" in d and (transacao is None) != (t.transacao_id is None):
            raise serializers.ValidationError({"transacao": "Uma tarefa não passa entre Pós-Venda e Tarefas gerais."})
        modulo = d.get("origem_modulo", t.origem_modulo if t else "") or ""
        pk = d.get("origem_id", t.origem_id if t else None)
        if transacao is not None:
            if modulo or pk:
                raise serializers.ValidationError({"origem_modulo": "As tarefas de pós-venda ligam-se só à transação."})
        elif bool(modulo) != bool(pk):
            raise serializers.ValidationError({"origem_id": "Escolha o módulo e o registo, ou nenhum."})
        elif modulo and (t is None or (modulo, pk) != (t.origem_modulo, t.origem_id)):
            if obter_origem(self.context["request"].user, modulo, pk) is None:
                raise serializers.ValidationError({"origem_id": "Registo inexistente ou sem acesso."})
        d["origem_modulo"], d["origem_id"] = modulo, pk or None
        tipo = "pos_venda" if transacao is not None else "geral"
        categoria = d.get("categoria", t.categoria if t else None)
        if categoria is None:
            d["categoria"] = valor_categoria("categorias_tarefa", tipo)
        elif categoria.categoria in ("marketing", "marketing_entidades") or (categoria.categoria == "pos_venda") != (
            tipo == "pos_venda"
        ):
            raise serializers.ValidationError(
                {"categoria": "Categoria de pós-venda só em tarefas de transações concluídas (e vice-versa)."}
            )
        return d

    def create(self, d):
        from .servicos import valor_categoria

        d.pop("versao", None)
        return Tarefa.objects.create(**d, estado=valor_categoria("estados_tarefa", "aberta"))

    def update(self, t, d):
        d.pop("versao", None)
        for k, v in d.items():
            setattr(t, k, v)
        t.save()
        return t


class MudarEstadoTarefaSerializer(serializers.Serializer):
    estado = CampoValorLista("estados_tarefa")
    motivo = serializers.CharField(required=False, allow_blank=True, default="")


class CriarDeModelosSerializer(serializers.Serializer):
    transacao = serializers.PrimaryKeyRelatedField(queryset=Transacao.objects.ativos(), required=False)
    origem_modulo = serializers.ChoiceField(choices=ORIGENS, required=False)
    origem_id = serializers.IntegerField(required=False, min_value=1)
    modelos = serializers.PrimaryKeyRelatedField(queryset=ModeloTarefa.objects.filter(ativo=True), many=True)
