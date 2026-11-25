from django.db import transaction
from django.db.models import Max, Prefetch, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.configuracao.campos import opcoes_lista
from apps.configuracao.models import ValorLista
from apps.contas.models import Ambito, Operacao
from apps.contas.permissoes import ambito_efetivo, filtrar, pode_no_registo
from apps.core.auditoria import registar
from apps.core.vistas import RegistoViewSet
from apps.imoveis.views import entidades_visiveis
from apps.oportunidades.views import imoveis_visiveis
from apps.visitas.models import Visita
from apps.visitas.servicos import nome_responsavel

from .models import Proposta, Ronda
from .serializers import PropostaListaSerializer, PropostaSerializer, RondaSerializer, agente_nome, descricao_imovel

SEM_ACESSO = "Entidade a que não tem acesso"


def visitas_visiveis(utilizador) -> set[int]:
    qs = filtrar(utilizador, "visitas", Operacao.CONSULTAR, Visita.objects.ativos(), campo_partilhas="partilhada_com")
    return set(qs.values_list("pk", flat=True))


class PropostaViewSet(RegistoViewSet):
    modulo = "propostas"
    modelo = Proposta
    nome_registo = "proposta"
    operacoes_extra = {
        **RegistoViewSet.operacoes_extra,
        "rondas": Operacao.EDITAR,
        "editar_ronda": Operacao.EDITAR,
        "previa": Operacao.CONSULTAR,
    }
    campos_auditados = [
        "visita_id", "imovel_id", "imovel_descricao", "imovel_localizacao", "entidade_id", "agente_comprador_id",
        "agente_imovel_id", "estado_id", "responsavel_id", "observacoes",
    ]  # fmt: skip

    def get_serializer_class(self):
        return PropostaListaSerializer if self.action == "list" else PropostaSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["entidades_visiveis"] = entidades_visiveis(self.request.user)
        ctx["imoveis_visiveis"] = imoveis_visiveis(self.request.user)
        ctx["visitas_visiveis"] = visitas_visiveis(self.request.user)
        return ctx

    def base_queryset(self):
        return Proposta.objects.select_related(
            "entidade", "imovel__tipo", "imovel__tipologia", "estado", "responsavel", "visita",
            "agente_comprador__agencia", "agente_imovel__agencia",
        ).prefetch_related(
            Prefetch("rondas", queryset=Ronda.objects.select_related("modo_pagamento", "financiamento", "criado_por"))
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
            )
        for parametro, campo in (
            ("estado", "estado_id"), ("entidade", "entidade_id"), ("imovel", "imovel_id"), ("visita", "visita_id")
        ):  # fmt: skip
            if p.get(parametro):
                qs = qs.filter(**{campo: p[parametro]})
        if p.get("categoria"):
            qs = qs.filter(estado__categoria=p["categoria"])
        return qs.order_by("-criado_em", "-id")

    @extend_schema(
        parameters=[
            OpenApiParameter(n, str) for n in ("pesquisa", "estado", "categoria", "entidade", "imovel", "visita")
        ]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response(
            {
                "estados": opcoes_lista("estados_proposta"),
                "papeis": opcoes_lista("papeis_participante"),
                "modos_pagamento": opcoes_lista("modos_pagamento"),
                "sim_nao": opcoes_lista("sim_nao"),
                "autores": [{"valor": v, "nome": n} for v, n in Ronda.Autor.choices],
                "unidades": [{"valor": v, "nome": n} for v, n in Ronda.Unidade.choices],
                "tipos_interacao": opcoes_lista("tipos_interacao"),
                **self.permissoes_gerais(request),
            }
        )

    @extend_schema(parameters=[OpenApiParameter("visita", int, required=True)])
    @action(detail=False, methods=["get"])
    def previa(self, request):
        """«Gerar Proposta» (Q12/AT-08): dados pré-preenchidos a partir de uma visita. NÃO grava nada."""
        if ambito_efetivo(request.user, self.modulo, Operacao.CRIAR) == Ambito.NENHUM:
            raise PermissionDenied("Não tem permissão para criar propostas.")
        try:
            visita = (
                Visita.objects.ativos()
                .select_related(
                    "entidade",
                    "imovel__tipo",
                    "imovel__tipologia",
                    "agente_comprador__agencia",
                    "agente_imovel__agencia",
                )
                .get(pk=int(request.query_params.get("visita", 0)))
            )
        except (Visita.DoesNotExist, ValueError):
            visita = None
        if visita is None or visita.pk not in visitas_visiveis(request.user):
            return Response({"detail": "Visita inexistente ou sem acesso."}, status=status.HTTP_404_NOT_FOUND)
        existente = Proposta.objects.ativos().filter(visita=visita).first()
        if existente:
            return Response(
                {"detail": f"Esta visita já deu origem à proposta {existente.referencia}.", "codigo": "ja_existe",
                 "proposta": existente.pk},
                status=status.HTTP_409_CONFLICT,
            )  # fmt: skip
        papel = {v.nome: v.pk for v in ValorLista.objects.filter(lista__chave="papeis_participante")}
        visiveis = entidades_visiveis(request.user)
        participantes = [{"entidade": visita.entidade_id, "nome": visita.entidade.nome_completo,
                          "papel": papel.get("Comprador"), "quota": None}]  # fmt: skip
        if visita.imovel_id:
            for p in visita.imovel.proprietarios.select_related("entidade"):
                participantes.append(
                    {
                        "entidade": p.entidade_id,
                        "nome": p.entidade.nome_completo
                        if p.entidade_id in visiveis
                        else "Entidade a que não tem acesso",
                        "papel": papel.get("Proprietário"),
                        "quota": None if p.quota is None else str(p.quota),
                    }
                )
        return Response(
            {
                "visita": visita.pk,
                "visita_referencia": visita.referencia,
                "imovel": visita.imovel_id,
                "imovel_descricao": visita.imovel_descricao,
                "imovel_localizacao": visita.imovel_localizacao,
                "imovel_descricao_completa": descricao_imovel(visita),
                "entidade": visita.entidade_id,
                "entidade_nome": visita.entidade.nome_completo,
                "agente_comprador": visita.agente_comprador_id,
                "agente_comprador_nome": agente_nome(visita.agente_comprador),
                "agente_imovel": visita.agente_imovel_id,
                "agente_imovel_nome": agente_nome(visita.agente_imovel),
                "responsavel_imovel_nome": nome_responsavel(visita.consultor_imovel, visita.agente_imovel),
                "responsavel_comprador_nome": nome_responsavel(visita.consultor_comprador, visita.agente_comprador),
                "valor_sugerido": None
                if not visita.imovel_id or visita.imovel.preco is None
                else str(visita.imovel.preco),
                "participantes": participantes,
            }
        )

    @extend_schema(request=RondaSerializer)
    @action(detail=True, methods=["post"])
    def rondas(self, request, pk=None):
        """Acrescenta uma ronda (nova oferta ou contraproposta). Só em propostas em negociação."""
        with transaction.atomic():
            p = Proposta.objects.select_for_update().get(pk=self.get_object().pk)
            if not pode_no_registo(request.user, self.modulo, Operacao.EDITAR, p, campo_partilhas="partilhada_com"):
                raise PermissionDenied("Não tem permissão para alterar esta proposta.")
            if not p.estado or p.estado.categoria != "negociacao":
                raise serializers.ValidationError({"detail": "Só se acrescentam rondas a propostas em negociação."})
            s = RondaSerializer(data=request.data)
            s.is_valid(raise_exception=True)
            numero = (p.rondas.aggregate(m=Max("numero"))["m"] or 0) + 1
            r = s.save(proposta=p, numero=numero, criado_por=request.user)
            p.atualizado_por = request.user
            p.save()
            registar(
                "proposta.ronda", modulo=self.modulo, objeto=p, request=request,
                dados={"ronda": numero, "autor": r.autor, "valor": str(r.valor)},
            )  # fmt: skip
        return Response(self.get_serializer(self.recarregar(p)).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=RondaSerializer)
    @action(detail=True, methods=["patch"], url_path=r"rondas/(?P<ronda_id>\d+)")
    def editar_ronda(self, request, pk=None, ronda_id=None):
        """Corrige uma ronda já registada (D-42); os valores anteriores ficam na auditoria."""
        with transaction.atomic():
            p = Proposta.objects.select_for_update().get(pk=self.get_object().pk)
            if not pode_no_registo(request.user, self.modulo, Operacao.EDITAR, p, campo_partilhas="partilhada_com"):
                raise PermissionDenied("Não tem permissão para alterar esta proposta.")
            r = p.rondas.filter(pk=ronda_id).first()
            if r is None:
                return Response(status=status.HTTP_404_NOT_FOUND)
            campos = ["autor", "data", "valor", "sinal_valor", "sinal_unidade", "data_cpcv", "data_escritura",
                      "validade", "condicoes", "modo_pagamento_id", "financiamento_id"]  # fmt: skip
            antes = {c: str(getattr(r, c)) for c in campos}
            s = RondaSerializer(r, data=request.data, partial=True)
            s.is_valid(raise_exception=True)
            r = s.save()
            depois = {c: str(getattr(r, c)) for c in campos}
            p.atualizado_por = request.user
            p.save()
            registar(
                "proposta.ronda_alterada", modulo=self.modulo, objeto=p, request=request,
                dados={"ronda": r.numero, "antes": {c: v for c, v in antes.items() if v != depois[c]},
                       "depois": {c: v for c, v in depois.items() if v != antes[c]}},
            )  # fmt: skip
        return Response(self.get_serializer(self.recarregar(p)).data)
