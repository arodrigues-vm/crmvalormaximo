"""Autenticação em dois passos (TOTP, compatível com Google/Microsoft Authenticator).

O segredo TOTP é guardado cifrado (Fernet) com uma chave derivada de
DJANGO_SECRET_KEY. Atenção: mudar a DJANGO_SECRET_KEY invalida as
configurações MFA existentes (os utilizadores terão de as refazer).
"""

import base64
import hashlib
import secrets
import time

import pyotp
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.utils import timezone

EMISSOR = "CRM Valor Máximo"
INTERVALO = 30
N_CODIGOS_RECUPERACAO = 10


def _fernet() -> Fernet:
    chave = HKDF(algorithm=hashes.SHA256(), length=32, salt=b"crm-mfa", info=b"totp").derive(
        settings.SECRET_KEY.encode()
    )
    return Fernet(base64.urlsafe_b64encode(chave))


def cifrar(texto: str) -> str:
    return _fernet().encrypt(texto.encode()).decode()


def decifrar(texto: str) -> str:
    return _fernet().decrypt(texto.encode()).decode()


def mfa_obrigatoria(utilizador) -> bool:
    """Perfis obrigados à MFA (configuração do servidor), salvo se o Administrador a tornou opcional
    no parâmetro «mfa_obrigatoria» (D-40)."""
    from apps.configuracao.models import parametro

    if not parametro("mfa_obrigatoria"):
        return False
    return utilizador.perfil in settings.CRM_MFA_PERFIS_OBRIGATORIOS or utilizador.is_superuser


def mfa_ativa(utilizador) -> bool:
    cfg = getattr(utilizador, "mfa", None)
    return bool(cfg and cfg.ativa)


def configuracao_pendente(utilizador) -> bool:
    return mfa_obrigatoria(utilizador) and not mfa_ativa(utilizador)


def iniciar_configuracao(utilizador):
    """Gera um novo segredo (ainda inativo). Devolve (segredo, uri otpauth)."""
    from .models import ConfiguracaoMFA

    segredo = pyotp.random_base32()
    ConfiguracaoMFA.objects.update_or_create(
        utilizador=utilizador,
        defaults={"segredo_cifrado": cifrar(segredo), "ativa": False, "ultimo_passo": 0},
    )
    uri = pyotp.TOTP(segredo, interval=INTERVALO).provisioning_uri(name=utilizador.email, issuer_name=EMISSOR)
    return segredo, uri


def _verificar_totp(cfg, codigo: str) -> bool:
    """Aceita a janela atual ±1 passo e impede a reutilização do mesmo código."""
    codigo = "".join(c for c in codigo if c.isdigit())
    if len(codigo) != 6:
        return False
    totp = pyotp.TOTP(decifrar(cfg.segredo_cifrado), interval=INTERVALO)
    agora = int(time.time()) // INTERVALO
    for passo in (agora - 1, agora, agora + 1):
        if passo > cfg.ultimo_passo and secrets.compare_digest(totp.at(passo * INTERVALO), codigo):
            cfg.ultimo_passo = passo
            cfg.save(update_fields=["ultimo_passo"])
            return True
    return False


@transaction.atomic
def ativar(utilizador, codigo: str) -> list[str] | None:
    """Confirma a configuração com um código válido. Devolve os códigos de recuperação."""
    from .models import CodigoRecuperacaoMFA, ConfiguracaoMFA

    cfg = ConfiguracaoMFA.objects.select_for_update().filter(utilizador=utilizador, ativa=False).first()
    if cfg is None or not _verificar_totp(cfg, codigo):
        return None
    cfg.ativa = True
    cfg.ativada_em = timezone.now()
    cfg.save(update_fields=["ativa", "ativada_em"])
    CodigoRecuperacaoMFA.objects.filter(utilizador=utilizador).delete()
    codigos = [f"{secrets.token_hex(2)}-{secrets.token_hex(2)}".upper() for _ in range(N_CODIGOS_RECUPERACAO)]
    CodigoRecuperacaoMFA.objects.bulk_create(
        [CodigoRecuperacaoMFA(utilizador=utilizador, codigo_hash=make_password(_normalizar(c))) for c in codigos]
    )
    return codigos


def _normalizar(codigo: str) -> str:
    return codigo.replace("-", "").replace(" ", "").upper()


@transaction.atomic
def verificar(utilizador, codigo: str) -> str | None:
    """Verifica um código TOTP ou de recuperação. Devolve 'totp', 'recuperacao' ou None."""
    from .models import CodigoRecuperacaoMFA, ConfiguracaoMFA

    cfg = ConfiguracaoMFA.objects.select_for_update().filter(utilizador=utilizador, ativa=True).first()
    if cfg is None:
        return None
    if _verificar_totp(cfg, codigo):
        return "totp"
    normalizado = _normalizar(codigo)
    if len(normalizado) == 8:
        for rec in CodigoRecuperacaoMFA.objects.select_for_update().filter(
            utilizador=utilizador, usado_em__isnull=True
        ):
            if check_password(normalizado, rec.codigo_hash):
                rec.usado_em = timezone.now()
                rec.save(update_fields=["usado_em"])
                return "recuperacao"
    return None


def impressao_digital(segredo: str) -> str:
    """Identificador curto (não secreto) para registos de auditoria."""
    return hashlib.sha256(segredo.encode()).hexdigest()[:8]


@transaction.atomic
def desativar(utilizador) -> None:
    """Remove a configuração MFA e os códigos de recuperação do utilizador."""
    from .models import CodigoRecuperacaoMFA, ConfiguracaoMFA

    ConfiguracaoMFA.objects.filter(utilizador=utilizador).delete()
    CodigoRecuperacaoMFA.objects.filter(utilizador=utilizador).delete()
