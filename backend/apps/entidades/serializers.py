from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from apps.configuracao.campos import CampoValorLista
from apps.configuracao.models import ValorLista
from apps.contas.models import Operacao, Utilizador
from apps.contas.permissoes import filtrar
from apps.core.validacao import nif_valido, normalizar_telefone
from apps.imoveis.models import Imovel
from apps.localizacao.models import Freguesia

from .models import Entidade, TelefoneEntidade


def descrever_imovel(i) -> str:
    tipo = " ".join(filter(None, [i.tipo and i.tipo.nome, i.tipologia and i.tipologia.nome]))
    return " · ".join(filter(None, [tipo, i.localidade])) or "Imóvel"


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
    status_nome = serializers.CharField(source="status.nome", read_only=True, default=None)
    status_categoria = serializers.CharField(source="status.categoria", read_only=True, default=None)

    class Meta:
        model = Entidade
        fields = [
            "id", "referencia", "nome_completo", "tipo_pessoa", "nif", "email",
            "telefone_principal", "papeis_nomes", "responsavel", "responsavel_nome", "status_nome",
            "status_categoria",
        ]  # fmt: skip

    def get_telefone_principal(self, obj) -> str | None:
        telefones = list(obj.telefones.all())
        return telefones[0].numero_e164 if telefones else None

    def get_papeis_nomes(self, obj) -> list[str]:
        return [p.nome for p in obj.papeis.all()]


class EntidadeSerializer(serializers.ModelSerializer):
    telefones = TelefoneSerializer(many=True, required=False)
    papeis = CampoValorLista("papeis_entidade", many=True, required=False)
    origem = CampoValorLista("origens_contacto", allow_null=True, required=False)
    status = CampoValorLista("status_entidade", allow_null=True, required=False)  # vazio = Ativo por omissão
    estado_civil = CampoValorLista("estados_civis", allow_null=True, required=False)
    regime_casamento = CampoValorLista("regimes_casamento", allow_null=True, required=False)
    zona_comercial = CampoValorLista("zonas_comerciais", allow_null=True, required=False)
    status_nome = serializers.CharField(source="status.nome", read_only=True, default=None)
    status_categoria = serializers.CharField(source="status.categoria", read_only=True, default=None)
    quem_recomendou = serializers.PrimaryKeyRelatedField(
        allow_null=True, required=False, queryset=Entidade.objects.filter(eliminado_em__isnull=True)
    )
    quem_recomendou_dados = serializers.SerializerMethodField()
    nomes = serializers.SerializerMethodField()
    imovel_contacto = serializers.PrimaryKeyRelatedField(
        allow_null=True, required=False, queryset=Imovel.objects.filter(eliminado_em__isnull=True)
    )
    imovel_contacto_dados = serializers.SerializerMethodField()
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
            "estado_civil", "regime_casamento", "nacionalidade", "documento_identificacao", "naturalidade_freguesia",
            "naturalidade_concelho", "empresa", "cargo", "observacoes_pessoais", "zona_comercial", "nomes",
            "rua", "numero_policia", "complemento", "codigo_postal", "localidade", "freguesia", "localizacao",
            "papeis", "papeis_nomes", "origem", "origem_nome", "quem_recomendou", "quem_recomendou_dados",
            "imovel_contacto", "imovel_contacto_dados", "visitou_imovel_contacto", "motivo_nao_visitou",
            "responsavel", "responsavel_nome", "status", "status_nome", "status_categoria", "observacoes",
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

    def _visivel(self, modulo, modelo, pk) -> bool:
        pedido = self.context.get("request")
        if pedido is None:
            return False
        qs = filtrar(
            pedido.user, modulo, Operacao.CONSULTAR, modelo.objects.filter(pk=pk), campo_partilhas="partilhada_com"
        )
        return qs.exists()

    def get_nomes(self, obj) -> dict:
        return {
            c: getattr(obj, c).nome if getattr(obj, c) else None
            for c in ("estado_civil", "regime_casamento", "zona_comercial")
        }

    def get_quem_recomendou_dados(self, obj) -> dict | None:
        e = obj.quem_recomendou
        if e is None:
            return None
        if not self._visivel("entidades", Entidade, e.pk):
            return {"id": e.pk, "referencia": None, "nome": "Entidade a que não tem acesso", "acessivel": False}
        return {"id": e.pk, "referencia": e.referencia, "nome": e.nome_completo, "acessivel": True}

    def get_imovel_contacto_dados(self, obj) -> dict | None:
        i = obj.imovel_contacto
        if i is None:
            return None
        if not self._visivel("imoveis", Imovel, i.pk):
            return {"id": i.pk, "referencia": None, "nome": "Imóvel a que não tem acesso", "acessivel": False}
        return {"id": i.pk, "referencia": i.referencia, "nome": descrever_imovel(i), "acessivel": True}

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
        pedido = self.context.get("request")
        for campo, modulo, modelo in (
            ("quem_recomendou", "entidades", Entidade),
            ("imovel_contacto", "imoveis", Imovel),
        ):
            alvo = dados.get(campo)
            if alvo is None or (self.instance and getattr(self.instance, f"{campo}_id") == alvo.pk):
                continue
            if pedido and not self._visivel(modulo, modelo, alvo.pk):
                raise serializers.ValidationError({campo: "Registo inexistente ou sem acesso."})
        if self.instance and dados.get("quem_recomendou") and dados["quem_recomendou"].pk == self.instance.pk:
            raise serializers.ValidationError({"quem_recomendou": "Uma entidade não se pode recomendar a si própria."})
        if dados.get("visitou_imovel_contacto") is True:
            dados["motivo_nao_visitou"] = ""
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
        if not dados.get("status"):
            dados["status"] = (
                ValorLista.objects.filter(lista__chave="status_entidade", categoria="ativo", ativo=True)
                .order_by("ordem", "id")
                .first()
            )
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
        if "status" in dados and dados["status"] is None:
            dados.pop("status")  # vazio mantém o status atual
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
    data_nascimento = serializers.DateField(
        required=False, allow_null=True, help_text="Data de aniversário da outra entidade (fica na ficha dela)."
    )


class RelacaoEdicaoSerializer(serializers.Serializer):
    tipo = serializers.IntegerField(required=False)
    sentido = serializers.ChoiceField(choices=["direto", "inverso"], required=False, default="direto")
    observacoes = serializers.CharField(required=False, allow_blank=True, max_length=255)
