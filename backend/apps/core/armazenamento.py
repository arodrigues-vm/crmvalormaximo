"""Ficheiros privados: guardados em MEDIA_ROOT (fora da pasta pública) e servidos
apenas por vistas que verificam as permissões. Não existe URL direto."""

from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class ArmazenamentoPrivado(FileSystemStorage):
    def url(self, name):
        raise NotImplementedError("Ficheiros privados não têm URL público; use a vista da API.")


def armazenamento_privado_fn():
    return armazenamento_privado


# Sem `location`: segue sempre settings.MEDIA_ROOT (incluindo alterações em testes).
armazenamento_privado = ArmazenamentoPrivado()
