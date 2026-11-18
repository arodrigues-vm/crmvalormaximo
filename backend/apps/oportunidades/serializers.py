from rest_framework import serializers

from apps.configuracao.campos import CampoValorLista
from apps.contas.models import Utilizador
from apps.entidades.models import Entidade
from apps.imoveis.models import Imovel

from .models import Oportunidade

# Qualificação do vendedor (D-34): campos de lista e campos livres.
LISTAS_QUALIFICACAO = {
    "destino_imovel": "destinos_imovel",
    "ocupacao": "ocupacoes_imovel",
    "nivel_motivacao": "niveis_motivacao",
    "venda_depende_compra": "sim_nao",
    "unico_proprietario": "sim_nao",
    "todos_de_acordo": "sim_nao",
    "entidade_bancaria": "entidades_bancarias",
    "esta_a_venda": "sim_nao",
    "teve_visitas": "sim_nao",
    "teve_propostas": "sim_nao",
}
CAMPOS_QUALIFICACAO = [
    "destino_imovel", "ocupacao", "nivel_motivacao", "motivacao", "venda_depende_compra", "prazo_vender",
    "se_nao_vender", "unico_proprietario", "todos_de_acordo", "quando_comprou", "valor_compra", "valor_hipoteca",
    "entidade_bancaria", "como_chegou_valor", "esta_a_venda", "tempo_a_venda", "teve_visitas", "teve_propostas",
    "valor_proposta", "porque_nao_aceitou", "pontos_positivos", "objecoes",
]  # fmt: skip


def _nome(v):
    return v.nome if v else None


class OportunidadeListaSerializer(serializers.ModelSerializer):
    entidade_nome = serializers.SerializerMethodField()
    imovel_descricao = serializers.SerializerMethodField()
    estado_nome = serializers.SerializerMethodField()
    estado_categoria = serializers.SerializerMethodField()
    operacao_nome = serializers.SerializerMethodField()
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)

    class Meta:
        model = Oportunidade
        fields = [
            "id", "referencia", "entidade", "entidade_nome", "imovel", "imovel_descricao", "operacao_nome",
            "estado_nome", "estado_categoria", "preco_pretendido", "prazo_vender", "responsavel_nome", "criado_em",
        ]  # fmt: skip

    def get_entidade_nome(self, o) -> str | None:
        visiveis = self.context.get("entidades_visiveis", set())
        return o.entidade.nome_completo if o.entidade_id in visiveis else None

    def get_imovel_descricao(self, o) -> str:
        if o.imovel:
            i = o.imovel
            return " · ".join(filter(None, [i.referencia, " ".join(filter(None, [_nome(i.tipo), _nome(i.tipologia)])),
                                            i.localidade]))  # fmt: skip
        partes = [" ".join(filter(None, [_nome(o.tipo_imovel), _nome(o.tipologia)])), o.localidade, o.descricao_imovel]
        return " · ".join(filter(None, partes)) or "Imóvel por identificar"

    def get_estado_nome(self, o) -> str | None:
        return _nome(o.estado)

    def get_estado_categoria(self, o) -> str | None:
        return o.estado.categoria if o.estado else None

    def get_operacao_nome(self, o) -> str | None:
        return _nome(o.operacao)


class OportunidadeSerializer(OportunidadeListaSerializer):
    entidade = serializers.PrimaryKeyRelatedField(queryset=Entidade.objects.ativos())
    imovel = serializers.PrimaryKeyRelatedField(queryset=Imovel.objects.ativos(), allow_null=True, required=False)
    tipo_imovel = CampoValorLista("tipos_imovel", allow_null=True, required=False)
    tipologia = CampoValorLista("tipologias", allow_null=True, required=False)
    operacao = CampoValorLista("operacoes", allow_null=True, required=False)
    estado = CampoValorLista("estados_oportunidade", allow_null=True, required=False)
    origem = CampoValorLista("origens_contacto", allow_null=True, required=False)
    destino_imovel = CampoValorLista("destinos_imovel", allow_null=True, required=False)
    ocupacao = CampoValorLista("ocupacoes_imovel", allow_null=True, required=False)
    nivel_motivacao = CampoValorLista("niveis_motivacao", allow_null=True, required=False)
    venda_depende_compra = CampoValorLista("sim_nao", allow_null=True, required=False)
    unico_proprietario = CampoValorLista("sim_nao", allow_null=True, required=False)
    todos_de_acordo = CampoValorLista("sim_nao", allow_null=True, required=False)
    entidade_bancaria = CampoValorLista("entidades_bancarias", allow_null=True, required=False)
    esta_a_venda = CampoValorLista("sim_nao", allow_null=True, required=False)
    teve_visitas = CampoValorLista("sim_nao", allow_null=True, required=False)
    teve_propostas = CampoValorLista("sim_nao", allow_null=True, required=False)
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    angariacao_gerada_referencia = serializers.CharField(
        source="angariacao_gerada.referencia", read_only=True, default=None
    )
    nomes = serializers.SerializerMethodField()
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Oportunidade
        fields = [
            "id", "referencia", "entidade", "entidade_nome", "imovel", "imovel_descricao",
            "tipo_imovel", "tipologia", "localidade", "descricao_imovel", "url_anuncio",
            "operacao", "estado", "estado_nome", "estado_categoria", "origem", "preco_pretendido",
            *CAMPOS_QUALIFICACAO, "angariacao_gerada", "angariacao_gerada_referencia",
            "responsavel", "responsavel_nome", "observacoes", "nomes",
            "criado_em", "atualizado_em", "versao", "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = ["referencia", "angariacao_gerada", "criado_em", "atualizado_em", "eliminado_em"]

    def get_nomes(self, o) -> dict:
        return {
            "tipo_imovel": _nome(o.tipo_imovel),
            "tipologia": _nome(o.tipologia),
            "operacao": _nome(o.operacao),
            "estado": _nome(o.estado),
            "origem": _nome(o.origem),
            **{c: _nome(getattr(o, c)) for c in LISTAS_QUALIFICACAO},
        }

    def get_acoes(self, o) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(o.pk, {})

    def validate_entidade(self, e):
        atual = self.instance.entidade_id if self.instance else None
        if e.pk != atual and e.pk not in self.context.get("entidades_visiveis", set()):
            raise serializers.ValidationError("Entidade inexistente ou sem acesso.")
        return e

    def validate_imovel(self, i):
        atual = self.instance.imovel_id if self.instance else None
        if i is not None and i.pk != atual and i.pk not in self.context.get("imoveis_visiveis", set()):
            raise serializers.ValidationError("Imóvel inexistente ou sem acesso.")
        return i

    def create(self, d):
        d.pop("versao", None)
        if not d.get("estado"):
            from apps.configuracao.models import ValorLista

            d["estado"] = (
                ValorLista.objects.filter(lista__chave="estados_oportunidade", categoria="aberta", ativo=True)
                .order_by("ordem")
                .first()
            )
        return super().create(d)

    def update(self, o, d):
        d.pop("versao", None)
        return super().update(o, d)


class ConverterSerializer(serializers.Serializer):
    criar_cmi = serializers.BooleanField(default=True)
    confirmar = serializers.BooleanField()

    def validate_confirmar(self, v):
        if not v:
            raise serializers.ValidationError("É necessário confirmar a conversão.")
        return v
