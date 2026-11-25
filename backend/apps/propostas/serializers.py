from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.agentes.models import Agente
from apps.configuracao.campos import CampoValorLista
from apps.configuracao.models import ValorLista
from apps.contas.models import Utilizador
from apps.entidades.models import Entidade
from apps.imoveis.models import Imovel
from apps.visitas.models import Visita

from .models import Participante, Proposta, Ronda

CEM = Decimal(100)


def _nome(v):
    return v.nome if v else None


def descricao_imovel(o) -> str:
    if o.imovel_id:
        i = o.imovel
        tipo = " ".join(filter(None, [_nome(i.tipo), _nome(i.tipologia)]))
        return " · ".join(filter(None, [i.referencia, tipo, i.localidade]))
    return " · ".join(filter(None, [o.imovel_descricao, o.imovel_localizacao])) or "Imóvel não registado"


def agente_nome(a) -> str | None:
    if a is None:
        return None
    return f"{a.nome} ({a.agencia.nome})" if a.agencia_id else a.nome


class RondaSerializer(serializers.ModelSerializer):
    autor_nome = serializers.CharField(source="get_autor_display", read_only=True)
    modo_pagamento = CampoValorLista("modos_pagamento", allow_null=True, required=False)
    financiamento = CampoValorLista("sim_nao", allow_null=True, required=False)
    modo_pagamento_nome = serializers.CharField(source="modo_pagamento.nome", read_only=True, default=None)
    financiamento_nome = serializers.CharField(source="financiamento.nome", read_only=True, default=None)
    criado_por_nome = serializers.CharField(source="criado_por.nome", read_only=True, default=None)

    class Meta:
        model = Ronda
        fields = [
            "id", "numero", "autor", "autor_nome", "data", "valor", "sinal_valor", "sinal_unidade",
            "modo_pagamento", "modo_pagamento_nome", "financiamento", "financiamento_nome", "data_cpcv",
            "data_escritura", "validade", "condicoes", "criado_em", "criado_por_nome",
        ]  # fmt: skip
        read_only_fields = ["numero", "criado_em"]
        extra_kwargs = {"data": {"required": False}}

    def validate(self, d):
        if d.get("sinal_valor") is not None and not d.get("sinal_unidade"):
            raise serializers.ValidationError({"sinal_unidade": "Indique se o sinal é em % ou em euros."})
        if d.get("sinal_unidade") == Ronda.Unidade.PERCENTAGEM and (d.get("sinal_valor") or 0) > CEM:
            raise serializers.ValidationError({"sinal_valor": "A percentagem não pode passar de 100%."})
        if d.get("data_cpcv") and d.get("data_escritura") and d["data_escritura"] < d["data_cpcv"]:
            raise serializers.ValidationError({"data_escritura": "A escritura não pode ser antes do CPCV."})
        if self.instance is None:
            d.setdefault("data", timezone.localdate())
        return d


class ParticipanteSerializer(serializers.Serializer):
    entidade = serializers.IntegerField()
    papel = serializers.IntegerField(allow_null=True, required=False)
    quota = serializers.DecimalField(
        max_digits=7, decimal_places=4, min_value=Decimal(0), max_value=CEM, allow_null=True, required=False
    )


class PropostaListaSerializer(serializers.ModelSerializer):
    entidade_nome = serializers.SerializerMethodField()
    imovel_descricao_completa = serializers.SerializerMethodField()
    estado_nome = serializers.CharField(source="estado.nome", read_only=True, default=None)
    estado_categoria = serializers.CharField(source="estado.categoria", read_only=True, default=None)
    valor_atual = serializers.SerializerMethodField()
    ultima_ronda_autor = serializers.SerializerMethodField()
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)

    class Meta:
        model = Proposta
        fields = [
            "id", "referencia", "entidade", "entidade_nome", "imovel", "imovel_descricao_completa", "estado_nome",
            "estado_categoria", "valor_atual", "ultima_ronda_autor", "responsavel_nome", "criado_em",
        ]  # fmt: skip

    def _ultima(self, o):
        rondas = list(o.rondas.all())
        return rondas[-1] if rondas else None

    def get_entidade_nome(self, o) -> str | None:
        return o.entidade.nome_completo if o.entidade_id in self.context.get("entidades_visiveis", set()) else None

    def get_imovel_descricao_completa(self, o) -> str:
        return descricao_imovel(o)

    def get_valor_atual(self, o) -> str | None:
        r = self._ultima(o)
        return None if r is None else str(r.valor)

    def get_ultima_ronda_autor(self, o) -> str | None:
        r = self._ultima(o)
        return None if r is None else r.get_autor_display()


class PropostaSerializer(PropostaListaSerializer):
    visita = serializers.PrimaryKeyRelatedField(queryset=Visita.objects.ativos(), allow_null=True, required=False)
    imovel = serializers.PrimaryKeyRelatedField(queryset=Imovel.objects.ativos(), allow_null=True, required=False)
    entidade = serializers.PrimaryKeyRelatedField(queryset=Entidade.objects.ativos())
    agente_comprador = serializers.PrimaryKeyRelatedField(
        queryset=Agente.objects.ativos(), allow_null=True, required=False
    )
    agente_imovel = serializers.PrimaryKeyRelatedField(
        queryset=Agente.objects.ativos(), allow_null=True, required=False
    )
    estado = CampoValorLista("estados_proposta", allow_null=True, required=False)
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    participantes = ParticipanteSerializer(many=True, required=False, write_only=True)
    ronda_inicial = RondaSerializer(required=False, write_only=True)
    participantes_detalhe = serializers.SerializerMethodField()
    rondas = RondaSerializer(many=True, read_only=True)
    visita_referencia = serializers.CharField(source="visita.referencia", read_only=True, default=None)
    agente_comprador_nome = serializers.SerializerMethodField()
    agente_imovel_nome = serializers.SerializerMethodField()
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Proposta
        fields = [
            "id", "referencia", "visita", "visita_referencia", "imovel", "imovel_descricao", "imovel_localizacao",
            "imovel_descricao_completa", "entidade", "entidade_nome", "agente_comprador", "agente_comprador_nome",
            "agente_imovel", "agente_imovel_nome", "estado", "estado_nome", "estado_categoria", "valor_atual",
            "ultima_ronda_autor", "participantes", "participantes_detalhe", "ronda_inicial", "rondas",
            "responsavel", "responsavel_nome", "observacoes", "criado_em", "atualizado_em", "versao",
            "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = ["referencia", "criado_em", "atualizado_em", "eliminado_em"]

    def get_acoes(self, o) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(o.pk, {})

    def get_agente_comprador_nome(self, o) -> str | None:
        return agente_nome(o.agente_comprador)

    def get_agente_imovel_nome(self, o) -> str | None:
        return agente_nome(o.agente_imovel)

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

    # Validação ------------------------------------------------------------------

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

    def validate_visita(self, v):
        if v is None:
            return v
        if self.instance and self.instance.visita_id == v.pk:
            return v
        if v.pk not in self.context.get("visitas_visiveis", set()):
            raise serializers.ValidationError("Visita inexistente ou sem acesso.")
        return v

    def validate_participantes(self, lista):
        visiveis = self.context.get("entidades_visiveis", set())
        atuais = set(self.instance.participantes.values_list("entidade_id", flat=True)) if self.instance else set()
        papeis = set(ValorLista.objects.filter(lista__chave="papeis_participante").values_list("pk", flat=True))
        vistos = set()
        for p in lista:
            if p["entidade"] in vistos:
                raise serializers.ValidationError("A mesma entidade foi indicada mais do que uma vez.")
            vistos.add(p["entidade"])
            if p["entidade"] not in visiveis and p["entidade"] not in atuais:
                raise serializers.ValidationError("Entidade inexistente ou sem acesso.")
            if p.get("papel") is not None and p["papel"] not in papeis:
                raise serializers.ValidationError("Papel inválido.")
        return lista

    def validate(self, d):
        inst = self.instance
        val = lambda c: d.get(c, getattr(inst, c, None))  # noqa: E731
        visita = val("visita")
        if not inst and visita is not None:
            existente = Proposta.objects.ativos().filter(visita=visita).first()
            if existente:
                raise serializers.ValidationError(
                    {"visita": f"Esta visita já deu origem à proposta {existente.referencia}."}
                )
            if visita.entidade_id != d["entidade"].pk or (visita.imovel_id or None) != (
                d.get("imovel").pk if d.get("imovel") else None
            ):
                raise serializers.ValidationError({"visita": "O comprador e o imóvel têm de ser os da visita."})
        if not val("imovel") and not (val("imovel_descricao") or "").strip():
            raise serializers.ValidationError({"imovel": "Escolha o imóvel ou, se não estiver registado, descreva-o."})
        if val("imovel"):
            d["imovel_descricao"] = d["imovel_localizacao"] = ""
        for campo in ("agente_comprador", "agente_imovel"):
            if not val(campo):
                raise serializers.ValidationError({campo: "Indique o agente (registado em Agentes)."})
        if not inst and "ronda_inicial" not in d:
            raise serializers.ValidationError({"ronda_inicial": "Indique o valor e as condições da proposta."})
        estado = val("estado")
        if estado and estado.categoria == "aceite" and val("imovel"):
            outras = Proposta.objects.ativos().filter(imovel=val("imovel"), estado__categoria="aceite")
            if inst:
                outras = outras.exclude(pk=inst.pk)
            if outras.exists():
                raise serializers.ValidationError(
                    {"estado": f"Já existe uma proposta aceite para este imóvel ({outras.first().referencia})."}
                )
        return d

    # Gravação -------------------------------------------------------------------

    def _gravar_participantes(self, proposta, lista):
        proposta.participantes.exclude(entidade_id__in=[p["entidade"] for p in lista]).delete()
        for ordem, p in enumerate(lista):
            Participante.objects.update_or_create(
                proposta=proposta, entidade_id=p["entidade"],
                defaults={"papel_id": p.get("papel"), "quota": p.get("quota"), "ordem": ordem},
            )  # fmt: skip

    @transaction.atomic
    def create(self, d):
        d.pop("versao", None)
        participantes = d.pop("participantes", None)
        ronda = d.pop("ronda_inicial")
        if not d.get("estado"):
            d["estado"] = (
                ValorLista.objects.filter(lista__chave="estados_proposta", categoria="negociacao", ativo=True)
                .order_by("ordem", "id")
                .first()
            )
        p = Proposta.objects.create(**d)
        if participantes is None:
            comprador = ValorLista.objects.filter(lista__chave="papeis_participante", nome="Comprador").first()
            participantes = [{"entidade": p.entidade_id, "papel": comprador.pk if comprador else None}]
        self._gravar_participantes(p, participantes)
        Ronda.objects.create(proposta=p, numero=1, criado_por=p.criado_por, **ronda)
        return p

    @transaction.atomic
    def update(self, p, d):
        d.pop("versao", None)
        d.pop("ronda_inicial", None)
        participantes = d.pop("participantes", None)
        if "estado" in d and d["estado"] is None:
            d.pop("estado")
        for k, v in d.items():
            setattr(p, k, v)
        p.save()
        if participantes is not None:
            self._gravar_participantes(p, participantes)
        return p
