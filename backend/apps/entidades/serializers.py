from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from apps.contas.models import Utilizador
from apps.core.validacao import nif_valido, normalizar_telefone
from apps.localizacao.models import Freguesia

from .models import Entidade, OrigemContacto, PapelEntidade, TelefoneEntidade


class TelefoneSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = TelefoneEntidade
        fields = ["id", "regiao", "numero", "numero_e164", "tipo", "principal", "extensao"]
        read_only_fields = ["numero_e164", "extensao"]

    def validate(self, dados):
        regiao = (dados.get("regiao") or "PT").upper()
        try:
            dados["numero_e164"] = normalizar_telefone(regiao, dados["numero"])
        except DjangoValidationError as e:
            raise serializers.ValidationError({"numero": e.messages}) from e
        dados["regiao"] = regiao
        return dados


class RefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nome = serializers.CharField()


class EntidadeListaSerializer(serializers.ModelSerializer):
    telefone_principal = serializers.SerializerMethodField()
    papeis_nomes = serializers.SerializerMethodField()
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)

    class Meta:
        model = Entidade
        fields = [
            "id", "referencia", "nome_completo", "tipo_pessoa", "nif", "email",
            "telefone_principal", "papeis_nomes", "responsavel", "responsavel_nome", "ativa",
        ]  # fmt: skip

    def get_telefone_principal(self, obj) -> str | None:
        telefones = list(obj.telefones.all())
        return telefones[0].numero_e164 if telefones else None

    def get_papeis_nomes(self, obj) -> list[str]:
        return [p.nome for p in obj.papeis.all()]


class EntidadeSerializer(serializers.ModelSerializer):
    telefones = TelefoneSerializer(many=True, required=False)
    papeis = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=PapelEntidade.objects.filter(ativo=True)
    )
    origem = serializers.PrimaryKeyRelatedField(
        allow_null=True, required=False, queryset=OrigemContacto.objects.filter(ativa=True)
    )
    freguesia = serializers.PrimaryKeyRelatedField(allow_null=True, required=False, queryset=Freguesia.objects.all())
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)
    origem_nome = serializers.CharField(source="origem.nome", read_only=True, default=None)
    papeis_nomes = serializers.SerializerMethodField()
    localizacao = serializers.SerializerMethodField()
    versao = serializers.IntegerField(required=False)
    confirmar_duplicado = serializers.BooleanField(write_only=True, required=False, default=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Entidade
        fields = [
            "id", "referencia", "tipo_pessoa", "nome", "apelido", "nome_completo",
            "pais_fiscal", "nif", "data_nascimento", "email", "telefones",
            "rua", "numero_policia", "complemento", "codigo_postal", "localidade", "freguesia", "localizacao",
            "papeis", "papeis_nomes", "origem", "origem_nome", "responsavel", "responsavel_nome",
            "ativa", "observacoes",
            "consentimento_marketing", "consentimento_marketing_em", "oposicao_marketing",
            "criado_em", "atualizado_em", "versao", "eliminado_em", "confirmar_duplicado", "acoes",
        ]  # fmt: skip
        read_only_fields = ["referencia", "nome_completo", "criado_em", "atualizado_em", "eliminado_em"]

    def get_papeis_nomes(self, obj) -> list[str]:
        return [p.nome for p in obj.papeis.all()]

    def get_localizacao(self, obj) -> dict | None:
        f = obj.freguesia
        if not f:
            return None
        return {
            "freguesia": f.nome,
            "concelho": f.concelho.nome,
            "distrito": f.concelho.distrito.nome,
            "codigo": f.codigo,
        }

    def get_acoes(self, obj) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(obj.pk, {})

    # Validação ---------------------------------------------------------------

    def validate_nome(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("O nome é obrigatório.")
        return valor

    def validate_codigo_postal(self, valor):
        valor = valor.strip()
        if valor and not (len(valor) == 8 and valor[:4].isdigit() and valor[4] == "-" and valor[5:].isdigit()):
            raise serializers.ValidationError("Use o formato 0000-000.")
        return valor

    def validate(self, dados):
        pais = (dados.get("pais_fiscal") or getattr(self.instance, "pais_fiscal", "PT") or "PT").upper()
        dados["pais_fiscal"] = pais
        nif = "".join((dados.get("nif") or "").split()).upper()
        if "nif" in dados:
            dados["nif"] = nif
        if nif and pais == "PT" and not nif_valido(nif):
            raise serializers.ValidationError({"nif": "NIF/NIPC inválido."})
        tipo = dados.get("tipo_pessoa") or getattr(self.instance, "tipo_pessoa", Entidade.TipoPessoa.SINGULAR)
        if tipo == Entidade.TipoPessoa.COLETIVA:
            if dados.get("data_nascimento"):
                raise serializers.ValidationError({"data_nascimento": "Não aplicável a pessoas coletivas."})
            if "apelido" in dados:
                dados["apelido"] = ""
        if dados.get("consentimento_marketing") == Entidade.Consentimento.CONCEDIDO and not dados.get(
            "consentimento_marketing_em", getattr(self.instance, "consentimento_marketing_em", None)
        ):
            raise serializers.ValidationError(
                {"consentimento_marketing_em": "Indique a data em que o consentimento foi obtido."}
            )
        telefones = dados.get("telefones")
        if telefones is not None:
            vistos = set()
            for t in telefones:
                if t["numero_e164"] in vistos:
                    raise serializers.ValidationError({"telefones": "Há números de telefone repetidos."})
                vistos.add(t["numero_e164"])
            principais = [t for t in telefones if t.get("principal")]
            if len(principais) > 1:
                raise serializers.ValidationError({"telefones": "Só pode haver um telefone principal."})
            if telefones and not principais:
                telefones[0]["principal"] = True
        return dados

    # Gravação ----------------------------------------------------------------

    def _gravar_telefones(self, entidade, telefones):
        existentes = {t.id: t for t in entidade.telefones.all()}
        manter = set()
        for ordem, dados in enumerate(telefones):
            tid = dados.pop("id", None)
            if tid in existentes:
                t = existentes[tid]
                for k, v in dados.items():
                    setattr(t, k, v)
                t.ordem = ordem
                t.save()
                manter.add(tid)
            else:
                TelefoneEntidade.objects.create(entidade=entidade, ordem=ordem, **dados)
        for tid, t in existentes.items():
            if tid not in manter:
                t.delete()

    @transaction.atomic
    def create(self, dados):
        dados.pop("versao", None)
        dados.pop("confirmar_duplicado", None)
        telefones = dados.pop("telefones", [])
        papeis = dados.pop("papeis", [])
        entidade = Entidade.objects.create(**dados)
        entidade.papeis.set(papeis)
        self._gravar_telefones(entidade, telefones)
        return entidade

    @transaction.atomic
    def update(self, entidade, dados):
        dados.pop("versao", None)
        dados.pop("confirmar_duplicado", None)
        telefones = dados.pop("telefones", None)
        papeis = dados.pop("papeis", None)
        for k, v in dados.items():
            setattr(entidade, k, v)
        entidade.save()
        if papeis is not None:
            entidade.papeis.set(papeis)
        if telefones is not None:
            self._gravar_telefones(entidade, telefones)
        return entidade


class DuplicadosPedidoSerializer(serializers.Serializer):
    nif = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)
    nome = serializers.CharField(required=False, allow_blank=True)
    telefones = serializers.ListField(child=serializers.DictField(), required=False)
    excluir_id = serializers.IntegerField(required=False)


class RelacaoPedidoSerializer(serializers.Serializer):
    tipo = serializers.IntegerField()
    entidade = serializers.IntegerField(help_text="A outra entidade da relação.")
    sentido = serializers.ChoiceField(
        choices=["direto", "inverso"],
        default="direto",
        help_text="direto: esta entidade é a origem (ex.: «Gerente de» X); inverso: é o destino.",
    )
    observacoes = serializers.CharField(required=False, allow_blank=True, max_length=255)
