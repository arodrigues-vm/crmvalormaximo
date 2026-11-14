"""Validações reutilizáveis (NIF/NIPC, telefones)."""

import phonenumbers
from django.core.exceptions import ValidationError


def nif_valido(nif: str) -> bool:
    """Valida um NIF/NIPC português: 9 dígitos e dígito de controlo (módulo 11).

    Não restringe o prefixo, para não recusar categorias válidas menos comuns.
    """
    if len(nif) != 9 or not nif.isdigit():
        return False
    soma = sum(int(d) * (9 - i) for i, d in enumerate(nif[:8]))
    controlo = 11 - soma % 11
    if controlo >= 10:
        controlo = 0
    return controlo == int(nif[8])


def validar_nif_pt(nif: str):
    if not nif_valido(nif):
        raise ValidationError("NIF/NIPC inválido.", code="nif_invalido")


def normalizar_telefone(regiao: str, numero: str) -> str:
    """Devolve o número em formato E.164 ou levanta ValidationError."""
    try:
        n = phonenumbers.parse(numero, regiao.upper())
    except phonenumbers.NumberParseException as e:
        raise ValidationError("Número de telefone inválido.", code="telefone_invalido") from e
    if not phonenumbers.is_valid_number(n):
        raise ValidationError("Número de telefone inválido para o país indicado.", code="telefone_invalido")
    return phonenumbers.format_number(n, phonenumbers.PhoneNumberFormat.E164)


def paises_telefone() -> list[dict]:
    """Regiões suportadas com o respetivo indicativo (os nomes são traduzidos na interface)."""
    return sorted(
        (
            {"regiao": r, "indicativo": f"+{phonenumbers.country_code_for_region(r)}"}
            for r in phonenumbers.SUPPORTED_REGIONS
        ),
        key=lambda p: p["regiao"],
    )
