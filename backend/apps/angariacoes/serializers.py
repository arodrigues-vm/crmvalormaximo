from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.configuracao.campos import CampoValorLista
from apps.configuracao.models import ValorLista
from apps.contas.models import Utilizador
from apps.imoveis.models import Imovel

from .models import ESTADOS, Angariacao, Interveniente, Renovacao, calcular_fim
from .servicos import alerta, comissao_estimada, conflitos, descrever_conflitos, hoje, tempo_restante

CEM = Decimal("100")
CAMPOS_CONTRATUAIS = ("data_inicio", "prazo_meses")


def _nome(v):
    return v.nome if v else None


class IntervenienteEscritaSerializer(serializers.Serializer):
    entidade = serializers.IntegerField()
    papel = serializers.IntegerField(allow_null=True, required=False)
    quota = serializers.DecimalField(
        max_digits=7, decimal_places=4, min_value=Decimal("0"), max_value=CEM, allow_null=True, required=False
    )


class RenovacaoSerializer(serializers.ModelSerializer):
    forma_nome = serializers.CharField(source="get_forma_display", read_only=True)
    criado_por_nome = serializers.CharField(source="criado_por.nome", read_only=True, default=None)

    class Meta:
        model = Renovacao
        fields = [
            "id", "ciclo", "forma", "forma_nome", "data_inicio", "prazo_meses", "data_fim", "observacoes",
            "criado_em", "criado_por_nome",
        ]  # fmt: skip
        read_only_fields = ["ciclo", "data_fim", "criado_em"]


class AngariacaoListaSerializer(serializers.ModelSerializer):
    imovel_referencia = serializers.CharField(source="imovel.referencia", read_only=True)
    imovel_descricao = serializers.SerializerMethodField()
    # Fotografia principal do imóvel (miniatura). A imagem é servida pela API dos imóveis,
    # que verifica o acesso ao imóvel.
    imovel_fotografia = serializers.SerializerMethodField()
    operacao_nome = serializers.SerializerMethodField()
    regime_nome = serializers.SerializerMethodField()
    estado = serializers.SerializerMethodField()
    estado_nome = serializers.SerializerMethodField()
    alerta = serializers.SerializerMethodField()
    tempo_restante = serializers.SerializerMethodField()
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)
    partes = serializers.SerializerMethodField()

    class Meta:
        model = Angariacao
        fields = [
            "id", "referencia", "numero_contrato", "imovel", "imovel_referencia", "imovel_descricao",
            "operacao_nome", "regime_nome", "data_inicio", "data_fim_vigente", "estado", "estado_nome", "alerta",
            "tempo_restante", "partes", "responsavel_nome", "imovel_fotografia",
        ]  # fmt: skip

    def get_imovel_fotografia(self, o) -> dict | None:
        i = o.imovel
        return {"imovel": i.pk, "versao": i.versao} if i.fotografia else None

    def get_imovel_descricao(self, o) -> str:
        i = o.imovel
        return " ".join(filter(None, [_nome(i.tipo), _nome(i.tipologia), i.localidade]))

    def get_operacao_nome(self, o) -> str | None:
        return _nome(o.operacao)

    def get_regime_nome(self, o) -> str | None:
        return _nome(o.regime)

    def get_estado(self, o) -> str:
        return o.estado(hoje())

    def get_estado_nome(self, o) -> str:
        return ESTADOS[o.estado(hoje())]

    def get_alerta(self, o) -> dict | None:
        return alerta(o)

    def get_tempo_restante(self, o) -> dict | None:
        return tempo_restante(o)

    def get_partes(self, o) -> list[str]:
        visiveis = self.context.get("entidades_visiveis", set())
        return [i.entidade.nome_completo if i.entidade_id in visiveis else "—" for i in o.intervenientes.all()]


class AngariacaoSerializer(AngariacaoListaSerializer):
    imovel = serializers.PrimaryKeyRelatedField(queryset=Imovel.objects.ativos())
    operacao = CampoValorLista("operacoes", allow_null=True, required=False)
    regime = CampoValorLista("regimes_cmi", allow_null=True, required=False)
    momento_pagamento = CampoValorLista("momentos_pagamento_comissao", allow_null=True, required=False)
    momento_pagamento_nome = serializers.CharField(source="momento_pagamento.nome", read_only=True, default=None)
    prioridade = CampoValorLista("prioridades", allow_null=True, required=False)
    comercializacao_prevista = CampoValorLista("comercializacao_prevista", allow_null=True, required=False)
    valor_comissao_estimado = serializers.SerializerMethodField()
    imovel_preco = serializers.DecimalField(source="imovel.preco", max_digits=12, decimal_places=2, read_only=True)
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    intervenientes = IntervenienteEscritaSerializer(many=True, required=False, write_only=True)
    intervenientes_detalhe = serializers.SerializerMethodField()
    renovacoes = RenovacaoSerializer(many=True, read_only=True)
    correcoes = serializers.SerializerMethodField()
    nomes = serializers.SerializerMethodField()
    assinado = serializers.BooleanField(read_only=True)
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Angariacao
        fields = [
            "id", "referencia", "numero_contrato", "imovel", "imovel_referencia", "imovel_descricao",
            "operacao", "regime", "data_inicio", "prazo_meses", "data_fim", "data_fim_vigente",
            "situacao", "situacao_motivo", "estado", "estado_nome", "alerta", "tempo_restante", "assinado",
            "prioridade", "comercializacao_prevista", "valor_acm", "valor_vendido", "observacoes_angariacao",
            "imovel_preco", "valor_comissao_estimado",
            "modalidade_remuneracao", "valor_remuneracao", "base_contratual", "valor_minimo_remuneracao",
            "taxa_iva", "remuneracao_inclui_iva", "momento_pagamento", "momento_pagamento_nome", "sinal_valor",
            "sinal_unidade", "condicoes_pagamento",
            "intervenientes", "intervenientes_detalhe", "renovacoes", "correcoes", "imovel_fotografia",
            "responsavel", "responsavel_nome", "observacoes", "nomes",
            "criado_em", "atualizado_em", "versao", "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = [
            "referencia", "data_fim", "data_fim_vigente", "situacao", "situacao_motivo",
            "criado_em", "atualizado_em", "eliminado_em",
        ]  # fmt: skip

    def get_nomes(self, o) -> dict:
        return {
            "operacao": _nome(o.operacao),
            "operacao_categoria": o.operacao.categoria if o.operacao else None,
            "regime": _nome(o.regime),
            "regime_categoria": o.regime.categoria if o.regime else None,
            "modalidade": o.get_modalidade_remuneracao_display() if o.modalidade_remuneracao else None,
            "situacao": o.get_situacao_display(),
            "prioridade": _nome(o.prioridade),
            "comercializacao_prevista": _nome(o.comercializacao_prevista),
        }

    def get_valor_comissao_estimado(self, o) -> str | None:
        v = comissao_estimada(o)
        return None if v is None else str(v)

    def get_intervenientes_detalhe(self, o) -> list[dict]:
        visiveis = self.context.get("entidades_visiveis", set())
        return [
            {
                "entidade": i.entidade_id,
                "acessivel": i.entidade_id in visiveis,
                "nome_completo": i.entidade.nome_completo if i.entidade_id in visiveis else None,
                "referencia": i.entidade.referencia if i.entidade_id in visiveis else None,
                "papel": i.papel_id,
                "papel_nome": _nome(i.papel),
                "quota": None if i.quota is None else str(i.quota),
            }
            for i in o.intervenientes.select_related("entidade", "papel").all()
        ]

    def get_correcoes(self, o) -> list[dict]:
        return [
            {
                "campo": c.campo,
                "valor_anterior": c.valor_anterior,
                "valor_novo": c.valor_novo,
                "motivo": c.motivo,
                "evidencia": c.evidencia,
                "criado_em": c.criado_em,
                "criado_por": c.criado_por.nome,
            }
            for c in o.correcoes.select_related("criado_por").all()
        ]

    def get_acoes(self, o) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(o.pk, {})

    # Validação -------------------------------------------------------------------

    def validate(self, d):
        inst = self.instance
        # Depois de assinado, os dados contratuais só mudam por correção material.
        if inst is not None and inst.assinado:
            for c in CAMPOS_CONTRATUAIS:
                if c in d and d[c] != getattr(inst, c):
                    raise serializers.ValidationError(
                        {c: "O contrato está assinado: este dado só pode ser alterado por correção material."}
                    )
            if "imovel" in d and d["imovel"] != inst.imovel:
                raise serializers.ValidationError({"imovel": "Não é possível mudar o imóvel de um CMI assinado."})

        val = lambda c: d.get(c, getattr(inst, c, None))  # noqa: E731
        inicio, prazo = val("data_inicio"), val("prazo_meses")
        if val("sinal_valor") is not None and not val("sinal_unidade"):
            raise serializers.ValidationError({"sinal_unidade": "Indique se o sinal é em % ou em euros."})
        if val("sinal_unidade") == "percentagem" and (val("sinal_valor") or 0) > CEM:
            raise serializers.ValidationError({"sinal_valor": "A percentagem não pode passar de 100%."})
        operacao = val("operacao") or (val("imovel").operacao if val("imovel") else None)
        modalidade = val("modalidade_remuneracao")
        if modalidade and operacao and operacao.categoria:
            permitidas = Angariacao.MODALIDADES_POR_OPERACAO.get(operacao.categoria, set())
            if modalidade not in permitidas:
                nomes = ", ".join(Angariacao.Modalidade(m).label for m in sorted(permitidas))
                raise serializers.ValidationError({"modalidade_remuneracao": f"Para «{operacao.nome}» use: {nomes}."})
        valor = val("valor_remuneracao")
        if modalidade in (Angariacao.Modalidade.PERCENTAGEM, Angariacao.Modalidade.PERCENTAGEM_BASE) and valor:
            if valor > CEM:
                raise serializers.ValidationError({"valor_remuneracao": "A percentagem não pode passar de 100%."})
        if modalidade == Angariacao.Modalidade.PERCENTAGEM_BASE and not (val("base_contratual") or "").strip():
            raise serializers.ValidationError({"base_contratual": "Identifique a base contratual da percentagem."})
        if valor is not None and not modalidade:
            raise serializers.ValidationError({"modalidade_remuneracao": "Indique a modalidade da remuneração."})

        if inicio and prazo and val("imovel"):
            sonda = inst or Angariacao(imovel=val("imovel"))
            sonda.imovel = val("imovel")
            fim_vigente = inst.data_fim_vigente if inst and inst.renovacoes.exists() else calcular_fim(inicio, prazo)
            choques = conflitos(sonda, inicio, fim_vigente, regime=val("regime"), operacao=operacao)
            if choques:
                raise serializers.ValidationError(
                    {"data_inicio": f"Sobrepõe-se a contrato(s) exclusivo(s): {descrever_conflitos(choques)}."}
                )
        d["_operacao_efetiva"] = operacao
        return d

    def validate_intervenientes(self, lista):
        visiveis = self.context.get("entidades_visiveis", set())
        atuais = set(self.instance.intervenientes.values_list("entidade_id", flat=True)) if self.instance else set()
        vistos = set()
        papeis = set(ValorLista.objects.filter(lista__chave="papeis_interveniente_cmi").values_list("pk", flat=True))
        for i in lista:
            if i["entidade"] in vistos:
                raise serializers.ValidationError("A mesma entidade foi indicada mais do que uma vez.")
            vistos.add(i["entidade"])
            if i["entidade"] not in visiveis and i["entidade"] not in atuais:
                raise serializers.ValidationError("Entidade inexistente ou sem acesso.")
            if i.get("papel") is not None and i["papel"] not in papeis:
                raise serializers.ValidationError("Papel de interveniente inválido.")
        if sum((i.get("quota") or Decimal(0)) for i in lista) > CEM:
            raise serializers.ValidationError("A soma das quotas ultrapassa 100%.")
        return lista

    # Gravação --------------------------------------------------------------------

    def _gravar_intervenientes(self, cmi, lista):
        cmi.intervenientes.exclude(entidade_id__in=[i["entidade"] for i in lista]).delete()
        for ordem, i in enumerate(lista):
            Interveniente.objects.update_or_create(
                angariacao=cmi,
                entidade_id=i["entidade"],
                defaults={"papel_id": i.get("papel"), "quota": i.get("quota"), "ordem": ordem},
            )

    @transaction.atomic
    def create(self, d):
        d.pop("versao", None)
        operacao = d.pop("_operacao_efetiva", None)
        intervenientes = d.pop("intervenientes", None)
        if not d.get("operacao"):
            d["operacao"] = operacao  # por omissão, a operação do imóvel
        cmi = Angariacao(**d)
        cmi.recalcular_datas()
        cmi.save()
        if intervenientes is None:
            # Pré-preenche com os proprietários atuais do imóvel (fotografia própria do contrato).
            papel = ValorLista.objects.filter(
                lista__chave="papeis_interveniente_cmi", nome="Proprietário", ativo=True
            ).first()
            intervenientes = [
                {"entidade": p.entidade_id, "papel": papel.pk if papel else None, "quota": p.quota}
                for p in cmi.imovel.proprietarios.all()
            ]
        self._gravar_intervenientes(cmi, intervenientes)
        return cmi

    @transaction.atomic
    def update(self, cmi, d):
        d.pop("versao", None)
        d.pop("_operacao_efetiva", None)
        intervenientes = d.pop("intervenientes", None)
        for k, v in d.items():
            setattr(cmi, k, v)
        cmi.recalcular_datas()
        cmi.save()
        if intervenientes is not None:
            self._gravar_intervenientes(cmi, intervenientes)
        return cmi


class RenovarSerializer(serializers.Serializer):
    forma = serializers.ChoiceField(choices=Renovacao.Forma.choices)
    data_inicio = serializers.DateField()
    prazo_meses = serializers.IntegerField(min_value=1, max_value=120)
    observacoes = serializers.CharField(required=False, allow_blank=True, max_length=255)


class CorrigirSerializer(serializers.Serializer):
    campo = serializers.ChoiceField(choices=[(c, c) for c in CAMPOS_CONTRATUAIS])
    valor = serializers.CharField()
    motivo = serializers.CharField(max_length=500)
    evidencia = serializers.CharField(max_length=1000)


class SituacaoSerializer(serializers.Serializer):
    situacao = serializers.ChoiceField(choices=Angariacao.Situacao.choices)
    motivo = serializers.CharField(max_length=255)
