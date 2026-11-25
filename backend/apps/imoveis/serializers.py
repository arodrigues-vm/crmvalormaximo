from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.agentes.models import Agente, nome_agente
from apps.configuracao.campos import CampoValorLista
from apps.configuracao.models import ValorLista
from apps.contas.models import Utilizador
from apps.localizacao.models import Freguesia

from .models import Imovel, Proprietario

CEM = Decimal("100")


def _nome(v):
    return v.nome if v else None


class ProprietarioEscritaSerializer(serializers.Serializer):
    entidade = serializers.IntegerField()
    quota = serializers.DecimalField(
        max_digits=7, decimal_places=4, min_value=Decimal("0"), max_value=CEM, allow_null=True, required=False
    )


class ImovelListaSerializer(serializers.ModelSerializer):
    operacao_nome = serializers.SerializerMethodField()
    status_nome = serializers.SerializerMethodField()
    status_categoria = serializers.SerializerMethodField()
    tem_fotografia = serializers.SerializerMethodField()
    tipo_nome = serializers.SerializerMethodField()
    tipologia_nome = serializers.SerializerMethodField()
    estado_comercializacao_nome = serializers.SerializerMethodField()
    proprietarios_nomes = serializers.SerializerMethodField()
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)
    concelho = serializers.SerializerMethodField()

    class Meta:
        model = Imovel
        fields = [
            "id", "referencia", "tipo_nome", "tipologia_nome", "operacao_nome", "estado_comercializacao_nome",
            "status_nome", "status_categoria", "tem_fotografia", "versao", "preco", "localidade", "concelho",
            "area_bruta_privativa", "proprietarios_nomes",
            "responsavel_nome",
        ]  # fmt: skip

    def get_tipo_nome(self, o) -> str | None:
        return _nome(o.tipo)

    def get_operacao_nome(self, o) -> str | None:
        return _nome(o.operacao)

    def get_status_nome(self, o) -> str | None:
        return _nome(o.status)

    def get_status_categoria(self, o) -> str | None:
        return o.status.categoria if o.status else None

    def get_tem_fotografia(self, o) -> bool:
        return bool(o.fotografia)

    def get_tipologia_nome(self, o) -> str | None:
        return _nome(o.tipologia)

    def get_estado_comercializacao_nome(self, o) -> str | None:
        return _nome(o.estado_comercializacao)

    def get_concelho(self, o) -> str | None:
        return o.freguesia.concelho.nome if o.freguesia else None

    def get_proprietarios_nomes(self, o) -> list[str]:
        visiveis = self.context.get("entidades_visiveis")
        return [
            p.entidade.nome_completo if visiveis is None or p.entidade_id in visiveis else "—"
            for p in o.proprietarios.all()
        ]


# Campos de lista acrescentados em D-34 (campo -> chave da lista configurável).
LISTAS_D34 = {
    "destino_imovel": "destinos_imovel",
    "ocupacao": "ocupacoes_imovel",
    "situacao": "situacoes_imovel",
    "conservacao": "conservacoes",
    "acabamentos": "acabamentos",
    "habitavel": "sim_nao",
    "tipo_artigo": "artigos_matriciais",
    "fonte_areas": "fontes_areas",
    "cozinha": "cozinhas",
    "arrumacao": "classificacoes",
    "climatizacao": "climatizacoes",
    "caixilharia": "caixilharias",
    "piscina": "piscinas",
    "garagem": "garagens",
    "elevadores": "quantidades",
}
CAMPOS_D34 = [
    "link_localizacao",
    "link_site",
    "certificado_numero",
    "licenca_construcao",
    "licenca_habitabilidade",
    "alvara_loteamento",
    "area_coberta",
    "area_descoberta",
    "area_construcao",
    "conformidade_areas",
    "suites",
    "quartos_extra",
    "salas",
    "wcs_servico",
    "marquises",
    "lavandarias",
    "outras_divisoes",
    "artigo_matricial",
    "descricao_registo_predial",
]


class ImovelSerializer(serializers.ModelSerializer):
    operacao = CampoValorLista("operacoes")
    status = CampoValorLista("status_imovel", required=False, allow_null=True)  # vazio = ativo por omissão
    tem_fotografia = serializers.SerializerMethodField()
    tipo = CampoValorLista("tipos_imovel", allow_null=True, required=False)
    tipologia = CampoValorLista("tipologias", allow_null=True, required=False)
    estado_comercializacao = CampoValorLista("estados_comercializacao", allow_null=True, required=False)
    condicao_fisica = CampoValorLista("condicoes_fisicas", allow_null=True, required=False)
    zona_comercial = CampoValorLista("zonas_comerciais", allow_null=True, required=False)
    certificado_energetico = CampoValorLista("certificados_energeticos", allow_null=True, required=False)
    zonas_exteriores = CampoValorLista("zonas_exteriores", many=True, required=False)
    destino_imovel = CampoValorLista("destinos_imovel", allow_null=True, required=False)
    ocupacao = CampoValorLista("ocupacoes_imovel", allow_null=True, required=False)
    situacao = CampoValorLista("situacoes_imovel", allow_null=True, required=False)
    conservacao = CampoValorLista("conservacoes", allow_null=True, required=False)
    acabamentos = CampoValorLista("acabamentos", allow_null=True, required=False)
    habitavel = CampoValorLista("sim_nao", allow_null=True, required=False)
    tipo_artigo = CampoValorLista("artigos_matriciais", allow_null=True, required=False)
    fonte_areas = CampoValorLista("fontes_areas", allow_null=True, required=False)
    cozinha = CampoValorLista("cozinhas", allow_null=True, required=False)
    arrumacao = CampoValorLista("classificacoes", allow_null=True, required=False)
    climatizacao = CampoValorLista("climatizacoes", allow_null=True, required=False)
    caixilharia = CampoValorLista("caixilharias", allow_null=True, required=False)
    piscina = CampoValorLista("piscinas", allow_null=True, required=False)
    garagem = CampoValorLista("garagens", allow_null=True, required=False)
    elevadores = CampoValorLista("quantidades", allow_null=True, required=False)
    freguesia = serializers.PrimaryKeyRelatedField(allow_null=True, required=False, queryset=Freguesia.objects.all())
    responsavel = serializers.PrimaryKeyRelatedField(required=False, queryset=Utilizador.objects.filter(is_active=True))
    angariacao = CampoValorLista("tipos_angariacao", allow_null=True, required=False)
    agente_responsavel = serializers.PrimaryKeyRelatedField(
        allow_null=True, required=False, queryset=Agente.objects.ativos()
    )
    proprietarios = ProprietarioEscritaSerializer(many=True, required=False, write_only=True)
    versao = serializers.IntegerField(required=False)

    # Apenas leitura
    nomes = serializers.SerializerMethodField()
    proprietarios_detalhe = serializers.SerializerMethodField()
    localizacao = serializers.SerializerMethodField()
    responsavel_nome = serializers.CharField(source="responsavel.nome", read_only=True)
    agente_responsavel_nome = serializers.SerializerMethodField()
    angariacao_propria = serializers.BooleanField(read_only=True)
    responsavel_imovel_nome = serializers.SerializerMethodField()
    duplicado_de_referencia = serializers.CharField(source="duplicado_de.referencia", read_only=True, default=None)
    acoes = serializers.SerializerMethodField()

    class Meta:
        model = Imovel
        fields = [
            "id", "referencia", "tipo", "tipologia", "operacao", "estado_comercializacao", "status",
            "condicao_fisica", "preco",
            "rua", "numero_policia", "complemento", "codigo_postal", "localidade", "freguesia", "localizacao",
            "zona_comercial", "localizacao_descritiva",
            "area_bruta_privativa", "area_bruta_dependente", "area_util", "area_terreno",
            "quartos", "casas_banho", "ano_construcao", "piso", "elevador", "lugares_estacionamento",
            "certificado_energetico", "zonas_exteriores", "descricao", *LISTAS_D34, *CAMPOS_D34,
            "duplicado_de", "duplicado_de_referencia",
            "proprietarios", "proprietarios_detalhe", "responsavel", "responsavel_nome", "observacoes",
            "angariacao", "angariacao_propria", "agente_responsavel", "agente_responsavel_nome",
            "responsavel_imovel_nome", "nomes", "tem_fotografia", "criado_em", "atualizado_em", "versao",
            "eliminado_em", "acoes",
        ]  # fmt: skip
        read_only_fields = [
            "referencia", "criado_em", "atualizado_em", "eliminado_em", "lugares_estacionamento", "elevador",
        ]  # fmt: skip

    def get_nomes(self, o) -> dict:
        """Nomes legíveis dos valores de listas (para a ficha de consulta)."""
        return {
            "tipo": _nome(o.tipo),
            "tipologia": _nome(o.tipologia),
            "estado_comercializacao": _nome(o.estado_comercializacao),
            "condicao_fisica": _nome(o.condicao_fisica),
            "zona_comercial": _nome(o.zona_comercial),
            "certificado_energetico": _nome(o.certificado_energetico),
            "zonas_exteriores": [z.nome for z in o.zonas_exteriores.all()],
            "operacao": _nome(o.operacao),
            "operacao_categoria": o.operacao.categoria if o.operacao else None,
            "status": _nome(o.status),
            "status_categoria": o.status.categoria if o.status else None,
            "angariacao": _nome(o.angariacao),
            **{c: _nome(getattr(o, c)) for c in LISTAS_D34},
        }

    def get_agente_responsavel_nome(self, o) -> str | None:
        return nome_agente(o.agente_responsavel)

    def get_responsavel_imovel_nome(self, o) -> str | None:
        """Quem responde pelo imóvel (D-46): membro da Equipa se a angariação é própria; senão, o agente."""
        return o.responsavel.nome if o.angariacao_propria else nome_agente(o.agente_responsavel)

    def get_proprietarios_detalhe(self, o) -> list[dict]:
        visiveis = self.context.get("entidades_visiveis", set())
        resultado = []
        for p in o.proprietarios.select_related("entidade").all():
            acessivel = p.entidade_id in visiveis
            resultado.append(
                {
                    "entidade": p.entidade_id,
                    "acessivel": acessivel,
                    "nome_completo": p.entidade.nome_completo if acessivel else None,
                    "referencia": p.entidade.referencia if acessivel else None,
                    "quota": str(p.quota) if p.quota is not None else None,
                }
            )
        return resultado

    def get_localizacao(self, o) -> dict | None:
        f = o.freguesia
        if not f:
            return None
        return {"freguesia": f.nome, "concelho": f.concelho.nome, "distrito": f.concelho.distrito.nome}

    def get_tem_fotografia(self, o) -> bool:
        return bool(o.fotografia)

    def get_acoes(self, o) -> dict[str, bool]:
        return self.context.get("acoes", {}).get(o.pk, {})

    def validate_codigo_postal(self, valor):
        valor = valor.strip()
        if valor and not (len(valor) == 8 and valor[:4].isdigit() and valor[4] == "-" and valor[5:].isdigit()):
            raise serializers.ValidationError("Use o formato 0000-000.")
        return valor

    def validate(self, d):
        d = super().validate(d)
        angariacao = d.get("angariacao", getattr(self.instance, "angariacao", None))
        propria = angariacao is None or angariacao.categoria == "propria"
        if propria:
            d["agente_responsavel"] = None  # na angariação própria o responsável é o da Equipa
        elif not d.get("agente_responsavel", getattr(self.instance, "agente_responsavel", None)):
            raise serializers.ValidationError(
                {"agente_responsavel": "Na angariação de rede ou externa, escolha o responsável em Agentes."}
            )
        return d

    def validate_proprietarios(self, lista):
        visiveis = self.context.get("entidades_visiveis", set())
        atuais = set(self.instance.proprietarios.values_list("entidade_id", flat=True)) if self.instance else set()
        vistos = set()
        for p in lista:
            if p["entidade"] in vistos:
                raise serializers.ValidationError("O mesmo proprietário foi indicado mais do que uma vez.")
            vistos.add(p["entidade"])
            # Só se acrescentam entidades a que o utilizador tem acesso; as já existentes mantêm-se.
            if p["entidade"] not in visiveis and p["entidade"] not in atuais:
                raise serializers.ValidationError("Entidade inexistente ou sem acesso.")
        total = sum((p.get("quota") or Decimal("0")) for p in lista)
        if total > CEM:
            raise serializers.ValidationError(f"A soma das quotas ({total.normalize():f}%) ultrapassa 100%.")
        return lista

    def _gravar_proprietarios(self, imovel, lista):
        imovel.proprietarios.exclude(entidade_id__in=[p["entidade"] for p in lista]).delete()
        for ordem, p in enumerate(lista):
            Proprietario.objects.update_or_create(
                imovel=imovel, entidade_id=p["entidade"], defaults={"quota": p.get("quota"), "ordem": ordem}
            )
        from apps.angariacoes.servicos import sincronizar_partes_do_imovel

        sincronizar_partes_do_imovel(imovel)  # D-35: Partes do CMI em curso = proprietários

    @transaction.atomic
    def create(self, dados):
        dados.pop("versao", None)
        proprietarios = dados.pop("proprietarios", [])
        zonas = dados.pop("zonas_exteriores", [])
        if not dados.get("status"):
            dados["status"] = (
                ValorLista.objects.filter(lista__chave="status_imovel", categoria="ativo", ativo=True)
                .order_by("ordem")
                .first()
            )
        imovel = Imovel.objects.create(**dados)
        imovel.zonas_exteriores.set(zonas)
        self._gravar_proprietarios(imovel, proprietarios)
        return imovel

    @transaction.atomic
    def update(self, imovel, dados):
        dados.pop("versao", None)
        proprietarios = dados.pop("proprietarios", None)
        zonas = dados.pop("zonas_exteriores", None)
        if "status" in dados and dados["status"] is None:
            dados.pop("status")  # na edição, vazio mantém o status atual
        for k, v in dados.items():
            setattr(imovel, k, v)
        imovel.save()
        if zonas is not None:
            imovel.zonas_exteriores.set(zonas)
        if proprietarios is not None:
            self._gravar_proprietarios(imovel, proprietarios)
        return imovel
