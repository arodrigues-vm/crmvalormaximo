from decimal import Decimal

from rest_framework import serializers

from apps.comissoes.models import Comissao, arred
from apps.configuracao.campos import CampoValorLista
from apps.contas.models import Utilizador

from .models import DocumentoConsultor, Movimento, Prestacao
from .servicos import estornavel, saldo_documento


class PrestacaoSerializer(serializers.ModelSerializer):
    utilizador = serializers.PrimaryKeyRelatedField(queryset=Utilizador.objects.all())
    utilizador_nome = serializers.CharField(source="utilizador.nome", read_only=True)
    momento_nome = serializers.CharField(source="get_momento_display", read_only=True)

    class Meta:
        model = Prestacao
        fields = ["id", "utilizador", "utilizador_nome", "momento", "momento_nome", "percentagem", "valor",
                  "data_prevista"]  # fmt: skip
        read_only_fields = ["id"]


class MovimentoSerializer(serializers.ModelSerializer):
    tipo_nome = serializers.CharField(source="get_tipo_display", read_only=True)
    estado_nome = serializers.CharField(source="get_estado_display", read_only=True)
    meio_nome = serializers.CharField(source="meio.nome", read_only=True, default=None)
    criado_por_nome = serializers.CharField(source="criado_por.nome", read_only=True)
    decidido_por_nome = serializers.CharField(source="decidido_por.nome", read_only=True, default=None)
    estornavel = serializers.SerializerMethodField()

    class Meta:
        model = Movimento
        fields = [
            "id", "tipo", "tipo_nome", "estado", "estado_nome", "data_efetiva", "registado_em", "valor", "meio",
            "meio_nome", "referencia_pagamento", "estorno_de", "motivo", "criado_por_nome", "decidido_por_nome",
            "decidido_em", "motivo_decisao", "estornavel",
        ]  # fmt: skip

    def get_estornavel(self, m) -> str | None:
        if m.tipo != Movimento.Tipo.PAGAMENTO or m.estado != Movimento.Estado.EFETIVO:
            return None
        return str(estornavel(m))


class DocumentoListaSerializer(serializers.ModelSerializer):
    consultor_nome = serializers.CharField(source="consultor.nome", read_only=True)
    tipo_nome = serializers.CharField(source="tipo.nome", read_only=True, default=None)
    tipo_categoria = serializers.CharField(source="tipo.categoria", read_only=True, default=None)
    comissao_referencia = serializers.CharField(source="comissao.referencia", read_only=True)
    transacao_referencia = serializers.CharField(source="comissao.transacao.referencia", read_only=True)
    saldo = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoConsultor
        fields = [
            "id", "referencia", "comissao", "comissao_referencia", "transacao_referencia", "consultor",
            "consultor_nome", "tipo", "tipo_nome", "tipo_categoria", "serie", "numero", "data_emissao", "base",
            "iva", "retencao", "total", "saldo", "criado_em",
        ]  # fmt: skip

    def get_saldo(self, d) -> dict:
        return saldo_documento(d)


class DocumentoSerializer(DocumentoListaSerializer):
    comissao = serializers.PrimaryKeyRelatedField(queryset=Comissao.objects.ativos())
    consultor = serializers.PrimaryKeyRelatedField(queryset=Utilizador.objects.all())
    prestacao = serializers.PrimaryKeyRelatedField(queryset=Prestacao.objects.all(), allow_null=True, required=False)
    tipo = CampoValorLista("tipos_documento_consultor")
    documento_original = serializers.PrimaryKeyRelatedField(
        queryset=DocumentoConsultor.objects.ativos(), allow_null=True, required=False
    )
    documento_original_referencia = serializers.CharField(
        source="documento_original.referencia", read_only=True, default=None
    )
    prestacao_descricao = serializers.SerializerMethodField()
    iva = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal(0), required=False)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    movimentos = MovimentoSerializer(many=True, read_only=True)
    responsavel = serializers.PrimaryKeyRelatedField(queryset=Utilizador.objects.all(), required=False)
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoConsultor
        fields = [
            *DocumentoListaSerializer.Meta.fields, "prestacao", "prestacao_descricao", "taxa_iva",
            "documento_original", "documento_original_referencia", "movimentos", "responsavel", "observacoes",
            "atualizado_em", "versao", "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = ["referencia", "criado_em", "atualizado_em", "eliminado_em"]
        validators = []  # o controlo de duplicados faz-se em validate() (a restrição é condicional)

    def get_prestacao_descricao(self, d) -> str | None:
        p = d.prestacao
        return f"{p.get_momento_display()} · {p.valor:.2f} €".replace(".", ",") if p else None

    def get_acoes(self, d) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(d.pk, {})

    def validate(self, d):
        inst = self.instance
        val = lambda c: d.get(c, getattr(inst, c, None))  # noqa: E731
        if inst is not None and inst.movimentos.exists():
            # Com pagamentos registados, os valores ficam fixos: corrige-se com uma nota de crédito.
            for c in ("comissao", "consultor", "tipo", "base", "taxa_iva", "iva", "retencao", "documento_original"):
                if c in d and d[c] != getattr(inst, c):
                    raise serializers.ValidationError(
                        {c: "Este documento já tem pagamentos: os valores não mudam. Registe uma nota de crédito."}
                    )
        comissao, consultor = val("comissao"), val("consultor")
        if inst is None and comissao.pk not in self.context.get("comissoes_editaveis", set()):
            raise serializers.ValidationError({"comissao": "Comissão inexistente ou sem permissão."})
        if not comissao.beneficiarios.filter(utilizador=consultor).exists():
            raise serializers.ValidationError({"consultor": "Este consultor não recebe parte desta comissão."})
        prestacao = val("prestacao")
        if prestacao is not None and (prestacao.comissao_id != comissao.pk or prestacao.utilizador_id != consultor.pk):
            raise serializers.ValidationError({"prestacao": "A prestação tem de ser deste consultor e desta comissão."})
        tipo, original = val("tipo"), val("documento_original")
        if tipo.categoria == "credito":
            if original is None:
                raise serializers.ValidationError(
                    {"documento_original": "Indique o documento que a nota de crédito retifica."}
                )
            if original.consultor_id != consultor.pk or original.comissao_id != comissao.pk:
                raise serializers.ValidationError(
                    {"documento_original": "Tem de ser um documento deste consultor e comissão."}
                )
        elif original is not None:
            d["documento_original"] = None
        repetidos = DocumentoConsultor.objects.ativos().filter(
            consultor=consultor, tipo=tipo, serie=val("serie") or "", numero=val("numero")
        )
        if inst is not None:
            repetidos = repetidos.exclude(pk=inst.pk)
        if repetidos.exists():
            raise serializers.ValidationError(
                {"numero": "Este documento já está registado (mesmo consultor, tipo, série e número)."}
            )
        base, taxa = val("base"), val("taxa_iva")
        if "iva" not in d and ("base" in d or "taxa_iva" in d or inst is None):
            d["iva"] = arred(base * taxa / Decimal(100)) if taxa is not None else Decimal(0)
        iva, retencao = d.get("iva", val("iva")), val("retencao") or Decimal(0)
        d["total"] = base + iva
        if retencao > d["total"]:
            raise serializers.ValidationError({"retencao": "A retenção não pode ser maior do que o total."})
        return d

    def create(self, d):
        d.pop("versao", None)
        return DocumentoConsultor.objects.create(**d)

    def update(self, inst, d):
        d.pop("versao", None)
        for k, v in d.items():
            setattr(inst, k, v)
        inst.save()
        return inst


class PagamentoSerializer(serializers.Serializer):
    data_efetiva = serializers.DateField()
    valor = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    meio = CampoValorLista("meios_pagamento", allow_null=True, required=False)
    referencia_pagamento = serializers.CharField(max_length=60, allow_blank=True, required=False, default="")


class EstornoSerializer(serializers.Serializer):
    pagamento = serializers.IntegerField()
    valor = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    motivo = serializers.CharField(max_length=2000)
    data_efetiva = serializers.DateField()


class DecisaoSerializer(serializers.Serializer):
    aprovar = serializers.BooleanField()
    motivo = serializers.CharField(max_length=2000, allow_blank=True, required=False, default="")
