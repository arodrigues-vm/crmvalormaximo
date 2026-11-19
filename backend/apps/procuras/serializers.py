from rest_framework import serializers

from apps.configuracao.campos import CampoValorLista
from apps.contas.models import Utilizador
from apps.entidades.models import Entidade
from apps.localizacao.models import Concelho, Freguesia

from .models import Procura

IMPORTANCIAS = [
    "imp_tipos", "imp_tipologias", "imp_localizacao", "imp_quartos", "imp_wcs", "imp_area", "imp_zonas_exteriores",
    "imp_elevador", "imp_estacionamento", "imp_condicoes",
]  # fmt: skip


LISTAS_QUALIFICACAO = {
    "destino_imovel": "destinos_imovel",
    "nivel_motivacao": "niveis_motivacao",
    "compra_depende_venda": "sim_nao",
    "aceita_obras": "aceita_obras",
    "modo_pagamento": "modos_pagamento",
    "capitais_proprios": "sim_nao",
    "financiamento": "sim_nao",
    "qualificacao_bancaria": "sim_nao",
    "entidade_bancaria": "entidades_bancarias",
}
CAMPOS_QUALIFICACAO = [
    "destino_imovel", "nivel_motivacao", "motivacao", "compra_depende_venda", "prazo_aquisicao", "quando_iniciou",
    "o_que_quer", "o_que_nao_quer", "flexibilidade", "piso", "exposicao_solar", "aceita_obras",
    "modo_pagamento", "capitais_proprios", "financiamento", "qualificacao_bancaria",
    "entidade_bancaria", "observacoes_qualificacao",
]  # fmt: skip


def _nome(v):
    return v.nome if v else None


class ProcuraListaSerializer(serializers.ModelSerializer):
    entidade_nome = serializers.SerializerMethodField()
    pretende_nome = serializers.CharField(source="get_pretende_display", read_only=True)
    estado_nome = serializers.SerializerMethodField()
    estado_categoria = serializers.SerializerMethodField()
    urgencia_nome = serializers.SerializerMethodField()
    resumo = serializers.SerializerMethodField()
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)

    class Meta:
        model = Procura
        fields = [
            "id", "referencia", "entidade", "entidade_nome", "pretende", "pretende_nome", "estado_nome",
            "estado_categoria", "urgencia_nome", "orcamento_max", "tolerancia_pct", "resumo",
            "responsavel_nome", "quando_iniciou", "criado_em",
        ]  # fmt: skip

    def get_entidade_nome(self, o) -> str | None:
        return o.entidade.nome_completo if o.entidade_id in self.context.get("entidades_visiveis", set()) else None

    def get_estado_nome(self, o) -> str | None:
        return _nome(o.estado)

    def get_estado_categoria(self, o) -> str | None:
        return o.estado.categoria if o.estado else None

    def get_urgencia_nome(self, o) -> str | None:
        return _nome(o.urgencia)

    def get_resumo(self, o) -> str:
        partes = [
            ", ".join(t.nome for t in o.tipos.all()),
            ", ".join(t.nome for t in o.tipologias.all()),
            ", ".join(
                [c.nome for c in o.concelhos.all()]
                + [f.nome for f in o.freguesias.all()]
                + [z.nome for z in o.zonas_comerciais.all()]
            ),  # fmt: skip
        ]
        return " · ".join(p for p in partes if p)


class ProcuraSerializer(ProcuraListaSerializer):
    entidade = serializers.PrimaryKeyRelatedField(queryset=Entidade.objects.ativos())
    estado = CampoValorLista("estados_procura", allow_null=True, required=False)
    urgencia = CampoValorLista("urgencias", allow_null=True, required=False)
    destino_imovel = CampoValorLista("destinos_imovel", allow_null=True, required=False)
    nivel_motivacao = CampoValorLista("niveis_motivacao", allow_null=True, required=False)
    compra_depende_venda = CampoValorLista("sim_nao", allow_null=True, required=False)
    aceita_obras = CampoValorLista("aceita_obras", allow_null=True, required=False)
    modo_pagamento = CampoValorLista("modos_pagamento", allow_null=True, required=False)
    capitais_proprios = CampoValorLista("sim_nao", allow_null=True, required=False)
    financiamento = CampoValorLista("sim_nao", allow_null=True, required=False)
    qualificacao_bancaria = CampoValorLista("sim_nao", allow_null=True, required=False)
    entidade_bancaria = CampoValorLista("entidades_bancarias", allow_null=True, required=False)
    tipos = CampoValorLista("tipos_imovel", many=True, required=False)
    tipologias = CampoValorLista("tipologias", many=True, required=False)
    zonas_comerciais = CampoValorLista("zonas_comerciais", many=True, required=False)
    zonas_exteriores = CampoValorLista("zonas_exteriores", many=True, required=False)
    condicoes_fisicas = CampoValorLista("condicoes_fisicas", many=True, required=False)
    concelhos = serializers.PrimaryKeyRelatedField(many=True, required=False, queryset=Concelho.objects.all())
    freguesias = serializers.PrimaryKeyRelatedField(many=True, required=False, queryset=Freguesia.objects.all())
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    teto = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    nomes = serializers.SerializerMethodField()
    versao = serializers.IntegerField(required=False)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Procura
        fields = [
            "id", "referencia", "entidade", "entidade_nome", "pretende", "pretende_nome", "estado", "estado_nome",
            "estado_categoria",
            "urgencia", "urgencia_nome", *CAMPOS_QUALIFICACAO,
            "orcamento_max", "tolerancia_pct", "teto",
            "tipos", "imp_tipos", "tipologias", "imp_tipologias",
            "concelhos", "freguesias", "zonas_comerciais", "imp_localizacao",
            "quartos_min", "imp_quartos", "wcs_min", "imp_wcs", "area_min", "imp_area",
            "zonas_exteriores", "imp_zonas_exteriores", "exige_elevador", "imp_elevador",
            "estacionamento_min", "imp_estacionamento", "condicoes_fisicas", "imp_condicoes",
            "responsavel", "responsavel_nome", "observacoes", "nomes", "resumo",
            "criado_em", "atualizado_em", "versao", "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = ["referencia", "criado_em", "atualizado_em", "eliminado_em"]

    def get_nomes(self, o) -> dict:
        return {
            "pretende": o.get_pretende_display(),
            "estado": _nome(o.estado),
            "urgencia": _nome(o.urgencia),
            **{c: _nome(getattr(o, c)) for c in LISTAS_QUALIFICACAO},
            "tipos": [t.nome for t in o.tipos.all()],
            "tipologias": [t.nome for t in o.tipologias.all()],
            "concelhos": [{"id": c.id, "nome": c.nome} for c in o.concelhos.all()],
            "freguesias": [{"id": f.id, "nome": f"{f.nome} ({f.concelho.nome})"} for f in o.freguesias.all()],
            "zonas_comerciais": [z.nome for z in o.zonas_comerciais.all()],
            "zonas_exteriores": [z.nome for z in o.zonas_exteriores.all()],
            "condicoes_fisicas": [z.nome for z in o.condicoes_fisicas.all()],
        }

    def get_acoes(self, o) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(o.pk, {})

    def validate_entidade(self, e):
        atual = self.instance.entidade_id if self.instance else None
        if e.pk != atual and e.pk not in self.context.get("entidades_visiveis", set()):
            raise serializers.ValidationError("Entidade inexistente ou sem acesso.")
        return e

    M2M = [
        "tipos",
        "tipologias",
        "zonas_comerciais",
        "zonas_exteriores",
        "condicoes_fisicas",
        "concelhos",
        "freguesias",
    ]

    def create(self, d):
        d.pop("versao", None)
        m2m = {k: d.pop(k) for k in self.M2M if k in d}
        if not d.get("estado"):
            from apps.configuracao.models import ValorLista

            d["estado"] = (
                ValorLista.objects.filter(lista__chave="estados_procura", categoria="ativa", ativo=True)
                .order_by("ordem")
                .first()
            )
        p = Procura.objects.create(**d)
        for k, v in m2m.items():
            getattr(p, k).set(v)
        return p

    def update(self, p, d):
        d.pop("versao", None)
        m2m = {k: d.pop(k) for k in self.M2M if k in d}
        for k, v in d.items():
            setattr(p, k, v)
        p.save()
        for k, v in m2m.items():
            getattr(p, k).set(v)
        return p
