from django.conf import settings
from django.db import connection
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(
    summary="Estado de saúde do serviço",
    responses=inline_serializer(
        "Saude",
        fields={
            "estado": serializers.CharField(),
            "base_dados": serializers.CharField(),
            "ambiente": serializers.CharField(),
        },
    ),
)
@api_view(["GET"])
@permission_classes([AllowAny])
def saude(request):
    """Endpoint público mínimo para monitorização. Não divulga dados."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        base_dados = "ok"
    except Exception:  # noqa: BLE001 — qualquer falha conta como indisponível
        base_dados = "indisponivel"
    estado = "ok" if base_dados == "ok" else "degradado"
    codigo = 200 if estado == "ok" else 503
    return Response(
        {"estado": estado, "base_dados": base_dados, "ambiente": settings.CRM_AMBIENTE},
        status=codigo,
    )
