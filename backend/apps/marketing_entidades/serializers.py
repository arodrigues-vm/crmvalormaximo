from django.db import transaction
from rest_framework import serializers

from apps.configuracao.models import ValorLista
from apps.contas.models import Utilizador
from apps.entidades.models import Entidade
from apps.localizacao.models import Concelho

from .models import Inscricao, PassoPlano, PlanoEntidades
from .servicos import CRITERIOS


class PassoSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    responsavel = serializers.PrimaryKeyRelatedField(
        queryset=Utilizador.objects.filter(is_active=True), allow_null=True, required=False
    )
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True, default=None)

    class Meta:
        model = PassoPlano
        fields = ["id", "nome", "descricao", "dias", "periodicidade_dias", "responsavel", "responsavel_nome", "ativo",
                  "ordem"]  # fmt: skip

    def validate_nome(self, v):
        v = v.strip()
        if not v:
            raise serializers.ValidationError("Indique o nome da tarefa.")
        return v

    def validate_periodicidade_dias(self, v):
        if v is not None and v < 1:
            raise serializers.ValidationError("A periodicidade tem de ser de pelo menos 1 dia.")
        return v


class PlanoEntidadesSerializer(serializers.ModelSerializer):
    passos = PassoSerializer(many=True, required=False)
    criterios_nomes = serializers.SerializerMethodField()

    class Meta:
        model = PlanoEntidades
        fields = ["id", "nome", "descricao", "objetivo", "fundamento", "criterios", "criterios_nomes", "gatilhos",
                  "ativo", "ordem", "passos", "criado_em"]  # fmt: skip
        read_only_fields = ["criado_em"]

    def get_criterios_nomes(self, p) -> dict:
        """Nomes legíveis dos valores escolhidos em cada critério (para mostrar no ecrã)."""
        saida = {}
        for chave, ids in (p.criterios or {}).items():
            lista = CRITERIOS[chave][1]
            qs = ValorLista.objects.filter(pk__in=ids) if lista else Concelho.objects.filter(pk__in=ids)
            saida[chave] = [{"id": x.pk, "nome": x.nome} for x in qs]
        return saida

    def validate_nome(self, v):
        v = v.strip()
        if not v:
            raise serializers.ValidationError("Indique o nome do plano.")
        return v

    def validate_gatilhos(self, v):
        validos = {k for k, _ in PlanoEntidades.GATILHOS}
        if not isinstance(v, list) or any(g not in validos for g in v) or len(set(v)) != len(v):
            raise serializers.ValidationError("Gatilho inválido.")
        return v

    def validate_criterios(self, v):
        """Só chaves conhecidas e valores que existem na lista certa (ou concelhos reais)."""
        if not isinstance(v, dict) or any(k not in CRITERIOS for k in v):
            raise serializers.ValidationError("Critério inválido.")
        limpo = {}
        for chave, ids in v.items():
            if not isinstance(ids, list) or any(not isinstance(i, int) for i in ids):
                raise serializers.ValidationError({chave: "Indique uma lista de valores."})
            lista = CRITERIOS[chave][1]
            existentes = (
                ValorLista.objects.filter(pk__in=ids, lista__chave=lista)
                if lista
                else Concelho.objects.filter(pk__in=ids)
            ).count()
            if existentes != len(set(ids)):
                raise serializers.ValidationError({chave: "Há valores que não existem."})
            if ids:
                limpo[chave] = sorted(set(ids))
        return limpo

    @transaction.atomic
    def create(self, d):
        passos = d.pop("passos", [])
        plano = PlanoEntidades.objects.create(**d)
        self._passos(plano, passos)
        return plano

    @transaction.atomic
    def update(self, plano, d):
        passos = d.pop("passos", None)
        for k, v in d.items():
            setattr(plano, k, v)
        plano.save()
        if passos is not None:
            self._passos(plano, passos)
        return plano

    def _passos(self, plano, passos):
        """Atualiza os existentes, cria os novos e desativa os que saíram (nunca se apagam: as tarefas já criadas
        ficam como estão — editar o plano não altera tarefas históricas)."""
        vistos = set()
        for ordem, p in enumerate(passos):
            pid = p.pop("id", None)
            p["ordem"] = ordem
            if pid:
                passo = plano.passos.filter(pk=pid).first()
                if passo is None:
                    raise serializers.ValidationError({"passos": "Tarefa de outro plano."})
                for k, v in p.items():
                    setattr(passo, k, v)
                passo.save()
            else:
                passo = PassoPlano.objects.create(plano=plano, **p)
            vistos.add(passo.pk)
        plano.passos.exclude(pk__in=vistos).update(ativo=False)


class InscricaoSerializer(serializers.ModelSerializer):
    entidade = serializers.PrimaryKeyRelatedField(queryset=Entidade.objects.ativos())
    plano = serializers.PrimaryKeyRelatedField(queryset=PlanoEntidades.objects.filter(ativo=True))
    entidade_nome = serializers.SerializerMethodField()
    plano_nome = serializers.CharField(source="plano.nome", read_only=True)
    plano_fundamento = serializers.CharField(source="plano.get_fundamento_display", read_only=True)
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)
    origem_nome = serializers.SerializerMethodField()
    progresso = serializers.SerializerMethodField()
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Inscricao
        fields = [
            "id", "referencia", "entidade", "entidade_nome", "plano", "plano_nome", "plano_fundamento", "inicio",
            "origem", "origem_nome", "estado", "terminada_em", "motivo_fim", "responsavel", "responsavel_nome",
            "progresso", "criado_em", "atualizado_em", "versao", "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = ["referencia", "inicio", "origem", "estado", "terminada_em", "motivo_fim", "responsavel",
                            "criado_em", "atualizado_em", "eliminado_em"]  # fmt: skip
        validators = []

    def get_entidade_nome(self, i) -> str:
        return i.entidade.nome_completo if i.entidade_id in self.context.get("entidades_visiveis", set()) else "—"

    def get_origem_nome(self, i) -> str:
        return {"manual": "À mão", "publico": "Iniciado para o público", **dict(PlanoEntidades.GATILHOS)}.get(
            i.origem, i.origem
        )

    def get_progresso(self, i) -> dict:
        ts = [t for t in i.tarefas.all() if t.eliminado_em is None]
        conc = sum(1 for t in ts if t.estado and t.estado.categoria == "concluida")
        abertas = sum(1 for t in ts if not t.estado or t.estado.categoria in ("aberta", "em_curso"))
        return {"total": len(ts), "concluidas": conc, "por_fazer": abertas}

    def get_acoes(self, i) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(i.pk, {})


class TerminarSerializer(serializers.Serializer):
    motivo = serializers.CharField()
