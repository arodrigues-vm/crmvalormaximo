from .models import RegistoAuditoria


def _ip(request):
    if request is None:
        return None
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
