import time

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import PasswordResetForm, SetPasswordForm
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.utils.decorators import method_decorator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.auditoria import registar

from . import mfa
from .models import Utilizador
from .serializers import (
    CodigoSerializer,
    ConfirmarRecuperacaoSerializer,
    EntrarSerializer,
    RecuperarSerializer,
    UtilizadorAtualSerializer,
)

MENSAGEM_CREDENCIAIS = "Email ou palavra-passe incorretos."
CHAVE_MFA_PENDENTE = "mfa_pendente"


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Garante o cookie CSRF antes do primeiro pedido de escrita."""

    permission_classes = [AllowAny]

    @extend_schema(summary="Obter cookie CSRF", responses={204: None})
    def get(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


# O DRF não verifica CSRF em pedidos anónimos; forçar aqui (CSRF no login).
@method_decorator(csrf_protect, name="dispatch")
class EntrarView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "entrar"

    @extend_schema(summary="Iniciar sessão", request=EntrarSerializer, responses=UtilizadorAtualSerializer)
    def post(self, request):
        dados = EntrarSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        utilizador = authenticate(
            request,
            email=dados.validated_data["email"].strip().lower(),
            password=dados.validated_data["password"],
        )
        if utilizador is None:
            # Mensagem genérica: não revelar se o email existe.
            return Response({"detail": MENSAGEM_CREDENCIAIS}, status=status.HTTP_400_BAD_REQUEST)
        if mfa.mfa_ativa(utilizador):
            # Palavra-passe correta, mas a sessão só é aberta após o código MFA.
            request.session.cycle_key()
            request.session[CHAVE_MFA_PENDENTE] = {"id": utilizador.pk, "desde": time.time()}
            return Response({"mfa_necessaria": True})
        login(request, utilizador)
        return Response(UtilizadorAtualSerializer(utilizador).data)


@method_decorator(csrf_protect, name="dispatch")
class MfaVerificarView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "mfa"

    @extend_schema(summary="Concluir entrada com código MFA", request=CodigoSerializer)
    def post(self, request):
        dados = CodigoSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        pendente = request.session.get(CHAVE_MFA_PENDENTE)
        if not pendente or time.time() - pendente["desde"] > settings.CRM_MFA_PENDENTE_SEGUNDOS:
            request.session.pop(CHAVE_MFA_PENDENTE, None)
            return Response({"detail": "O tempo para introduzir o código expirou. Volte a entrar."}, status=400)
        utilizador = Utilizador.objects.filter(pk=pendente["id"], is_active=True).first()
        tipo = mfa.verificar(utilizador, dados.validated_data["codigo"]) if utilizador else None
        if tipo is None:
            registar("sessao.mfa_falha", utilizador=utilizador, modulo="sessao", request=request)
            return Response({"detail": "Código inválido."}, status=400)
        request.session.pop(CHAVE_MFA_PENDENTE, None)
        utilizador.backend = "django.contrib.auth.backends.ModelBackend"
        login(request, utilizador)
        if tipo == "recuperacao":
            registar("sessao.mfa_codigo_recuperacao_usado", utilizador=utilizador, modulo="sessao", request=request)
        return Response(UtilizadorAtualSerializer(utilizador).data)


class MfaConfigurarView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Iniciar configuração MFA (gera segredo)", request=None)
    def post(self, request):
        if mfa.mfa_ativa(request.user):
            return Response({"detail": "A autenticação em dois passos já está ativa."}, status=400)
        segredo, uri = mfa.iniciar_configuracao(request.user)
        return Response({"segredo": segredo, "uri": uri})


class MfaAtivarView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "mfa"

    @extend_schema(summary="Confirmar configuração MFA com um código", request=CodigoSerializer)
    def post(self, request):
        dados = CodigoSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        codigos = mfa.ativar(request.user, dados.validated_data["codigo"])
        if codigos is None:
            return Response({"detail": "Código inválido. Verifique a hora do telemóvel e tente de novo."}, status=400)
        registar("sessao.mfa_ativada", modulo="sessao", request=request)
        return Response({"codigos_recuperacao": codigos})


class DesativarMfaSerializer(serializers.Serializer):
    password = serializers.CharField()
    codigo = serializers.CharField()


class MfaDesativarView(APIView):
    """O próprio utilizador desliga a MFA, confirmando a palavra-passe e um código (D-40).
    Não é possível enquanto a MFA for obrigatória para o seu perfil."""

    permission_classes = [IsAuthenticated]
    throttle_scope = "mfa"

    @extend_schema(summary="Desativar a autenticação em dois passos", request=DesativarMfaSerializer)
    def post(self, request):
        u = request.user
        if mfa.mfa_obrigatoria(u):
            return Response(
                {"detail": "O início de sessão em dois passos é obrigatório para o seu perfil. O Administrador pode "
                 "torná-lo opcional em Configurações → Parâmetros."},
                status=400,
            )  # fmt: skip
        if not mfa.mfa_ativa(u):
            return Response({"detail": "O início de sessão em dois passos não está ativo."}, status=400)
        dados = DesativarMfaSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        if not u.check_password(dados.validated_data["password"]):
            return Response({"password": ["Palavra-passe incorreta."]}, status=400)
        with transaction.atomic():
            if mfa.verificar(u, dados.validated_data["codigo"]) is None:
                return Response({"codigo": ["Código inválido."]}, status=400)
            mfa.desativar(u)
        registar("sessao.mfa_desativada", modulo="sessao", request=request)
        return Response({"mfa_ativa": False})


class SairView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Terminar sessão", request=None, responses={204: None})
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class EuView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Utilizador atual e permissões efetivas", responses=UtilizadorAtualSerializer)
    def get(self, request):
        return Response(UtilizadorAtualSerializer(request.user).data)


# O DRF não verifica CSRF em pedidos anónimos; forçar aqui (CSRF no login).
@method_decorator(csrf_protect, name="dispatch")
class RecuperarView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "recuperar"

    @extend_schema(summary="Pedir recuperação de acesso", request=RecuperarSerializer, responses={202: None})
    def post(self, request):
        dados = RecuperarSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        formulario = PasswordResetForm(data={"email": dados.validated_data["email"].lower()})
        if formulario.is_valid():
            formulario.save(
                request=request,
                domain_override=settings.CRM_URL_FRONTEND.split("://", 1)[-1],
                use_https=settings.CRM_URL_FRONTEND.startswith("https"),
                subject_template_name="contas/recuperar_assunto.txt",
                email_template_name="contas/recuperar_email.txt",
            )
            registar("sessao.recuperacao_pedida", modulo="sessao", request=request)
        # Resposta idêntica exista ou não a conta (sem enumeração de emails).
        return Response(status=status.HTTP_202_ACCEPTED)


# O DRF não verifica CSRF em pedidos anónimos; forçar aqui (CSRF no login).
@method_decorator(csrf_protect, name="dispatch")
class ConfirmarRecuperacaoView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "recuperar"

    @extend_schema(summary="Definir nova palavra-passe", request=ConfirmarRecuperacaoSerializer, responses={204: None})
    def post(self, request):
        dados = ConfirmarRecuperacaoSerializer(data=request.data)
        dados.is_valid(raise_exception=True)
        invalido = Response(
            {"detail": "Ligação de recuperação inválida ou expirada."}, status=status.HTTP_400_BAD_REQUEST
        )
        try:
            pk = force_str(urlsafe_base64_decode(dados.validated_data["uid"]))
            utilizador = Utilizador.objects.get(pk=pk, is_active=True)
        except (ValueError, TypeError, OverflowError, Utilizador.DoesNotExist):
            return invalido
        if not default_token_generator.check_token(utilizador, dados.validated_data["token"]):
            return invalido
        formulario = SetPasswordForm(
            utilizador,
            data={
                "new_password1": dados.validated_data["nova_password"],
                "new_password2": dados.validated_data["nova_password"],
            },
        )
        if not formulario.is_valid():
            return Response({"nova_password": formulario.errors.get("new_password2", [])}, status=400)
        formulario.save()
        registar("sessao.password_alterada", utilizador=utilizador, modulo="sessao", request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)
