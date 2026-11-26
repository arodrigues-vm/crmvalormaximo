"""Estados da transação e efeitos sugeridos (F3-06, Q14, AT-09).

O CRM só **propõe** efeitos sobre o Imóvel e o CMI; aplica apenas os que o utilizador confirmar e regista-os
na transação (com o valor anterior) para os poder desfazer, também com confirmação, se a transação for reaberta.
Nunca há cascatas: outras propostas, visitas, procuras e tarefas não são tocadas.
"""

from django.utils import timezone
from rest_framework import serializers

from apps.angariacoes.models import Angariacao
from apps.angariacoes.servicos import conflitos, descrever_conflitos
from apps.configuracao.models import ValorLista
from apps.contas.models import Operacao
from apps.contas.permissoes import pode_no_registo
from apps.core.auditoria import registar

FINAIS = ("concluida", "cancelada")
SO_VENDA = ("cpcv", "escritura")


def _estado_imovel_final(t):
    """Estado de comercialização a propor ao concluir: «Vendido» ou «Arrendado» (pelo nome, na lista)."""
    nome = "Arrendado" if t.arrendamento else "Vendido"
    return ValorLista.objects.filter(lista__chave="estados_comercializacao", nome=nome, ativo=True).first()


def efeitos_propostos(t, nova_categoria: str, utilizador) -> list[dict]:
    """Lista de efeitos que o utilizador pode confirmar, para a mudança para `nova_categoria`."""
    efeitos = []
    atual = t.estado.categoria if t.estado else "preparacao"
    if nova_categoria == "concluida":
        i = t.imovel
        alvo = _estado_imovel_final(t)
        if (
            i
            and alvo
            and i.estado_comercializacao_id != alvo.pk
            and pode_no_registo(utilizador, "imoveis", Operacao.EDITAR, i, campo_partilhas="partilhada_com")
        ):
            efeitos.append(
                {
                    "chave": "imovel_estado",
                    "descricao": f"Imóvel {i.referencia}: estado de comercialização passa a «{alvo.nome}».",
                    "antes": i.estado_comercializacao.nome if i.estado_comercializacao else None,
                    "depois": alvo.nome,
                }
            )
        c = t.angariacao
        if (
            c
            and c.situacao == Angariacao.Situacao.EM_CURSO
            and pode_no_registo(utilizador, "angariacoes", Operacao.EDITAR, c, campo_partilhas="partilhada_com")
        ):
            efeitos.append(
                {
                    "chave": "cmi_concluir",
                    "descricao": f"CMI {c.referencia}: passa a «Concluída (negócio realizado)».",
                    "antes": c.get_situacao_display(),
                    "depois": Angariacao.Situacao.CONCLUIDA.label,
                }
            )
        # D-50: tarefas de pós-venda a partir dos modelos (só as confirmadas são criadas).
        from apps.tarefas.servicos import modelos_por_usar, pode_criar

        if pode_criar(utilizador):
            marco = "assinatura do contrato" if t.arrendamento else "escritura"
            for m in modelos_por_usar(t):
                efeitos.append(
                    {
                        "chave": f"tarefa_{m.pk}",
                        "descricao": f"Criar a tarefa de pós-venda «{m.nome}» "
                        f"(prazo: {m.dias_apos} dias depois da {marco}).",
                        "antes": None,
                        "depois": m.nome,
                    }
                )
    elif atual in FINAIS and nova_categoria not in FINAIS:
        # Reabrir: propõe desfazer o que foi aplicado ao concluir.
        for e in t.efeitos_aplicados:
            if e.get("revertido") or e["chave"].startswith("tarefa_"):
                continue
            efeitos.append(
                {
                    "chave": f"desfazer_{e['chave']}",
                    "descricao": f"Desfazer: {e['descricao']} (volta a «{e.get('antes') or '—'}»).",
                    "antes": e.get("depois"),
                    "depois": e.get("antes"),
                }
            )
    return efeitos


def validar_mudanca(t, nova, dados):
    """Regras da mudança de estado. Devolve a categoria nova."""
    cat = nova.categoria
    atual = t.estado.categoria if t.estado else "preparacao"
    if t.estado_id == nova.pk:
        raise serializers.ValidationError({"estado": "A transação já está neste estado."})
    if t.arrendamento and cat in SO_VENDA:
        raise serializers.ValidationError({"estado": "No arrendamento não há CPCV nem escritura."})
    motivo = (dados.get("motivo") or "").strip()
    if cat == "cancelada" and not motivo:
        raise serializers.ValidationError({"motivo": "Indique o motivo do cancelamento."})
    if atual in FINAIS and cat not in FINAIS and not motivo:
        raise serializers.ValidationError({"motivo": "Indique o motivo para reabrir a transação."})
    data = lambda c: dados.get(c) if c in dados else getattr(t, c)  # noqa: E731
    if cat == "cpcv" and not data("data_cpcv"):
        raise serializers.ValidationError({"data_cpcv": "Indique a data em que o CPCV foi assinado."})
    if cat == "escritura" and not data("data_escritura_prevista"):
        raise serializers.ValidationError({"data_escritura_prevista": "Indique a data marcada para a escritura."})
    if cat == "concluida" and not data("data_escritura"):
        campo = "a data do contrato" if t.arrendamento else "a data da escritura"
        raise serializers.ValidationError({"data_escritura": f"Indique {campo}."})
    hoje = timezone.localdate()
    for c in ("data_cpcv", "data_escritura"):
        if dados.get(c) and dados[c] > hoje:
            raise serializers.ValidationError({c: "Uma data efetiva não pode ser no futuro."})
    return cat


def aplicar_efeitos(t, nova_categoria, escolhidos, utilizador, request=None):
    """Aplica só os efeitos escolhidos que continuam a ser propostos (reverifica tudo no servidor)."""
    possiveis = {e["chave"]: e for e in efeitos_propostos(t, nova_categoria, utilizador)}
    desconhecidos = set(escolhidos) - set(possiveis)
    if desconhecidos:
        raise serializers.ValidationError({"efeitos": "Alguns efeitos já não se aplicam. Recarregue e tente de novo."})
    agora = timezone.now().isoformat()
    aplicados = list(t.efeitos_aplicados)
    for chave in escolhidos:
        e = possiveis[chave]
        if chave == "imovel_estado":
            i = t.imovel
            antes = i.estado_comercializacao_id
            i.estado_comercializacao = _estado_imovel_final(t)
            i.atualizado_por = utilizador
            i.save()
            mudanca = {"estado_comercializacao_id": [antes, i.estado_comercializacao_id], "origem": t.referencia}
            registar("imovel.alterado", modulo="imoveis", objeto=i, request=request, dados=mudanca)
            aplicados.append({**e, "antes_id": antes, "em": agora, "por": utilizador.nome, "revertido": False})
        elif chave == "cmi_concluir":
            c = t.angariacao
            c.situacao = Angariacao.Situacao.CONCLUIDA
            c.situacao_motivo = f"Transação {t.referencia} concluída."
            c.atualizado_por = utilizador
            c.save()
            registar("angariacao.situacao", modulo="angariacoes", objeto=c, request=request,
                     dados={"de": "em_curso", "para": "concluida", "origem": t.referencia})  # fmt: skip
            aplicados.append({**e, "em": agora, "por": utilizador.nome, "revertido": False})
        elif chave.startswith("tarefa_"):
            # Tarefas de pós-venda: não ficam nos efeitos a desfazer (reabrir não altera tarefas, Cap. 15).
            from apps.tarefas.models import ModeloTarefa
            from apps.tarefas.servicos import criar_de_modelo

            modelo = ModeloTarefa.objects.get(pk=int(chave.removeprefix("tarefa_")))
            criar_de_modelo(t, modelo, utilizador, t.data_escritura, request=request)
        elif chave.startswith("desfazer_"):
            original = next(
                a for a in aplicados if a["chave"] == chave.removeprefix("desfazer_") and not a["revertido"]
            )
            if original["chave"] == "imovel_estado":
                i = t.imovel
                if not pode_no_registo(utilizador, "imoveis", Operacao.EDITAR, i, campo_partilhas="partilhada_com"):
                    raise serializers.ValidationError({"efeitos": "Sem permissão para alterar o imóvel."})
                antes = i.estado_comercializacao_id
                i.estado_comercializacao_id = original.get("antes_id")
                i.atualizado_por = utilizador
                i.save()
                registar("imovel.alterado", modulo="imoveis", objeto=i, request=request,
                         dados={"estado_comercializacao_id": [antes, i.estado_comercializacao_id],
                                "origem": f"Reabertura de {t.referencia}"})  # fmt: skip
            elif original["chave"] == "cmi_concluir":
                c = t.angariacao
                if c.data_inicio and c.data_fim_vigente:
                    choques = conflitos(c, c.data_inicio, c.data_fim_vigente)
                    if choques:
                        raise serializers.ValidationError(
                            {"efeitos": f"O CMI não pode ser reaberto: sobrepõe-se a {descrever_conflitos(choques)}."}
                        )
                c.situacao = Angariacao.Situacao.EM_CURSO
                c.situacao_motivo = f"Transação {t.referencia} reaberta."
                c.atualizado_por = utilizador
                c.save()
                registar("angariacao.situacao", modulo="angariacoes", objeto=c, request=request,
                         dados={"de": "concluida", "para": "em_curso", "origem": t.referencia})  # fmt: skip
            original["revertido"] = True
            original["revertido_em"] = agora
    t.efeitos_aplicados = aplicados
