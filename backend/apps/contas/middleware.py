from django.http import JsonResponse

from .mfa import configuracao_pendente

PERMITIDOS = ("/api/auth/", "/api/saude/")


class ExigirConfiguracaoMFA:
    """Bloqueia a API a quem tem de configurar MFA e ainda não o fez.

    Só os endpoints de autenticação (incluindo a configuração MFA) ficam acessíveis.
    O admin Django também é bloqueado para estes utilizadores.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        u = getattr(request, "user", None)
        caminho = request.path
        if (
            u is not None
            and u.is_authenticated
            and (caminho.startswith("/api/") or caminho.startswith("/admin/"))
            and not caminho.startswith(PERMITIDOS)
            and configuracao_pendente(u)
        ):
            return JsonResponse(
                {
                    "detail": "Tem de configurar a autenticação em dois passos antes de continuar.",
                    "codigo": "mfa_configuracao_obrigatoria",
                },
                status=403,
            )
        return self.get_response(request)
