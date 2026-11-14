"""Processamento seguro de imagens carregadas pelos utilizadores.

A imagem é aberta e re-codificada (WebP): isto confirma que é mesmo uma imagem,
limita o tamanho e remove metadados EXIF (por exemplo, a localização GPS).
"""

from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024
FORMATOS = {"JPEG", "PNG", "WEBP"}
LADO_MAXIMO = 1600
LADO_MINIATURA = 480


class ImagemInvalida(ValueError):
    pass


def _webp(img: Image.Image, lado: int) -> ContentFile:
    copia = img.copy()
    copia.thumbnail((lado, lado), Image.Resampling.LANCZOS)
    saida = BytesIO()
    copia.save(saida, "WEBP", quality=85, method=4)
    return ContentFile(saida.getvalue())


def processar_fotografia(ficheiro) -> tuple[ContentFile, ContentFile]:
    """Devolve (imagem principal, miniatura) em WebP, ou levanta ImagemInvalida."""
    if ficheiro.size > TAMANHO_MAXIMO_BYTES:
        raise ImagemInvalida("A imagem não pode ter mais de 15 MB.")
    try:
        img = Image.open(ficheiro)
        if img.format not in FORMATOS:
            raise ImagemInvalida("Formato não suportado. Use JPEG, PNG ou WebP.")
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise ImagemInvalida("O ficheiro não é uma imagem válida.") from e
    img = ImageOps.exif_transpose(img)  # respeitar a orientação da câmara
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    return _webp(img, LADO_MAXIMO), _webp(img, LADO_MINIATURA)
