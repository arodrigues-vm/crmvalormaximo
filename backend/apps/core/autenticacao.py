from rest_framework.authentication import SessionAuthentication


class SessaoAutenticacao(SessionAuthentication):
    """Igual à do DRF, mas responde 401 (e não 403) a pedidos sem sessão.

    Permite à interface distinguir "sessão expirada" (401 → voltar a entrar)
    de "sem permissão" (403).
    """

    def authenticate_header(self, request):
        return 'Session realm="crm"'
