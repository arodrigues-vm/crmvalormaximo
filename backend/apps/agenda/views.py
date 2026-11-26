from datetime import date, timedelta

from django.db import transaction
from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.configuracao.campos import opcoes_lista
from apps.contas.models import Operacao
from apps.core.auditoria import registar
from apps.core.vistas import RegistoViewSet
from apps.imoveis.views import entidades_visiveis
from apps.oportunidades.views import imoveis_visiveis

from .models import AvisoDispensado, Compromisso
from .serializers import CompromissoSerializer, DispensarAvisoSerializer, MudarEstadoCompromissoSerializer
from .servicos import MAX_DIAS, avisos, eventos, pessoas_visiveis


def _data(texto, campo):
    try:
        return date.fromisoformat(texto or "")
    except ValueError as e:
        raise serializers.ValidationError({campo: "Data inválida (AAAA-MM-DD)."}) from e


class CompromissoViewSet(RegistoViewSet):
    """Agenda (F4-02, D-51): compromissos, acontecimentos derivados (sem cópias) e avisos."""

    modulo = "agenda"
    modelo = Compromisso
    nome_registo = "compromisso"
    operacoes_extra = {
        **RegistoViewSet.operacoes_extra,
        "eventos": Operacao.CONSULTAR,
        "avisos": Operacao.CONSULTAR,
        "dispensar_aviso": Operacao.CONSULTAR,
        "mudar_estado": Operacao.EDITAR,
    }
    campos_auditados = [
        "titulo", "tipo_id", "inicio", "fim", "local", "descricao", "entidade_id", "imovel_id", "responsavel_id",
    ]  # fmt: skip
    serializer_class = CompromissoSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["entidades_visiveis"] = entidades_visiveis(self.request.user)
        ctx["imoveis_visiveis"] = imoveis_visiveis(self.request.user)
        return ctx

    def base_queryset(self):
        return Compromisso.objects.select_related(
            "tipo", "estado", "responsavel", "entidade", "imovel__tipo", "imovel__tipologia"
        )

    def filtros(self, qs):
        p = self.request.query_params
        termo = (p.get("pesquisa") or "").strip()
        if termo:
            qs = qs.filter(
                Q(referencia__iexact=termo) | Q(titulo__unaccent__icontains=termo) | Q(local__unaccent__icontains=termo)
            )
        if p.get("entidade"):
            qs = qs.filter(entidade_id=p["entidade"])
        if p.get("imovel"):
            qs = qs.filter(imovel_id=p["imovel"])
        return qs.order_by("-inicio", "-id")

    @action(detail=False, methods=["get"])
    def opcoes(self, request):
        return Response(
            {
                "tipos": opcoes_lista("tipos_compromisso"),
                "estados": opcoes_lista("estados_compromisso"),
                "tipos_interacao": opcoes_lista("tipos_interacao"),
                "pessoas": pessoas_visiveis(request.user),
                **self.permissoes_gerais(request),
            }
        )

    @extend_schema(
        parameters=[
            OpenApiParameter("inicio", str, required=True),
            OpenApiParameter("fim", str, required=True),
            OpenApiParameter("pessoa", int),
            OpenApiParameter("cancelados", bool),
            OpenApiParameter("marketing", bool),
        ]
    )
    @action(detail=False, methods=["get"])
    def eventos(self, request):
        """Compromissos e acontecimentos derivados (visitas, tarefas, aniversários) entre duas datas."""
        p = request.query_params
        inicio, fim = _data(p.get("inicio"), "inicio"), _data(p.get("fim"), "fim")
        if fim < inicio or fim - inicio > timedelta(days=MAX_DIAS):
            raise serializers.ValidationError({"fim": f"Intervalo inválido (máximo {MAX_DIAS} dias)."})
        pessoa = p.get("pessoa") or None
        if pessoa is not None:
            if not pessoa.isdigit() or int(pessoa) not in {x["id"] for x in pessoas_visiveis(request.user)}:
                raise serializers.ValidationError({"pessoa": "Pessoa inválida ou sem acesso à sua agenda."})
            pessoa = int(pessoa)
        return Response(
            eventos(
                request.user, inicio, fim, pessoa, cancelados=p.get("cancelados") in ("1", "true"),
                marketing=p.get("marketing") in ("1", "true"),
            )
        )  # fmt: skip

    @action(detail=False, methods=["get"])
    def avisos(self, request):
        return Response(avisos(request.user))

    @extend_schema(request=DispensarAvisoSerializer)
    @action(detail=False, methods=["post"], url_path="avisos/dispensar")
    def dispensar_aviso(self, request):
        s = DispensarAvisoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        AvisoDispensado.objects.get_or_create(utilizador=request.user, chave=s.validated_data["chave"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=MudarEstadoCompromissoSerializer)
    @action(detail=True, methods=["post"], url_path="mudar-estado")
    def mudar_estado(self, request, pk=None):
        """Concluir, cancelar ou reabrir (cancelar e reabrir exigem motivo — Cap. 17)."""
        s = MudarEstadoCompromissoSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        novo, motivo = s.validated_data["estado"], s.validated_data["motivo"].strip()
        with transaction.atomic():
            c = Compromisso.objects.select_for_update().get(pk=self.get_object().pk)
            if not novo.ativo:
                raise serializers.ValidationError({"estado": "Estado desativado."})
            de = c.estado.categoria if c.estado else None
            if c.estado_id == novo.pk:
                raise serializers.ValidationError({"estado": "O compromisso já está neste estado."})
            reabrir = novo.categoria == "agendado" and de in ("concluido", "cancelado")
            if (novo.categoria == "cancelado" or reabrir) and not motivo:
                raise serializers.ValidationError({"motivo": "Indique o motivo."})
            antes = c.estado.nome if c.estado else None
            c.estado, c.motivo_estado, c.atualizado_por = novo, motivo, request.user
            c.save()
            registar("compromisso.estado", modulo=self.modulo, objeto=c, request=request,
                     dados={"de": antes, "para": novo.nome, "motivo": motivo})  # fmt: skip
        return Response(self.get_serializer(self.recarregar(c)).data)
