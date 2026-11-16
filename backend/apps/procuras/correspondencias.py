"""Motor de correspondências Procura ↔ Imóvel (F3-02, Q15, AT-10).

Regras:
- Só entram imóveis não eliminados, com status de categoria «ativo» e estado de comercialização
  das categorias «disponível» ou «em preparação» (ou sem estado), da mesma categoria de operação.
- Preço: teto = orçamento × (1 + tolerância). Acima do teto → excluído (sempre). Dentro do
  orçamento → prioridade máxima; entre o orçamento e o teto → a seguir; preço desconhecido → depois.
- Critério obrigatório que o imóvel comprovadamente não cumpre → excluído.
  Obrigatório com informação em falta no imóvel → incluído, mas assinalado «por confirmar»
  (não se inventam correspondências nem se escondem incompatibilidades).
- Ordenação: menos obrigatórios por confirmar, grupo de preço, mais preferências cumpridas, preço.
- Cada resultado traz a explicação de todos os critérios.
"""

from dataclasses import dataclass, field
from decimal import Decimal

from django.db.models import Q

from apps.contas.models import Operacao
from apps.contas.permissoes import filtrar
from apps.imoveis.models import Imovel

from .models import CATEGORIA_IMOVEL, PRETENDE_POR_CATEGORIA, Importancia, Procura

CUMPRE, NAO_CUMPRE, DESCONHECIDO = "cumpre", "nao_cumpre", "desconhecido"


@dataclass
class Avaliacao:
    criterios: list[dict] = field(default_factory=list)
    excluido: bool = False
    grupo_preco: int = 3  # 0 dentro do orçamento; 1 na tolerância; 2 preço desconhecido; 3 sem orçamento

    def juntar(self, criterio: str, estado: str, obrigatorio: bool, detalhe: str):
        self.criterios.append({"criterio": criterio, "estado": estado, "obrigatorio": obrigatorio, "detalhe": detalhe})
        if obrigatorio and estado == NAO_CUMPRE:
            self.excluido = True

    @property
    def obrigatorios_por_confirmar(self) -> int:
        return sum(1 for c in self.criterios if c["obrigatorio"] and c["estado"] == DESCONHECIDO)

    @property
    def preferencias_cumpridas(self) -> int:
        return sum(1 for c in self.criterios if not c["obrigatorio"] and c["estado"] == CUMPRE)

    @property
    def preferencias_total(self) -> int:
        return sum(1 for c in self.criterios if not c["obrigatorio"])


def _euros(v: Decimal) -> str:
    return f"{v:,.0f} €".replace(",", " ")


def _pertence(valor, conjunto: set, nome: str):
    if valor is None:
        return DESCONHECIDO, "não indicado no imóvel"
    return (CUMPRE if valor.pk in conjunto else NAO_CUMPRE), valor.nome


def avaliar(p: Procura, i: Imovel, cache: dict | None = None) -> Avaliacao:
    """Avalia um imóvel face a uma procura. `cache` guarda os conjuntos M2M da procura."""
    c = cache if cache is not None else {}
    if not c:
        c["tipos"] = set(p.tipos.values_list("pk", flat=True))
        c["tipologias"] = set(p.tipologias.values_list("pk", flat=True))
        c["concelhos"] = set(p.concelhos.values_list("pk", flat=True))
        c["freguesias"] = set(p.freguesias.values_list("pk", flat=True))
        c["zonas"] = set(p.zonas_comerciais.values_list("pk", flat=True))
        c["exteriores"] = {v.pk: v.nome for v in p.zonas_exteriores.all()}
        c["condicoes"] = set(p.condicoes_fisicas.values_list("pk", flat=True))
    a = Avaliacao()
    obrig = lambda imp: imp == Importancia.OBRIGATORIO  # noqa: E731

    # Orçamento (sempre obrigatório quando indicado)
    if p.orcamento_max is not None:
        teto = p.teto
        if i.preco is None:
            a.grupo_preco = 2
            a.juntar("preco", DESCONHECIDO, True, "não indicado no imóvel")
        elif i.preco <= p.orcamento_max:
            a.grupo_preco = 0
            a.juntar("preco", CUMPRE, True, f"{_euros(i.preco)} dentro do orçamento ({_euros(p.orcamento_max)})")
        elif i.preco <= teto:
            a.grupo_preco = 1
            a.juntar(
                "preco", CUMPRE, True,
                f"{_euros(i.preco)} acima do orçamento, dentro da tolerância de {p.tolerancia_pct.normalize():f}% "
                f"(máximo {_euros(teto)})",
            )  # fmt: skip
        else:
            a.juntar("preco", NAO_CUMPRE, True, f"{_euros(i.preco)} acima do máximo ({_euros(teto)})")

    if c["tipos"]:
        estado, det = _pertence(i.tipo, c["tipos"], "Tipo")
        a.juntar("tipo", estado, obrig(p.imp_tipos), det)
    if c["tipologias"]:
        estado, det = _pertence(i.tipologia, c["tipologias"], "Tipologia")
        a.juntar("tipologia", estado, obrig(p.imp_tipologias), det)
    if c["concelhos"] or c["freguesias"] or c["zonas"]:
        f = i.freguesia
        if f is None and i.zona_comercial is None:
            a.juntar("localizacao", DESCONHECIDO, obrig(p.imp_localizacao), "não indicada no imóvel")
        else:
            ok = bool(
                (f and (f.pk in c["freguesias"] or f.concelho_id in c["concelhos"]))
                or (i.zona_comercial and i.zona_comercial_id in c["zonas"])
            )
            nomes = ", ".join(filter(None, [f and f"{f.nome} ({f.concelho.nome})",
                                            i.zona_comercial and i.zona_comercial.nome]))  # fmt: skip
            a.juntar("localizacao", CUMPRE if ok else NAO_CUMPRE, obrig(p.imp_localizacao), nomes)
    if p.quartos_min is not None:
        if i.quartos is None:
            a.juntar("quartos", DESCONHECIDO, obrig(p.imp_quartos), "não indicados no imóvel")
        else:
            a.juntar(
                "quartos", CUMPRE if i.quartos >= p.quartos_min else NAO_CUMPRE, obrig(p.imp_quartos),
                f"{i.quartos} quarto(s); mínimo {p.quartos_min}",
            )  # fmt: skip
    if p.area_min is not None:
        area = i.area_bruta_privativa if i.area_bruta_privativa is not None else i.area_util
        if area is None:
            a.juntar("area", DESCONHECIDO, obrig(p.imp_area), "não indicada no imóvel")
        else:
            a.juntar(
                "area", CUMPRE if area >= p.area_min else NAO_CUMPRE, obrig(p.imp_area),
                f"{area:g} m²; mínimo {p.area_min:g} m²",
            )  # fmt: skip
    if c["exteriores"]:
        tem = set(z.pk for z in i.zonas_exteriores.all())
        faltam = [n for pk, n in c["exteriores"].items() if pk not in tem]
        a.juntar(
            "zonas_exteriores", NAO_CUMPRE if faltam else CUMPRE, obrig(p.imp_zonas_exteriores),
            f"Falta: {', '.join(faltam)}" if faltam else "Tem todas as zonas pedidas",
        )  # fmt: skip
    if p.exige_elevador:
        if i.elevador is None:
            a.juntar("elevador", DESCONHECIDO, obrig(p.imp_elevador), "não indicado no imóvel")
        else:
            a.juntar("elevador", CUMPRE if i.elevador else NAO_CUMPRE, obrig(p.imp_elevador),
                     "Tem elevador" if i.elevador else "Sem elevador")  # fmt: skip
    if p.estacionamento_min is not None:
        if i.lugares_estacionamento is None:
            a.juntar("estacionamento", DESCONHECIDO, obrig(p.imp_estacionamento), "não indicado no imóvel")
        else:
            a.juntar(
                "estacionamento", CUMPRE if i.lugares_estacionamento >= p.estacionamento_min else NAO_CUMPRE,
                obrig(p.imp_estacionamento), f"{i.lugares_estacionamento} lugar(es); mínimo {p.estacionamento_min}",
            )  # fmt: skip
    if c["condicoes"]:
        estado, det = _pertence(i.condicao_fisica, c["condicoes"], "Condição física")
        a.juntar("condicao", estado, obrig(p.imp_condicoes), det)
    return a


def imoveis_elegiveis(utilizador, categoria_operacao: str | None):
    qs = Imovel.objects.ativos().filter(Q(status__isnull=True) | Q(status__categoria="ativo"))
    qs = qs.filter(
        Q(estado_comercializacao__isnull=True)
        | Q(estado_comercializacao__categoria__in=["disponivel", "preparacao", ""])
    )
    if categoria_operacao:
        qs = qs.filter(operacao__categoria=categoria_operacao)
    qs = filtrar(utilizador, "imoveis", Operacao.CONSULTAR, qs, campo_partilhas="partilhada_com")
    return qs.select_related(
        "tipo", "tipologia", "freguesia__concelho", "zona_comercial", "condicao_fisica"
    ).prefetch_related("zonas_exteriores")


def _chave(item):
    a, preco = item["_avaliacao"], item["_preco"]
    return (
        a.obrigatorios_por_confirmar,
        a.grupo_preco,
        -a.preferencias_cumpridas,
        preco if preco is not None else Decimal("1e15"),
    )


def _resumo(a: Avaliacao) -> dict:
    return {
        "criterios": a.criterios,
        "obrigatorios_por_confirmar": a.obrigatorios_por_confirmar,
        "preferencias_cumpridas": a.preferencias_cumpridas,
        "preferencias_total": a.preferencias_total,
        "grupo_preco": a.grupo_preco,
    }


def correspondencias_da_procura(p: Procura, utilizador, limite: int = 100) -> list[dict]:
    categoria = CATEGORIA_IMOVEL.get(p.pretende)
    cache: dict = {}
    resultados = []
    for i in imoveis_elegiveis(utilizador, categoria):
        a = avaliar(p, i, cache)
        if a.excluido:
            continue
        resultados.append(
            {
                "imovel": {
                    "id": i.pk,
                    "referencia": i.referencia,
                    "descricao": " ".join(
                        filter(None, [i.tipo and i.tipo.nome, i.tipologia and i.tipologia.nome, i.localidade])
                    ),  # fmt: skip
                    "preco": None if i.preco is None else str(i.preco),
                    "fotografia": {"imovel": i.pk, "versao": i.versao} if i.fotografia else None,
                },
                **_resumo(a),
                "_avaliacao": a,
                "_preco": i.preco,
            }
        )
    resultados.sort(key=_chave)
    for r in resultados:
        r.pop("_avaliacao"), r.pop("_preco")
    return resultados[:limite]


def procuras_do_imovel(i: Imovel, utilizador, limite: int = 100) -> list[dict]:
    """Procuras ativas (visíveis ao utilizador) com as quais o imóvel é compatível."""
    if i.status and i.status.categoria not in ("ativo", ""):
        return []
    qs = Procura.objects.ativos().filter(Q(estado__isnull=True) | Q(estado__categoria="ativa"))
    if i.operacao and i.operacao.categoria in PRETENDE_POR_CATEGORIA:
        qs = qs.filter(pretende=PRETENDE_POR_CATEGORIA[i.operacao.categoria])
    qs = filtrar(utilizador, "procuras", Operacao.CONSULTAR, qs, campo_partilhas="partilhada_com").select_related(
        "entidade"
    )
    visiveis_entidades = set(
        filtrar(
            utilizador,
            "entidades",
            Operacao.CONSULTAR,
            qs.model.entidade.field.related_model.objects.ativos(),
            campo_partilhas="partilhada_com",
        ).values_list("pk", flat=True)  # fmt: skip
    )
    resultados = []
    for p in qs:
        a = avaliar(p, i)
        if a.excluido:
            continue
        resultados.append(
            {
                "procura": {
                    "id": p.pk,
                    "referencia": p.referencia,
                    "entidade": p.entidade.nome_completo if p.entidade_id in visiveis_entidades else None,
                    "orcamento_max": None if p.orcamento_max is None else str(p.orcamento_max),
                },
                **_resumo(a),
                "_avaliacao": a,
                "_preco": p.orcamento_max,
            }
        )
    resultados.sort(key=_chave)
    for r in resultados:
        r.pop("_avaliacao"), r.pop("_preco")
    return resultados[:limite]
