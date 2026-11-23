from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.configuracao.campos import CampoValorLista
from apps.configuracao.models import ValorLista
from apps.contas.models import Utilizador
from apps.core.validacao import nif_valido, normalizar_telefone
from apps.localizacao.models import Freguesia

from .models import Agencia, Agente


def valor_por_categoria(chave: str, categoria: str):
    return (
        ValorLista.objects.filter(lista__chave=chave, categoria=categoria, ativo=True).order_by("ordem", "id").first()
    )


class _Contactos(serializers.ModelSerializer):
    tipo_nome = serializers.CharField(source="tipo.nome", read_only=True, default=None)
    status_nome = serializers.CharField(source="status.nome", read_only=True, default=None)
    status_categoria = serializers.CharField(source="status.categoria", read_only=True, default=None)
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    def get_acoes(self, o) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(o.pk, {})

    def validate_nome(self, v):
        v = v.strip()
        if not v:
            raise serializers.ValidationError("O nome é obrigatório.")
        return v

    def validate(self, d):
        nif = "".join((d.get("nif") or "").split())
        if "nif" in d:
            d["nif"] = nif
        if nif and nif.isdigit() and len(nif) == 9 and not nif_valido(nif):
            raise serializers.ValidationError({"nif": "NIF/NIPC inválido."})
        regiao = (d.get("telefone_regiao") or getattr(self.instance, "telefone_regiao", "PT") or "PT").upper()
        if "telefone" in d:
            numero = (d.get("telefone") or "").strip()
            d["telefone"] = numero
            try:
                d["telefone_e164"] = normalizar_telefone(regiao, numero) if numero else ""
            except DjangoValidationError as e:
                raise serializers.ValidationError({"telefone": e.messages}) from e
        return d

    def create(self, d):
        d.pop("versao", None)
        if not d.get("status"):
            d["status"] = valor_por_categoria("status_agentes", "ativo")
        return super().create(d)

    def update(self, o, d):
        d.pop("versao", None)
        if "status" in d and d["status"] is None:
            d.pop("status")
        return super().update(o, d)


class AgenciaSerializer(_Contactos):
    tipo = CampoValorLista("tipos_agencia", allow_null=True, required=False)
    tipo_categoria = serializers.CharField(source="tipo.categoria", read_only=True, default=None)
    status = CampoValorLista("status_agentes", allow_null=True, required=False)
    freguesia = serializers.PrimaryKeyRelatedField(allow_null=True, required=False, queryset=Freguesia.objects.all())
    localizacao = serializers.SerializerMethodField()
    n_agentes = serializers.SerializerMethodField()

    class Meta:
        model = Agencia
        fields = [
            "id", "referencia", "nome", "tipo", "tipo_nome", "tipo_categoria", "status", "status_nome",
            "status_categoria", "nif", "licenca_ami", "nome_responsavel", "telefone_regiao", "telefone",
            "telefone_e164", "email", "site", "rua", "numero_policia", "complemento", "codigo_postal", "localidade",
            "freguesia", "localizacao", "n_agentes", "responsavel", "observacoes", "criado_em", "atualizado_em",
            "versao", "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = ["referencia", "telefone_e164", "criado_em", "atualizado_em", "eliminado_em"]

    def get_localizacao(self, o) -> dict | None:
        f = o.freguesia
        return {"freguesia": f.nome, "concelho": f.concelho.nome, "distrito": f.concelho.distrito.nome} if f else None

    def get_n_agentes(self, o) -> int:
        return o.agentes.filter(eliminado_em__isnull=True).count()


class AgenteSerializer(_Contactos):
    tipo = CampoValorLista("tipos_agente", allow_null=True, required=False)
    status = CampoValorLista("status_agentes", allow_null=True, required=False)
    agencia = serializers.PrimaryKeyRelatedField(queryset=Agencia.objects.ativos(), allow_null=True, required=False)
    agencia_nome = serializers.CharField(source="agencia.nome", read_only=True, default=None)
    agencia_categoria = serializers.CharField(source="agencia.tipo.categoria", read_only=True, default=None)
    utilizador = serializers.PrimaryKeyRelatedField(
        queryset=Utilizador.objects.filter(is_active=True), allow_null=True, required=False
    )
    utilizador_nome = serializers.CharField(source="utilizador.nome", read_only=True, default=None)

    class Meta:
        model = Agente
        fields = [
            "id", "referencia", "nome", "tipo", "tipo_nome", "status", "status_nome", "status_categoria",
            "agencia", "agencia_nome", "agencia_categoria", "nif", "telefone_regiao", "telefone", "telefone_e164",
            "email", "utilizador", "utilizador_nome", "responsavel", "observacoes", "criado_em", "atualizado_em",
            "versao", "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = ["referencia", "telefone_e164", "criado_em", "atualizado_em", "eliminado_em"]

    def validate_utilizador(self, u):
        if u is not None:
            outro = Agente.objects.filter(utilizador=u).exclude(pk=getattr(self.instance, "pk", None)).first()
            if outro:
                raise serializers.ValidationError(f"Este utilizador já está ligado ao agente {outro.nome}.")
        return u
