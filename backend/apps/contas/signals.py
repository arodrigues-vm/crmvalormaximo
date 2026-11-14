from django.contrib.auth.signals import user_logged_in, user_logged_out, user_login_failed
from django.dispatch import receiver

from apps.core.auditoria import registar


@receiver(user_logged_in)
def ao_entrar(sender, request, user, **kwargs):
    registar("sessao.entrada", utilizador=user, modulo="sessao", request=request)


@receiver(user_logged_out)
def ao_sair(sender, request, user, **kwargs):
    if user is not None:
        registar("sessao.saida", utilizador=user, modulo="sessao", request=request)


@receiver(user_login_failed)
def ao_falhar(sender, credentials, request=None, **kwargs):
    registar(
        "sessao.falha",
        modulo="sessao",
        request=request,
        dados={"email": (credentials.get("email") or credentials.get("username") or "")[:254]},
    )
