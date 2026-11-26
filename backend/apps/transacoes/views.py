from django.db import transaction
from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.angariacoes.models import Angariacao
from apps.configuracao.campos import opcoes_lista
from apps.configuracao.models import ValorLista
from apps.contas.models import Ambito, Operacao
from apps.contas.permissoes import ambito_efetivo
from apps.core.auditoria import registar
from apps.core.vistas import RegistoViewSet
from apps.imoveis.views import entidades_visiveis
from apps.propostas.models import Proposta
from apps.propostas.serializers import descricao_imovel
from apps.visitas.servicos import nome_responsavel

from .models import Transacao
from .serializers import (
    MudarEstadoSerializer,
    TransacaoListaSerializer,
    TransacaoSerializer,
    descricao_cmi,
    propostas_visiveis,
)
from .servicos import aplicar_efeitos, efeitos_propostos, validar_mudanca

SEM_ACESSO = "Entidade a que não tem acesso"


class TransacaoViewSet(RegistoViewSet):
    modulo = "transacoes"
    modelo = Transacao
    nome_registo = "transacao"
    operacoes_extra = {
        **RegistoViewSet.operacoes_extra,
        "previa": Operacao.CONSULTAR,
        "efeitos": Operacao.CONSULTAR,
        "mudar_estado": Operacao.EDITAR,
    }
    campos_auditados = [
        "angariacao_id", "operacao_id", "estado_id", "valor", "sinal_valor", "sinal_unidade", "data_cpcv_prevista",
        "data_cpcv", "data_escritura_prevista", "data_escritura", "responsavel_id", "observacoes",
    ]  # fmt: skip

    def get_serializer_class(self):
        return TransacaoListaSerializer if self.action == "list" else TransacaoSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["entidades_visiveis"] = entidades_visiveis(self.request.user)
        return ctx

    def base_queryset(self):
        return Transacao.objects.select_related(
            "entidade", "imovel__tipo", "imovel__tipologia", "estado", "operacao", "responsavel", "proposta",
            "angariacao", "agente_comprador__agencia", "agente_imovel__agencia", "consultor_comprador",
            "consultor_imovel",
        )  # fmt: skip

    def filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            qs = qs.filter(
                Q(referencia__iexact=termo)
                | Q(entidade__nome_completo__unaccent__icontains=termo)
                | Q(imovel__referencia__icontains=termo)
                | Q(imovel__localidade__unaccent__icontains=termo)
                | Q(imovel_descricao__unaccent__icontains=termo)
                | Q(proposta__referencia__iexact=termo)
            )
        for parametro, campo in (
            ("estado", "estado_id"), ("entidade", "entidade_id"), ("imovel", "imovel_id"), ("proposta", "proposta_id"),
            ("angariacao", "angariacao_id"),
        ):  # fmt: skip
            if p.get(parametro):
                qs = qs.filter(**{campo: p[parametro]})
        if p.get("categoria") == "em_curso":
            qs = qs.exclude(estado__categoria__in=("concluida", "cancelada"))
        elif p.get("categoria"):
            qs = qs.filter(estado__categoria=p["categoria"])
        return qs.order_by("-criado_em", "-id")

    @extend_schema(
        parameters=[
            OpenApiParameter(n, str)
            for n in ("pesquisa", "estado", "categoria", "entidade", "imovel", "proposta", "angariacao")
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.estado and obj.estado.categoria == "concluida":
            raise serializers.ValidationError(
                {"detail": "Uma transação concluída não vai para a lixeira. Reabra-a ou cancele-a primeiro."}
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response(
            {
                "estados": opcoes_lista("estados_transacao"),
                "operacoes": opcoes_lista("operacoes"),
                "papeis": opcoes_lista("papeis_participante"),
                "unidades": [{"valor": v, "nome": n} for v, n in Transacao.Unidade.choices],
                "tipos_interacao": opcoes_lista("tipos_interacao"),
                **self.permissoes_gerais(request),
            }
        )

    @extend_schema(parameters=[OpenApiParameter("proposta", int, required=True)])
    @action(detail=False, methods=["get"])
    def previa(self, request):
        """«Gerar Transação» (Q12/AT-09): dados pré-preenchidos a partir de uma proposta aceite. NÃO grava nada."""
        if ambito_efetivo(request.user, self.modulo, Operacao.CRIAR) == Ambito.NENHUM:
            raise PermissionDenied("Não tem permissão para criar transações.")
        try:
            p = (
                propostas_visiveis(request.user)
                .select_related("entidade", "imovel__tipo", "imovel__tipologia", "imovel__operacao", "estado")
                .get(pk=int(request.query_params.get("proposta", 0)))
            )
        except (Proposta.DoesNotExist, ValueError):
            return Response({"detail": "Proposta inexistente ou sem acesso."}, status=status.HTTP_404_NOT_FOUND)
        existente = Transacao.objects.ativos().filter(proposta=p).first()
        if existente:
            return Response(
                {"detail": f"Esta proposta já deu origem à transação {existente.referencia}.", "codigo": "ja_existe",
                 "transacao": existente.pk},
                status=status.HTTP_409_CONFLICT,
            )  # fmt: skip
        if not p.estado or p.estado.categoria != "aceite":
            return Response(
                {"detail": "Só uma proposta aceite pode gerar uma transação.", "codigo": "nao_aceite"},
                status=status.HTTP_409_CONFLICT,
            )
        ultima = p.ultima_ronda
        visiveis = entidades_visiveis(request.user)
        cmis = []
        if p.imovel_id:
            cmis = [
                {
                    "id": c.pk,
                    "descricao": descricao_cmi(c),
                    "em_curso": c.situacao == Angariacao.Situacao.EM_CURSO,
                    "operacao": c.operacao_id,
                }
                for c in Angariacao.objects.ativos().filter(imovel_id=p.imovel_id).order_by("-criado_em")
            ]
        em_curso = [c for c in cmis if c["em_curso"]]
        return Response(
            {
                "proposta": p.pk,
                "proposta_referencia": p.referencia,
                "imovel": p.imovel_id,
                "imovel_descricao_completa": descricao_imovel(p),
                "entidade": p.entidade_id,
                "entidade_nome": p.entidade.nome_completo if p.entidade_id in visiveis else SEM_ACESSO,
                "responsavel_imovel_nome": nome_responsavel(p.consultor_imovel, p.agente_imovel),
                "responsavel_comprador_nome": nome_responsavel(p.consultor_comprador, p.agente_comprador),
                "cmis": cmis,
                # Sugestão: o único CMI em curso. A escolha continua a ser expressa (o utilizador confirma).
                "cmi_sugerido": em_curso[0]["id"] if len(em_curso) == 1 else None,
                "operacao": (p.imovel.operacao_id if p.imovel_id else None),
                "valor": None if ultima is None else str(ultima.valor),
                "sinal_valor": None if ultima is None or ultima.sinal_valor is None else str(ultima.sinal_valor),
                "sinal_unidade": ultima.sinal_unidade if ultima else "",
                "data_cpcv_prevista": ultima.data_cpcv if ultima else None,
                "data_escritura_prevista": ultima.data_escritura if ultima else None,
                "participantes": [
                    {
                        "entidade": x.entidade_id,
                        "nome": x.entidade.nome_completo if x.entidade_id in visiveis else SEM_ACESSO,
                        "papel": x.papel_id,
                        "quota": None if x.quota is None else str(x.quota),
                    }
                    for x in p.participantes.select_related("entidade")
                ],
            }
        )

    @extend_schema(parameters=[OpenApiParameter("estado", int, required=True)])
    @action(detail=True, methods=["get"])
    def efeitos(self, request, pk=None):
        """Efeitos que se propõem para a mudança para o estado indicado (nada é alterado)."""
        t = self.get_object()
        nova = ValorLista.objects.filter(
            lista__chave="estados_transacao", pk=request.query_params.get("estado")
        ).first()
        if nova is None:
            return Response({"detail": "Estado inválido."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(efeitos_propostos(t, nova.categoria, request.user))

    @extend_schema(request=MudarEstadoSerializer)
    @action(detail=True, methods=["post"], url_path="mudar-estado")
    def mudar_estado(self, request, pk=None):
        """Muda o estado e aplica só os efeitos confirmados (F3-06). Tudo ou nada."""
        s = MudarEstadoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        with transaction.atomic():
            t = Transacao.objects.select_for_update().get(pk=self.get_object().pk)
            if not d["estado"].ativo:
                raise serializers.ValidationError({"estado": "Estado desativado."})
            cat = validar_mudanca(t, d["estado"], d)
            antes = t.estado.nome if t.estado else None
            aplicar_efeitos(t, cat, d["efeitos"], request.user, request=request)
            for c in ("data_cpcv", "data_escritura", "data_escritura_prevista"):
                if c in d:
                    setattr(t, c, d[c])
            t.estado = d["estado"]
            t.motivo_estado = d.get("motivo", "")
            t.atualizado_por = request.user
            t.save()
            registar(
                "transacao.estado",
                modulo=self.modulo,
                objeto=t,
                request=request,
                dados={"de": antes, "para": t.estado.nome, "motivo": t.motivo_estado, "efeitos": d["efeitos"]},
            )
        return Response(self.get_serializer(self.recarregar(t)).data)
