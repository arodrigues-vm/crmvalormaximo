from rest_framework import serializers

from . import mfa
from .models import Utilizador
from .permissoes import matriz_utilizador


class EntrarSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False, style={"input_type": "password"})


class UtilizadorAtualSerializer(serializers.ModelSerializer):
    perfil_nome = serializers.CharField(source="get_perfil_display", read_only=True)
    equipa_nome = serializers.CharField(source="equipa.nome", read_only=True, default=None)
    permissoes = serializers.SerializerMethodField()

    class Meta:
        model = Utilizador
        fields = [
            "id", "email", "nome", "perfil", "perfil_nome", "equipa", "equipa_nome",
            "permissoes", "mfa_ativa", "mfa_configuracao_pendente",
        ]  # fmt: skip

    mfa_ativa = serializers.SerializerMethodField()
    mfa_configuracao_pendente = serializers.SerializerMethodField()

    def get_mfa_ativa(self, obj) -> bool:
        return mfa.mfa_ativa(obj)

    def get_mfa_configuracao_pendente(self, obj) -> bool:
        return mfa.configuracao_pendente(obj)

    def get_permissoes(self, obj) -> dict[str, dict[str, str]]:
        return matriz_utilizador(obj)


class RecuperarSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ConfirmarRecuperacaoSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    nova_password = serializers.CharField(trim_whitespace=False, style={"input_type": "password"})


class CodigoSerializer(serializers.Serializer):
    codigo = serializers.CharField(max_length=20)
