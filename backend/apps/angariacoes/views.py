from datetime import date, timedelta

from django.db import transaction
from django.db.models import Prefetch, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.configuracao.campos import opcoes_lista
from apps.configuracao.models import parametro
from apps.contas.models import Operacao
from apps.core.auditoria import registar
from apps.core.vistas import RegistoViewSet
from apps.imoveis.views import entidades_visiveis

from .models import ESTADOS, Angariacao, CorrecaoMaterial, Interveniente, Renovacao, calcular_fim
from .serializers import (
    AngariacaoListaSerializer,
    AngariacaoSerializer,
    CorrigirSerializer,
    RenovarSerializer,
    SituacaoSerializer,
)
from .servicos import conflitos, descrever_conflitos, filtro_estado, hoje

ORDENACOES = {"recentes": "-criado_em", "fim": "data_fim_vigente", "referencia": "id"}
NOMES_CAMPOS = {"data_inicio": "Data de início", "prazo_meses": "Prazo"}


class AngariacaoViewSet(RegistoViewSet):
    modulo = "angariacoes"
    modelo = Angariacao
    nome_registo = "angariacao"
    operacoes_extra = {
        **RegistoViewSet.operacoes_extra,
        "renovar": Operacao.EDITAR,
        # D-28: correção excecional e reabertura por quem pode editar o CMI (com motivo e registo).
        "corrigir": Operacao.EDITAR,
        "situacao": Operacao.EDITAR,
    }
    campos_auditados = [
        "imovel_id", "numero_contrato", "operacao_id", "regime_id", "data_inicio", "prazo_meses",
        "data_fim", "data_fim_vigente", "situacao", "modalidade_remuneracao", "valor_remuneracao", "base_contratual",
        "valor_minimo_remuneracao", "taxa_iva", "remuneracao_inclui_iva", "momento_pagamento_id", "sinal_valor",
        "sinal_unidade", "condicoes_pagamento", "responsavel_id",
        "observacoes",
    ]  # fmt: skip

    def get_serializer_class(self):
        return AngariacaoListaSerializer if self.action == "list" else AngariacaoSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["entidades_visiveis"] = entidades_visiveis(self.request.user)
        return ctx

    def base_queryset(self):
        return Angariacao.objects.select_related(
            "imovel__tipo", "imovel__tipologia", "operacao", "regime", "responsavel", "momento_pagamento"
        ).prefetch_related(
            "renovacoes__criado_por",
            Prefetch("intervenientes", queryset=Interveniente.objects.select_related("entidade", "papel")),
        )

    def filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            qs = qs.filter(
                Q(referencia__iexact=termo)
                | Q(numero_contrato__icontains=termo)
                | Q(imovel__referencia__iexact=termo)
                | Q(imovel__localidade__unaccent__icontains=termo)
                | Q(intervenientes__entidade__nome_completo__unaccent__icontains=termo)
            ).distinct()
        if p.get("estado"):
            qs = filtro_estado(qs, p["estado"])
        for parametro_, campo in (("imovel", "imovel_id"), ("regime", "regime_id"), ("operacao", "operacao_id")):
            if p.get(parametro_):
                qs = qs.filter(**{campo: p[parametro_]})
        return qs.order_by(ORDENACOES.get(p.get("ordenar", "recentes"), "-criado_em"), "-id")

    @extend_schema(
        parameters=[
            OpenApiParameter("pesquisa", str),
            OpenApiParameter(
                "estado",
                str,
                enum=["por_assinar", "vigentes", "a_expirar", "expiradas", "concluidas", "canceladas"],
            ),
            OpenApiParameter("imovel", int),
            OpenApiParameter("regime", int),
            OpenApiParameter("operacao", int),
            OpenApiParameter("ordenar", str, enum=list(ORDENACOES)),
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        # O imóvel tem de estar acessível ao utilizador.
        from apps.contas.permissoes import filtrar
        from apps.imoveis.models import Imovel

        imovel_id = request.data.get("imovel")
        visiveis = filtrar(
            request.user, "imoveis", Operacao.CONSULTAR, Imovel.objects.ativos(), campo_partilhas="partilhada_com"
        )
        if imovel_id and not visiveis.filter(pk=imovel_id).exists():
            raise serializers.ValidationError({"imovel": "Imóvel inexistente ou sem acesso."})
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response(
            {
                "operacoes": opcoes_lista("operacoes"),
                "regimes": opcoes_lista("regimes_cmi"),
                "momentos_pagamento": opcoes_lista("momentos_pagamento_comissao"),
                "papeis": opcoes_lista("papeis_interveniente_cmi"),
                "modalidades": [{"valor": v, "nome": n} for v, n in Angariacao.Modalidade.choices],
                "modalidades_por_operacao": {k: sorted(v) for k, v in Angariacao.MODALIDADES_POR_OPERACAO.items()},
                "formas_renovacao": [{"valor": v, "nome": n} for v, n in Renovacao.Forma.choices],
                "situacoes": [{"valor": v, "nome": n} for v, n in Angariacao.Situacao.choices],
                "estados": ESTADOS,
                "alertas_dias": parametro("cmi_alertas_dias"),
                **self.permissoes_gerais(request),
            }
        )

    # Renovação -----------------------------------------------------------------------

    @extend_schema(request=RenovarSerializer)
    @action(detail=True, methods=["post"])
    def renovar(self, request, pk=None):
        s = RenovarSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        with transaction.atomic():
            cmi = Angariacao.objects.select_for_update().get(pk=self.get_object().pk)
            if not cmi.assinado:
                raise serializers.ValidationError({"detail": "Só é possível renovar um CMI assinado."})
            if cmi.situacao != Angariacao.Situacao.EM_CURSO:
                raise serializers.ValidationError({"detail": "Só é possível renovar um CMI em curso."})
            if d["data_inicio"] <= cmi.data_fim_vigente:
                raise serializers.ValidationError(
                    {
                        "data_inicio": "A renovação tem de começar depois do fim do ciclo atual "
                        f"({cmi.data_fim_vigente:%d/%m/%Y})."
                    }
                )
            fim = calcular_fim(d["data_inicio"], d["prazo_meses"])
            choques = conflitos(cmi, d["data_inicio"], fim)
            if choques:
                raise serializers.ValidationError(
                    {"data_inicio": f"Sobrepõe-se a contrato(s) exclusivo(s): {descrever_conflitos(choques)}."}
                )
            ciclo = cmi.renovacoes.count() + 2
            r = Renovacao.objects.create(angariacao=cmi, ciclo=ciclo, criado_por=request.user, **d)
            cmi.recalcular_datas()
            cmi.atualizado_por = request.user
            cmi.save()
            registar(
                "angariacao.renovada",
                modulo=self.modulo,
                objeto=cmi,
                request=request,
                dados={"ciclo": ciclo, "inicio": str(r.data_inicio), "fim": str(r.data_fim), "forma": r.forma},
            )
        return Response(self.get_serializer(self.recarregar(cmi)).data, status=status.HTTP_201_CREATED)

    # Correção material ----------------------------------------------------------------

    @extend_schema(request=CorrigirSerializer)
    @action(detail=True, methods=["post"])
    def corrigir(self, request, pk=None):
        """Correção excecional de um erro de registo nos dados contratuais (não é uma alteração
        do contrato). Exige permissão de edição do CMI, motivo e evidência; fica auditada (D-28)."""
        s = CorrigirSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        campo = d["campo"]
        try:
            novo = int(d["valor"]) if campo == "prazo_meses" else date.fromisoformat(d["valor"])
        except ValueError as e:
            raise serializers.ValidationError({"valor": "Valor inválido."}) from e
        if campo == "prazo_meses" and not 1 <= novo <= 120:
            raise serializers.ValidationError({"valor": "O prazo tem de estar entre 1 e 120 meses."})
        with transaction.atomic():
            cmi = Angariacao.objects.select_for_update().get(pk=self.get_object().pk)
            if not cmi.assinado:
                raise serializers.ValidationError(
                    {"detail": "Antes da assinatura, altere os dados pela edição normal."}
                )
            anterior = getattr(cmi, campo)
            if anterior == novo:
                raise serializers.ValidationError({"valor": "O valor é igual ao atual."})
            setattr(cmi, campo, novo)
            fim_inicial = calcular_fim(cmi.data_inicio, cmi.prazo_meses)
            primeira = cmi.renovacoes.order_by("ciclo").first()
            if primeira and fim_inicial >= primeira.data_inicio:
                raise serializers.ValidationError(
                    {
                        "valor": f"Com esta correção, o ciclo inicial ultrapassaria o início da 1.ª renovação "
                        f"({primeira.data_inicio:%d/%m/%Y})."
                    }  # fmt: skip
                )
            cmi.recalcular_datas()
            choques = conflitos(cmi, cmi.data_inicio, cmi.data_fim_vigente)
            if choques:
                raise serializers.ValidationError(
                    {"valor": f"Sobrepõe-se a contrato(s) exclusivo(s): {descrever_conflitos(choques)}."}
                )
            cmi.atualizado_por = request.user
            cmi.save()
            CorrecaoMaterial.objects.create(
                angariacao=cmi,
                campo=campo,
                valor_anterior=str(anterior),
                valor_novo=str(novo),
                motivo=d["motivo"],
                evidencia=d["evidencia"],
                criado_por=request.user,
            )
            registar(
                "angariacao.correcao_material",
                modulo=self.modulo,
                objeto=cmi,
                request=request,
                dados={"campo": campo, "antes": str(anterior), "depois": str(novo), "motivo": d["motivo"]},
            )
        return Response(self.get_serializer(self.recarregar(cmi)).data)

    # Situação (concluir, cancelar, reabrir) -----------------------------------------------

    @extend_schema(request=SituacaoSerializer)
    @action(detail=True, methods=["post"])
    def situacao(self, request, pk=None):
        s = SituacaoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        nova = s.validated_data["situacao"]
        with transaction.atomic():
            cmi = Angariacao.objects.select_for_update().get(pk=self.get_object().pk)
            if cmi.situacao == nova:
                raise serializers.ValidationError({"situacao": "O CMI já está nesta situação."})
            if nova == Angariacao.Situacao.EM_CURSO:
                # Reabrir (D-28): permissão de edição (já verificada) e sem criar sobreposições.
                if cmi.data_inicio and cmi.data_fim_vigente:
                    choques = conflitos(cmi, cmi.data_inicio, cmi.data_fim_vigente)
                    if choques:
                        raise serializers.ValidationError(
                            {"situacao": f"Sobrepõe-se a contrato(s) exclusivo(s): {descrever_conflitos(choques)}."}
                        )
            antes = cmi.situacao
            cmi.situacao = nova
            cmi.situacao_motivo = s.validated_data["motivo"]
            cmi.atualizado_por = request.user
            cmi.save()
            registar(
                "angariacao.situacao",
                modulo=self.modulo,
                objeto=cmi,
                request=request,
                dados={"de": antes, "para": nova, "motivo": cmi.situacao_motivo},
            )
        return Response(self.get_serializer(self.recarregar(cmi)).data)


def proximo_inicio(cmi: Angariacao):
    return cmi.data_fim_vigente + timedelta(days=1) if cmi.data_fim_vigente else hoje()
