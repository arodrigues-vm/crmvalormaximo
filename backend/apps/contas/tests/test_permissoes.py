from types import SimpleNamespace

import pytest

from apps.contas.models import Ambito, Operacao, Perfil, PermissaoPerfil, PermissaoUtilizador
from apps.contas.modulos import MODULOS, semear_permissoes
from apps.contas.permissoes import PermissaoModulo, ambito_efetivo, filtrar, matriz_utilizador, pode
from apps.core.auditoria import registar
from apps.core.models import RegistoAuditoria

Op = Operacao

pytestmark = pytest.mark.django_db


def test_matriz_completa_semeada():
    assert PermissaoPerfil.objects.count() == len(Perfil.values) * len(MODULOS) * len(Operacao.values)


@pytest.mark.parametrize(
    "perfil, modulo, operacao, esperado",
    [
        (Perfil.ADMINISTRADOR, "configuracoes", Op.ADMINISTRAR, Ambito.TODOS),
        (Perfil.ADMINISTRADOR, "faturacao", Op.APROVAR, Ambito.TODOS),
        (Perfil.RESPONSAVEL, "entidades", Op.TRANSFERIR, Ambito.EQUIPA),
        (Perfil.RESPONSAVEL, "faturacao", Op.APROVAR, Ambito.EQUIPA),
        (Perfil.RESPONSAVEL, "configuracoes", Op.CONSULTAR, Ambito.NENHUM),
        (Perfil.CONSULTOR, "imoveis", Op.CONSULTAR, Ambito.ATRIBUIDOS),
        (Perfil.CONSULTOR, "imoveis", Op.PARTILHAR, Ambito.NENHUM),
        (Perfil.CONSULTOR, "imoveis", Op.TRANSFERIR, Ambito.NENHUM),
        (Perfil.CONSULTOR, "faturacao", Op.APROVAR, Ambito.NENHUM),
        (Perfil.ASSISTENTE, "entidades", Op.CONSULTAR, Ambito.ATRIBUIDOS),
        (Perfil.ASSISTENTE, "entidades", Op.ELIMINAR, Ambito.NENHUM),
        (Perfil.ASSISTENTE, "faturacao", Op.CONSULTAR, Ambito.NENHUM),
        (Perfil.ASSISTENTE, "glossario", Op.CONSULTAR, Ambito.TODOS),
        (Perfil.ASSISTENTE, "auditoria", Op.CONSULTAR, Ambito.NENHUM),
    ],
)
def test_matriz_omissao(criar_utilizador, perfil, modulo, operacao, esperado):
    assert ambito_efetivo(criar_utilizador(perfil), modulo, operacao) == esperado


def test_semear_nao_sobrepoe_configuracao_do_administrador():
    linha = PermissaoPerfil.objects.get(perfil=Perfil.CONSULTOR, modulo="imoveis", operacao=Op.CONSULTAR)
    linha.ambito = Ambito.TODOS
    linha.save()
    assert semear_permissoes() == 0
    linha.refresh_from_db()
    assert linha.ambito == Ambito.TODOS


def test_permissao_individual_prevalece_sobre_perfil(criar_utilizador):
    u = criar_utilizador(Perfil.ASSISTENTE)
    PermissaoUtilizador.objects.create(utilizador=u, modulo="entidades", operacao=Op.ELIMINAR, ambito="atribuidos")
    assert pode(u, "entidades", Op.ELIMINAR)
    assert matriz_utilizador(u)["entidades"][Op.ELIMINAR] == Ambito.ATRIBUIDOS


def test_utilizador_inativo_nao_tem_permissoes(criar_utilizador):
    u = criar_utilizador(Perfil.ADMINISTRADOR, is_active=False)
    assert not pode(u, "entidades", Op.CONSULTAR)


def test_anonimo_nao_tem_permissoes():
    anonimo = SimpleNamespace(is_authenticated=False, is_active=False)
    assert ambito_efetivo(anonimo, "entidades", Op.CONSULTAR) == Ambito.NENHUM


class TestFiltrar:
    """Usa os registos de auditoria como registos de ensaio com 'responsável'."""

    @pytest.fixture
    def cenario(self, criar_utilizador, equipa_norte, equipa_sul):
        p = SimpleNamespace(
            admin=criar_utilizador(Perfil.ADMINISTRADOR),
            resp_norte=criar_utilizador(Perfil.RESPONSAVEL, equipa_norte),
            cons_norte=criar_utilizador(Perfil.CONSULTOR, equipa_norte),
            assist_norte=criar_utilizador(Perfil.ASSISTENTE, equipa_norte),
            cons_sul=criar_utilizador(Perfil.CONSULTOR, equipa_sul),
            cons_sem_equipa=criar_utilizador(Perfil.CONSULTOR),
        )
        for u in vars(p).values():
            registar("ensaio", utilizador=u)
        return p

    def _vistos(self, u):
        base = RegistoAuditoria.objects.filter(acao="ensaio")
        qs = filtrar(u, "entidades", Op.CONSULTAR, base, "utilizador")
        return set(qs.values_list("utilizador_id", flat=True))

    def test_administrador_ve_tudo(self, cenario):
        assert len(self._vistos(cenario.admin)) == 6

    def test_responsavel_ve_a_sua_equipa(self, cenario):
        c = cenario
        assert self._vistos(c.resp_norte) == {c.resp_norte.id, c.cons_norte.id, c.assist_norte.id}

    def test_consultor_ve_apenas_os_seus(self, cenario):
        assert self._vistos(cenario.cons_norte) == {cenario.cons_norte.id}

    def test_assistente_ve_apenas_os_atribuidos(self, cenario):
        assert self._vistos(cenario.assist_norte) == {cenario.assist_norte.id}

    def test_sem_permissao_nao_ve_nada(self, cenario):
        qs = filtrar(cenario.cons_norte, "configuracoes", Op.CONSULTAR, RegistoAuditoria.objects.all())
        assert not qs.exists()


def test_permissao_modulo_drf(criar_utilizador, rf):
    vista = SimpleNamespace(modulo="entidades", action="destroy")
    pedido = rf.delete("/")
    pedido.user = criar_utilizador(Perfil.ASSISTENTE)
    assert PermissaoModulo().has_permission(pedido, vista) is False
    pedido.user = criar_utilizador(Perfil.CONSULTOR)
    assert PermissaoModulo().has_permission(pedido, vista) is True
    # Vista sem módulo declarado é recusada por omissão.
    assert PermissaoModulo().has_permission(pedido, SimpleNamespace(action="list")) is False
    # Ação desconhecida é recusada por omissão.
    assert PermissaoModulo().has_permission(pedido, SimpleNamespace(modulo="entidades", action="x")) is False
