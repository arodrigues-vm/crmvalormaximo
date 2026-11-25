from django.utils import timezone
from rest_framework import serializers

from apps.agentes.models import Agente
from apps.configuracao.campos import CampoValorLista
from apps.contas.models import Utilizador
from apps.entidades.models import Entidade
from apps.imoveis.models import Imovel
from apps.procuras.models import Procura

from .models import CRITERIOS_AVALIACAO, Interesse, Visita
from .servicos import atualizar_interesse, derivar_responsaveis, nome_responsavel, valor_por_categoria


def _nome(v):
    return v.nome if v else None


def _imovel(i) -> str:
    tipo = " ".join(filter(None, [_nome(i.tipo), _nome(i.tipologia)]))
    return " · ".join(filter(None, [i.referencia, tipo, i.localidade]))


def _imovel_visita(o) -> str:
    if o.imovel_id:
        return _imovel(o.imovel)
    return " · ".join(filter(None, [o.imovel_descricao, o.imovel_localizacao])) or "Imóvel não registado"


class _Base(serializers.ModelSerializer):
    entidade_nome = serializers.SerializerMethodField()
    imovel_descricao = serializers.SerializerMethodField()
    estado_nome = serializers.CharField(source="estado.nome", read_only=True, default=None)
    estado_categoria = serializers.CharField(source="estado.categoria", read_only=True, default=None)
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)

    def get_entidade_nome(self, o) -> str | None:
        return o.entidade.nome_completo if o.entidade_id in self.context.get("entidades_visiveis", set()) else None

    def get_imovel_descricao(self, o) -> str:
        return _imovel(o.imovel)

    def get_acoes(self, o) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(o.pk, {})

    def validate_entidade(self, e):
        atual = self.instance.entidade_id if self.instance else None
        if e.pk != atual and e.pk not in self.context.get("entidades_visiveis", set()):
            raise serializers.ValidationError("Entidade inexistente ou sem acesso.")
        return e

    def validate_imovel(self, i):
        if i is None:
            return i
        atual = self.instance.imovel_id if self.instance else None
        if i.pk != atual and i.pk not in self.context.get("imoveis_visiveis", set()):
            raise serializers.ValidationError("Imóvel inexistente ou sem acesso.")
        return i


class VisitaListaSerializer(_Base):
    def get_imovel_descricao(self, o) -> str:
        return _imovel_visita(o)

    class Meta:
        model = Visita
        fields = [
            "id", "referencia", "data", "hora_entrada", "hora_saida", "entidade", "entidade_nome", "imovel",
            "imovel_descricao", "estado_nome", "estado_categoria", "responsavel_nome",
        ]  # fmt: skip


class VisitaSerializer(_Base):
    entidade = serializers.PrimaryKeyRelatedField(queryset=Entidade.objects.ativos())
    imovel = serializers.PrimaryKeyRelatedField(queryset=Imovel.objects.ativos(), allow_null=True, required=False)
    agente_comprador = serializers.PrimaryKeyRelatedField(
        queryset=Agente.objects.ativos(), allow_null=True, required=False
    )
    agente_imovel = serializers.PrimaryKeyRelatedField(
        queryset=Agente.objects.ativos(), allow_null=True, required=False
    )
    agente_comprador_nome = serializers.SerializerMethodField()
    agente_imovel_nome = serializers.SerializerMethodField()
    # D-46: quem responde pelo imóvel e pela entidade (membro da Equipa ou agente)
    responsavel_imovel_nome = serializers.SerializerMethodField()
    responsavel_comprador_nome = serializers.SerializerMethodField()
    procura = serializers.PrimaryKeyRelatedField(queryset=Procura.objects.ativos(), allow_null=True, required=False)
    acompanhantes = serializers.PrimaryKeyRelatedField(queryset=Entidade.objects.ativos(), many=True, required=False)
    estado = CampoValorLista("estados_visita", allow_null=True, required=False)
    compraria = CampoValorLista("sim_nao", allow_null=True, required=False)
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    nomes = serializers.SerializerMethodField()
    acompanhantes_detalhe = serializers.SerializerMethodField()
    procura_referencia = serializers.CharField(source="procura.referencia", read_only=True, default=None)
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Visita
        fields = [
            "id", "referencia", "imovel", "imovel_descricao", "imovel_descricao_livre", "imovel_localizacao",
            "agente_comprador", "agente_comprador_nome", "agente_imovel", "agente_imovel_nome",
            "consultor_comprador", "consultor_imovel", "responsavel_imovel_nome", "responsavel_comprador_nome",
            "entidade", "entidade_nome", "acompanhantes",
            "acompanhantes_detalhe", "procura", "procura_referencia", "data", "hora_entrada", "hora_saida",
            "estado", "estado_nome", "estado_categoria", *CRITERIOS_AVALIACAO, "mais_gostou", "menos_gostou",
            "compraria", "responsavel", "responsavel_nome", "observacoes", "nomes",
            "criado_em", "atualizado_em", "versao", "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = [
            "consultor_comprador",
            "consultor_imovel",
            "referencia",
            "criado_em",
            "atualizado_em",
            "eliminado_em",
        ]

    def get_fields(self):
        campos = super().get_fields()
        for c in CRITERIOS_AVALIACAO:
            campos[c] = CampoValorLista("avaliacoes_visita", allow_null=True, required=False)
        return campos

    imovel_descricao_livre = serializers.CharField(
        source="imovel_descricao", required=False, allow_blank=True, max_length=255
    )

    def get_imovel_descricao(self, o) -> str:
        return _imovel_visita(o)

    @staticmethod
    def _agente(a) -> str | None:
        if a is None:
            return None
        return f"{a.nome} ({a.agencia.nome})" if a.agencia_id else a.nome

    def get_agente_comprador_nome(self, o) -> str | None:
        return self._agente(o.agente_comprador)

    def get_agente_imovel_nome(self, o) -> str | None:
        return self._agente(o.agente_imovel)

    def get_responsavel_imovel_nome(self, o) -> str | None:
        return nome_responsavel(o.consultor_imovel, o.agente_imovel)

    def get_responsavel_comprador_nome(self, o) -> str | None:
        return nome_responsavel(o.consultor_comprador, o.agente_comprador)

    def get_nomes(self, o) -> dict:
        return {
            "estado": _nome(o.estado),
            "compraria": _nome(o.compraria),
            **{c: _nome(getattr(o, c)) for c in CRITERIOS_AVALIACAO},
        }

    def get_acompanhantes_detalhe(self, o) -> list[dict]:
        visiveis = self.context.get("entidades_visiveis", set())
        return [
            {"id": e.pk, "nome": e.nome_completo if e.pk in visiveis else "Entidade a que não tem acesso"}
            for e in o.acompanhantes.all()
        ]

    def validate_acompanhantes(self, lista):
        atuais = set(self.instance.acompanhantes.values_list("pk", flat=True)) if self.instance else set()
        visiveis = self.context.get("entidades_visiveis", set())
        if any(e.pk not in visiveis and e.pk not in atuais for e in lista):
            raise serializers.ValidationError("Entidade inexistente ou sem acesso.")
        return lista

    def validate(self, d):
        val = lambda c: d.get(c, getattr(self.instance, c, None))  # noqa: E731
        entrada, saida = val("hora_entrada"), val("hora_saida")
        if entrada and saida and saida < entrada:
            raise serializers.ValidationError({"hora_saida": "A hora de saída não pode ser anterior à de entrada."})
        estado, data = val("estado"), val("data")
        if estado and estado.categoria == "realizada" and data and data > timezone.localdate():
            raise serializers.ValidationError({"estado": "Uma visita com data futura não pode estar «Realizada»."})
        if not val("imovel") and not (val("imovel_descricao") or "").strip():
            raise serializers.ValidationError({"imovel": "Escolha o imóvel ou, se não estiver registado, descreva-o."})
        if val("imovel"):
            d["imovel_descricao"] = d["imovel_localizacao"] = ""  # com imóvel registado, não há descrição livre
        derivar_responsaveis(d, self.instance)
        procura = val("procura")
        if procura and procura.entidade_id != val("entidade").pk:
            raise serializers.ValidationError({"procura": "A procura tem de ser do mesmo cliente."})
        return d

    def create(self, d):
        d.pop("versao", None)
        acompanhantes = d.pop("acompanhantes", [])
        if not d.get("estado"):
            d["estado"] = valor_por_categoria("estados_visita", "agendada")
        v = Visita.objects.create(**d)
        v.acompanhantes.set(acompanhantes)
        self._interesse(v)
        return v

    def _interesse(self, v):
        pedido = self.context.get("request")
        atualizar_interesse(v, getattr(pedido, "user", None), request=pedido)

    def update(self, v, d):
        d.pop("versao", None)
        acompanhantes = d.pop("acompanhantes", None)
        if "estado" in d and d["estado"] is None:
            d.pop("estado")
        for k, x in d.items():
            setattr(v, k, x)
        v.save()
        if acompanhantes is not None:
            v.acompanhantes.set(acompanhantes)
        self._interesse(v)
        return v


class InteresseListaSerializer(_Base):
    grau_nome = serializers.CharField(source="grau.nome", read_only=True, default=None)
    origem_nome = serializers.CharField(source="origem.nome", read_only=True, default=None)

    class Meta:
        model = Interesse
        fields = [
            "id", "referencia", "entidade", "entidade_nome", "imovel", "imovel_descricao", "origem_nome",
            "grau_nome", "estado_nome", "estado_categoria", "ultima_visita", "responsavel_nome", "atualizado_em",
        ]  # fmt: skip


class InteresseSerializer(InteresseListaSerializer):
    entidade = serializers.PrimaryKeyRelatedField(queryset=Entidade.objects.ativos())
    imovel = serializers.PrimaryKeyRelatedField(queryset=Imovel.objects.ativos())
    origem = CampoValorLista("origens_interesse", allow_null=True, required=False)
    grau = CampoValorLista("graus_interesse", allow_null=True, required=False)
    estado = CampoValorLista("estados_interesse", allow_null=True, required=False)
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Interesse
        fields = [
            "id", "referencia", "entidade", "entidade_nome", "imovel", "imovel_descricao", "origem", "origem_nome",
            "grau", "grau_nome", "estado", "estado_nome", "estado_categoria", "ultima_visita",
            "responsavel", "responsavel_nome", "observacoes",
            "criado_em", "atualizado_em", "versao", "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = ["referencia", "ultima_visita", "criado_em", "atualizado_em", "eliminado_em"]

    def validate(self, d):
        entidade = d.get("entidade", getattr(self.instance, "entidade", None))
        imovel = d.get("imovel", getattr(self.instance, "imovel", None))
        outros = Interesse.objects.ativos().filter(entidade=entidade, imovel=imovel)
        if self.instance:
            outros = outros.exclude(pk=self.instance.pk)
        if outros.exists():
            raise serializers.ValidationError(
                {"imovel": f"Já existe o interesse {outros.first().referencia} deste cliente neste imóvel."}
            )
        return d

    def create(self, d):
        d.pop("versao", None)
        if not d.get("estado"):
            d["estado"] = valor_por_categoria("estados_interesse", "ativo")
        return Interesse.objects.create(**d)

    def update(self, o, d):
        d.pop("versao", None)
        if "estado" in d and d["estado"] is None:
            d.pop("estado")
        return super().update(o, d)
