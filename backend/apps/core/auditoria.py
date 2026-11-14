from django.conf import settings

from .models import RegistoAuditoria


def _ip(request):
    """IP do cliente. Atrás de N proxies de confiança (Caddy; ou nginx + Caddy), o IP real é o
    N-ésimo endereço a contar do fim de X-Forwarded-For: cada proxy acrescenta um, e os anteriores
    podem ter sido forjados pelo cliente."""
    if request is None:
        return None
    n = settings.CRM_NUMERO_PROXIES if settings.CRM_CONFIAR_PROXY else 0
    if n:
        enderecos = [e.strip() for e in request.META.get("HTTP_X_FORWARDED_FOR", "").split(",") if e.strip()]
        if len(enderecos) >= n:
            return enderecos[-n]
    return request.META.get("REMOTE_ADDR") or None


def registar(
    acao, *, utilizador=None, modulo="", objeto=None, descricao="", dados=None, request=None
) -> RegistoAuditoria:
    if utilizador is None and request is not None and getattr(request, "user", None) is not None:
        if request.user.is_authenticated:
            utilizador = request.user
    return RegistoAuditoria.objects.create(
        acao=acao,
        utilizador=utilizador,
        modulo=modulo,
        objeto_tipo=objeto._meta.label_lower if objeto is not None else "",
        objeto_id=str(objeto.pk) if objeto is not None else "",
        descricao=descricao[:255],
        dados=dados or {},
        ip=_ip(request),
    )
