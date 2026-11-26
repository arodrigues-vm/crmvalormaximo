from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.angariacoes.models import Angariacao
from apps.configuracao.campos import CampoValorLista
from apps.configuracao.models import ValorLista
from apps.contas.models import Operacao, Utilizador
from apps.contas.permissoes import filtrar
from apps.propostas.models import Proposta
from apps.propostas.serializers import ParticipanteSerializer, descricao_imovel
from apps.visitas.servicos import nome_responsavel

from .models import ParticipanteTransacao, Transacao

CEM = Decimal(100)
FINAIS = ("concluida", "cancelada")


def _nome(v):
    return v.nome if v else None


def propostas_visiveis(utilizador):
    return filtrar(
        utilizador, "propostas", Operacao.CONSULTAR, Proposta.objects.ativos(), campo_partilhas="partilhada_com"
    )


def descricao_cmi(c) -> str:
    partes = [c.referencia, f"n.º {c.numero_contrato}" if c.numero_contrato else None, c.get_situacao_display()]
    return " · ".join(p for p in partes if p)


class TransacaoListaSerializer(serializers.ModelSerializer):
    entidade_nome = serializers.SerializerMethodField()
    imovel_descricao_completa = serializers.SerializerMethodField()
    estado_nome = serializers.CharField(source="estado.nome", read_only=True, default=None)
    estado_categoria = serializers.CharField(source="estado.categoria", read_only=True, default=None)
    operacao_nome = serializers.CharField(source="operacao.nome", read_only=True, default=None)
    operacao_categoria = serializers.CharField(source="operacao.categoria", read_only=True, default=None)
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)

    class Meta:
        model = Transacao
        fields = [
            "id", "referencia", "entidade", "entidade_nome", "imovel", "imovel_descricao_completa", "estado_nome",
            "estado_categoria", "operacao_nome", "operacao_categoria", "valor", "data_cpcv", "data_escritura",
            "data_escritura_prevista", "responsavel_nome", "criado_em",
        ]  # fmt: skip

    def get_entidade_nome(self, o) -> str | None:
        return o.entidade.nome_completo if o.entidade_id in self.context.get("entidades_visiveis", set()) else None

    def get_imovel_descricao_completa(self, o) -> str:
        return descricao_imovel(o)


class TransacaoSerializer(TransacaoListaSerializer):
    proposta = serializers.PrimaryKeyRelatedField(queryset=Proposta.objects.ativos())
    angariacao = serializers.PrimaryKeyRelatedField(
        queryset=Angariacao.objects.ativos(), allow_null=True, required=False
    )
    operacao = CampoValorLista("operacoes", required=False)
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    participantes = ParticipanteSerializer(many=True, required=False, write_only=True)
    participantes_detalhe = serializers.SerializerMethodField()
    proposta_referencia = serializers.CharField(source="proposta.referencia", read_only=True)
    angariacao_descricao = serializers.SerializerMethodField()
    responsavel_imovel_nome = serializers.SerializerMethodField()
    responsavel_comprador_nome = serializers.SerializerMethodField()
    comissao = serializers.SerializerMethodField()
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Transacao
        fields = [
            "id", "referencia", "proposta", "proposta_referencia", "imovel", "imovel_descricao",
            "imovel_localizacao", "imovel_descricao_completa", "entidade", "entidade_nome", "angariacao",
            "angariacao_descricao", "operacao", "operacao_nome", "operacao_categoria", "estado", "estado_nome",
            "estado_categoria", "motivo_estado", "valor", "sinal_valor", "sinal_unidade", "data_cpcv_prevista",
            "data_cpcv", "data_escritura_prevista", "data_escritura", "responsavel_imovel_nome",
            "responsavel_comprador_nome", "comissao", "participantes", "participantes_detalhe", "efeitos_aplicados",
            "responsavel", "responsavel_nome", "observacoes", "criado_em", "atualizado_em", "versao", "eliminado_em",
            "acoes",
        ]  # fmt: skip
        # O comprador, o imóvel e os responsáveis vêm da proposta; o estado muda só pela ação «Mudar estado».
        read_only_fields = [
            "referencia", "imovel", "imovel_descricao", "imovel_localizacao", "entidade", "estado", "motivo_estado",
            "efeitos_aplicados", "criado_em", "atualizado_em", "eliminado_em",
        ]  # fmt: skip

    def get_participantes_detalhe(self, o) -> list[dict]:
        visiveis = self.context.get("entidades_visiveis", set())
        return [
            {
                "entidade": p.entidade_id,
                "acessivel": p.entidade_id in visiveis,
                "nome": p.entidade.nome_completo if p.entidade_id in visiveis else "Entidade a que não tem acesso",
                "papel": p.papel_id,
                "papel_nome": _nome(p.papel),
                "quota": None if p.quota is None else str(p.quota),
            }
            for p in o.participantes.select_related("entidade", "papel")
        ]

    def get_angariacao_descricao(self, o) -> str | None:
        return descricao_cmi(o.angariacao) if o.angariacao_id else None

    def get_responsavel_imovel_nome(self, o) -> str | None:
        return nome_responsavel(o.consultor_imovel, o.agente_imovel)

    def get_responsavel_comprador_nome(self, o) -> str | None:
        return nome_responsavel(o.consultor_comprador, o.agente_comprador)

    def get_comissao(self, o) -> dict | None:
        """Comissão apurada para esta transação (D-48), se existir."""
        c = getattr(o, "comissao", None)
        if c is None or c.eliminado_em is not None:
            return None
        return {
            "id": c.pk,
            "referencia": c.referencia,
            "valor_final": None if c.valor_final is None else str(c.valor_final),
        }

    def get_acoes(self, o) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(o.pk, {})

    # Validação ------------------------------------------------------------------

    def validate_proposta(self, p):
        if self.instance is not None:
            if p.pk != self.instance.proposta_id:
                raise serializers.ValidationError("A proposta de origem não pode ser mudada.")
            return p
        if not propostas_visiveis(self.context["request"].user).filter(pk=p.pk).exists():
            raise serializers.ValidationError("Proposta inexistente ou sem acesso.")
        if not p.estado or p.estado.categoria != "aceite":
            raise serializers.ValidationError("Só uma proposta aceite pode gerar uma transação.")
        return p

    def validate_participantes(self, lista):
        visiveis = self.context.get("entidades_visiveis", set())
        atuais = set(self.instance.participantes.values_list("entidade_id", flat=True)) if self.instance else set()
        proposta = set()
        if self.instance is None and "proposta" in self.initial_data:
            proposta = set(
                Proposta.objects.filter(pk=self.initial_data.get("proposta")).values_list(
                    "participantes__entidade_id", flat=True
                )
            )
        papeis = set(ValorLista.objects.filter(lista__chave="papeis_participante").values_list("pk", flat=True))
        vistos = set()
        for p in lista:
            if p["entidade"] in vistos:
                raise serializers.ValidationError("A mesma entidade foi indicada mais do que uma vez.")
            vistos.add(p["entidade"])
            # Mantêm-se os participantes já existentes (ou vindos da proposta), mesmo sem acesso.
            if p["entidade"] not in visiveis and p["entidade"] not in atuais and p["entidade"] not in proposta:
                raise serializers.ValidationError("Entidade inexistente ou sem acesso.")
            if p.get("papel") is not None and p["papel"] not in papeis:
                raise serializers.ValidationError("Papel inválido.")
        return lista

    def validate(self, d):
        inst = self.instance
        proposta = d.get("proposta") or inst.proposta
        imovel = proposta.imovel
        if "angariacao" in d:
            cmi = d["angariacao"]
            final = inst and inst.estado and inst.estado.categoria == "concluida"
            if final and cmi != inst.angariacao:
                raise serializers.ValidationError({"angariacao": "Numa transação concluída o CMI não muda. Reabra-a."})
            if cmi is not None and (imovel is None or cmi.imovel_id != imovel.pk):
                raise serializers.ValidationError({"angariacao": "O CMI tem de ser do imóvel da transação."})
        elif inst is None and imovel is not None and imovel.angariacoes.ativos().exists():
            # Seleção expressa do CMI (Cap. 11): obrigatória quando o imóvel tem CMI.
            raise serializers.ValidationError({"angariacao": "Escolha o CMI deste negócio (ou «Sem CMI»)."})
        if inst is None:
            cmi = d.get("angariacao")
            d.setdefault("operacao", (cmi.operacao if cmi else None) or (imovel.operacao if imovel else None))
            if d.get("operacao") is None:
                raise serializers.ValidationError({"operacao": "Indique a operação (venda ou arrendamento)."})
        if d.get("sinal_valor") is not None and not d.get("sinal_unidade", getattr(inst, "sinal_unidade", "")):
            raise serializers.ValidationError({"sinal_unidade": "Indique se o sinal é em % ou em euros."})
        if d.get("sinal_unidade") == Transacao.Unidade.PERCENTAGEM and (d.get("sinal_valor") or 0) > CEM:
            raise serializers.ValidationError({"sinal_valor": "A percentagem não pode passar de 100%."})
        val = lambda c: d.get(c, getattr(inst, c, None))  # noqa: E731
        if val("data_cpcv") and val("data_escritura") and val("data_escritura") < val("data_cpcv"):
            raise serializers.ValidationError({"data_escritura": "A escritura não pode ser antes do CPCV."})
        return d

    # Gravação -------------------------------------------------------------------

    def _gravar_participantes(self, t, lista):
        t.participantes.exclude(entidade_id__in=[p["entidade"] for p in lista]).delete()
        for ordem, p in enumerate(lista):
            ParticipanteTransacao.objects.update_or_create(
                transacao=t, entidade_id=p["entidade"],
                defaults={"papel_id": p.get("papel"), "quota": p.get("quota"), "ordem": ordem},
            )  # fmt: skip

    @transaction.atomic
    def create(self, d):
        d.pop("versao", None)
        participantes = d.pop("participantes", None)
        # Bloqueia a proposta: dois pedidos em simultâneo não geram duas transações.
        p = Proposta.objects.select_for_update().get(pk=d["proposta"].pk)
        existente = Transacao.objects.ativos().filter(proposta=p).first()
        if existente:
            raise serializers.ValidationError(
                {"proposta": f"Esta proposta já deu origem à transação {existente.referencia}."}
            )
        for campo in (
            "imovel", "imovel_descricao", "imovel_localizacao", "entidade", "agente_comprador", "agente_imovel",
            "consultor_comprador", "consultor_imovel",
        ):  # fmt: skip
            d[campo] = getattr(p, campo)
        d["estado"] = (
            ValorLista.objects.filter(lista__chave="estados_transacao", categoria="preparacao", ativo=True)
            .order_by("ordem", "id")
            .first()
        )
        t = Transacao.objects.create(**d)
        if participantes is None:
            participantes = [
                {"entidade": x.entidade_id, "papel": x.papel_id, "quota": x.quota} for x in p.participantes.all()
            ]
        self._gravar_participantes(t, participantes)
        return t

    @transaction.atomic
    def update(self, t, d):
        d.pop("versao", None)
        participantes = d.pop("participantes", None)
        for k, v in d.items():
            setattr(t, k, v)
        t.save()
        if participantes is not None:
            self._gravar_participantes(t, participantes)
        return t


class MudarEstadoSerializer(serializers.Serializer):
    estado = CampoValorLista("estados_transacao")
    motivo = serializers.CharField(max_length=500, allow_blank=True, required=False, default="")
    data_cpcv = serializers.DateField(required=False, allow_null=True)
    data_escritura = serializers.DateField(required=False, allow_null=True)
    data_escritura_prevista = serializers.DateField(required=False, allow_null=True)
    efeitos = serializers.ListField(child=serializers.CharField(max_length=40), required=False, default=list)
