from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.contas.models import Utilizador
from apps.transacoes.models import Transacao
from apps.visitas.servicos import nome_responsavel

from .models import Beneficiario, Comissao, ExcecaoComissao
from .servicos import beneficiarios_propostos, fotografia, lados_nossos, pct_angariacao_omissao, resumo

CEM = Decimal(100)


def _dinheiro(v):
    return None if v is None else str(v)


class BeneficiarioSerializer(serializers.ModelSerializer):
    utilizador = serializers.PrimaryKeyRelatedField(queryset=Utilizador.objects.all())
    utilizador_nome = serializers.CharField(source="utilizador.nome", read_only=True)
    valor = serializers.SerializerMethodField()

    class Meta:
        model = Beneficiario
        fields = ["id", "lado", "utilizador", "utilizador_nome", "modo", "percentagem", "deducao", "valor"]
        read_only_fields = ["id"]

    def get_valor(self, b) -> str | None:
        return _dinheiro(b.valor)

    def validate(self, d):
        if d.get("modo") == Beneficiario.Modo.PERCENTAGEM:
            d["deducao"] = None
        elif d.get("modo") == Beneficiario.Modo.DEDUCAO:
            d["percentagem"] = None
        return d


class ExcecaoSerializer(serializers.ModelSerializer):
    requerente_nome = serializers.CharField(source="requerente.nome", read_only=True)
    decidido_por_nome = serializers.CharField(source="decidido_por.nome", read_only=True, default=None)
    estado_nome = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = ExcecaoComissao
        fields = [
            "id", "valor_original", "valor_proposto", "motivo", "requerente_nome", "criado_em", "estado",
            "estado_nome", "decidido_por_nome", "decidido_em", "motivo_decisao",
        ]  # fmt: skip


class ComissaoListaSerializer(serializers.ModelSerializer):
    transacao_referencia = serializers.CharField(source="transacao.referencia", read_only=True)
    transacao_estado = serializers.CharField(source="transacao.estado.nome", read_only=True, default=None)
    imovel_descricao = serializers.SerializerMethodField()
    comprador_nome = serializers.SerializerMethodField()
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)
    total_nosso = serializers.SerializerMethodField()
    excecao_pendente = serializers.SerializerMethodField()

    class Meta:
        model = Comissao
        fields = [
            "id", "referencia", "transacao", "transacao_referencia", "transacao_estado", "imovel_descricao",
            "comprador_nome", "valor_final", "origem", "lado_angariacao_nosso", "lado_venda_nosso", "total_nosso",
            "excecao_pendente", "responsavel_nome", "criado_em",
        ]  # fmt: skip

    def get_imovel_descricao(self, c) -> str:
        from apps.propostas.serializers import descricao_imovel

        return descricao_imovel(c.transacao)

    def get_comprador_nome(self, c) -> str | None:
        t = c.transacao
        return t.entidade.nome_completo if t.entidade_id in self.context.get("entidades_visiveis", set()) else None

    def get_total_nosso(self, c) -> str | None:
        return resumo(c)["total_nosso"]

    def get_excecao_pendente(self, c) -> bool:
        return any(e.estado == ExcecaoComissao.Estado.PENDENTE for e in c.excecoes.all())


class ComissaoSerializer(ComissaoListaSerializer):
    transacao = serializers.PrimaryKeyRelatedField(queryset=Transacao.objects.ativos())
    beneficiarios = BeneficiarioSerializer(many=True, required=False)
    excecoes = ExcecaoSerializer(many=True, read_only=True)
    origem_nome = serializers.CharField(source="get_origem_display", read_only=True)
    modalidade_nome = serializers.SerializerMethodField()
    iva = serializers.SerializerMethodField()
    total_com_iva = serializers.SerializerMethodField()
    resumo = serializers.SerializerMethodField()
    operacao_categoria = serializers.CharField(source="transacao.operacao.categoria", read_only=True, default=None)
    responsavel_imovel_nome = serializers.SerializerMethodField()
    responsavel_comprador_nome = serializers.SerializerMethodField()
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    prestacoes = serializers.SerializerMethodField()
    pagamentos_consultores = serializers.SerializerMethodField()
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Comissao
        fields = [
            *ComissaoListaSerializer.Meta.fields, "cmi_referencia", "cmi_versao", "modalidade", "modalidade_nome",
            "taxa_ou_valor", "base_negocio", "minimo", "taxa_iva", "inclui_iva", "valor_calculado", "origem_nome",
            "iva", "total_com_iva", "pct_angariacao", "resumo", "operacao_categoria", "responsavel_imovel_nome",
            "responsavel_comprador_nome", "beneficiarios", "excecoes", "prestacoes", "pagamentos_consultores",
            "responsavel", "observacoes",
            "atualizado_em", "versao", "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = [
            "referencia", "cmi_referencia", "cmi_versao", "modalidade", "taxa_ou_valor", "base_negocio", "minimo",
            "taxa_iva", "inclui_iva", "valor_calculado", "origem", "criado_em", "atualizado_em", "eliminado_em",
        ]  # fmt: skip

    def get_modalidade_nome(self, c) -> str | None:
        from apps.angariacoes.models import Angariacao

        return dict(Angariacao.Modalidade.choices).get(c.modalidade) if c.modalidade else None

    def get_iva(self, c) -> str | None:
        return _dinheiro(c.iva)

    def get_total_com_iva(self, c) -> str | None:
        return None if c.iva is None else str(c.valor_final + c.iva)

    def get_resumo(self, c) -> dict:
        return resumo(c)

    def get_responsavel_imovel_nome(self, c) -> str | None:
        t = c.transacao
        return nome_responsavel(t.consultor_imovel, t.agente_imovel)

    def get_responsavel_comprador_nome(self, c) -> str | None:
        t = c.transacao
        return nome_responsavel(t.consultor_comprador, t.agente_comprador)

    def get_acoes(self, c) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(c.pk, {})

    def get_prestacoes(self, c) -> list[dict]:
        from apps.faturacao.serializers import PrestacaoSerializer

        return PrestacaoSerializer(c.prestacoes.select_related("utilizador"), many=True).data

    def get_pagamentos_consultores(self, c) -> list[dict]:
        """D-49: por consultor, quanto recebe da comissão, quanto já faturou à agência e quanto foi pago."""
        from apps.faturacao.servicos import resumo_consultores

        return resumo_consultores(c)

    # Validação ------------------------------------------------------------------

    def validate_transacao(self, t):
        if self.instance is not None:
            if t.pk != self.instance.transacao_id:
                raise serializers.ValidationError("A transação não pode ser mudada.")
            return t
        if t.pk not in self.context.get("transacoes_visiveis", set()):
            raise serializers.ValidationError("Transação inexistente ou sem acesso.")
        if t.estado and t.estado.categoria == "cancelada":
            raise serializers.ValidationError("A transação está cancelada.")
        if Comissao.objects.filter(transacao=t).exists():
            raise serializers.ValidationError("Esta transação já tem comissão.")
        return t

    def validate(self, d):
        inst = self.instance
        if "valor_final" in self.initial_data:
            # Só se indica à mão quando não há cálculo possível; mudar um valor calculado é uma exceção (Q13).
            calculado = inst.valor_calculado if inst else None
            if calculado is not None:
                raise serializers.ValidationError(
                    {"valor_final": "O valor foi calculado a partir do CMI. Para o mudar, peça uma exceção."}
                )
            valor = self.initial_data.get("valor_final")
            if valor in (None, ""):
                d["valor_final"] = None
            else:
                try:
                    d["valor_final"] = Decimal(str(valor).replace(",", ".")).quantize(Decimal("0.01"))
                except Exception as e:  # noqa: BLE001
                    raise serializers.ValidationError({"valor_final": "Valor inválido."}) from e
                if d["valor_final"] < 0:
                    raise serializers.ValidationError({"valor_final": "O valor não pode ser negativo."})
        lado_ang = d.get("lado_angariacao_nosso", getattr(inst, "lado_angariacao_nosso", None))
        lado_venda = d.get("lado_venda_nosso", getattr(inst, "lado_venda_nosso", None))
        for b in d.get("beneficiarios", []) or []:
            nosso = lado_ang if b["lado"] == Beneficiario.Lado.ANGARIACAO else lado_venda
            if inst is not None and not nosso:
                raise serializers.ValidationError(
                    {"beneficiarios": "Só se indicam consultores nos lados que são nossos."}
                )
        return d

    # Gravação -------------------------------------------------------------------

    def _gravar_beneficiarios(self, c, linhas):
        c.beneficiarios.all().delete()
        for ordem, b in enumerate(linhas):
            Beneficiario.objects.create(comissao=c, ordem=ordem, **{k: v for k, v in b.items() if k != "id"})
        # Os consultores não podem receber mais do que o lado (centimos certos, D-48).
        c.refresh_from_db()
        for lado, r in resumo(c).items():
            if isinstance(r, dict) and r["agencia"] is not None and Decimal(r["agencia"]) < 0:
                raise serializers.ValidationError(
                    {"beneficiarios": f"Os consultores recebem mais do que o lado da {lado}. Reveja os valores."}
                )

    @transaction.atomic
    def create(self, d):
        d.pop("versao", None)
        d.pop("beneficiarios", None)
        t = Transacao.objects.select_for_update().get(pk=d["transacao"].pk)
        if Comissao.objects.filter(transacao=t).exists():
            raise serializers.ValidationError({"transacao": "Esta transação já tem comissão."})
        base = fotografia(t)
        ang, venda = lados_nossos(t)
        c = Comissao.objects.create(
            **d,
            **base,
            valor_final=base["valor_calculado"],
            origem=Comissao.Origem.CALCULADO,
            pct_angariacao=pct_angariacao_omissao(),
            lado_angariacao_nosso=ang,
            lado_venda_nosso=venda,
        )
        self._gravar_beneficiarios(c, beneficiarios_propostos(t, ang, venda))
        return c

    @transaction.atomic
    def update(self, c, d):
        d.pop("versao", None)
        linhas = d.pop("beneficiarios", None)
        if "valor_final" in d:
            c.origem = Comissao.Origem.MANUAL
        for k, v in d.items():
            setattr(c, k, v)
        # Lados que deixam de ser nossos perdem os consultores.
        if linhas is None:
            linhas = [
                {"lado": b.lado, "utilizador": b.utilizador, "modo": b.modo, "percentagem": b.percentagem,
                 "deducao": b.deducao}
                for b in c.beneficiarios.all()
            ]  # fmt: skip
        linhas = [b for b in linhas if c.lado_nosso(b["lado"])]
        c.save()
        self._gravar_beneficiarios(c, linhas)
        return c


class PedidoExcecaoSerializer(serializers.Serializer):
    valor_proposto = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal(0))
    motivo = serializers.CharField(max_length=2000)

    def validate_motivo(self, v):
        if not v.strip():
            raise serializers.ValidationError("Explique o motivo da exceção.")
        return v.strip()


class DecisaoSerializer(serializers.Serializer):
    aprovar = serializers.BooleanField()
    motivo = serializers.CharField(max_length=2000, allow_blank=True, required=False, default="")
