from django.conf import settings

from .models import RegistoAuditoria


def _ip(request):
    """IP do cliente. Atrás do proxy (Caddy), usar o último endereço de X-Forwarded-For,
    que é o acrescentado pelo próprio proxy (os anteriores podem ser forjados pelo cliente)."""
    if request is None:
        return None
    if settings.CRM_CONFIAR_PROXY:
        encaminhado = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if encaminhado:
            return encaminhado.split(",")[-1].strip() or None
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
