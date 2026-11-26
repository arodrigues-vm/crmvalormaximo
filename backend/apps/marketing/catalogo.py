"""Catálogo original e imutável do Plano de Marketing de Imóveis (Cap. 18, Anexo operacional; AT-05).

As designações originais, incluindo grafias históricas, são mantidas intencionalmente. Não corrigir nem fundir
ocorrências repetidas sem decisão independente.
"""

CATALOGO = [
    (1, 1, "Análise Concorencia"),
    (2, 1, "Video de pré angariação"),
    (3, 1, "Análise swot"),
    (4, 1, "Reportagem fotográfica"),
    (5, 1, "Reportagem videográfiva"),
    (6, 1, "Elaborar da descrição imóvel"),
    (7, 1, "Home staging"),
    (8, 1, "Plano de marketing"),
    (9, 2, "Publicar no site da marca"),
    (10, 2, "Buyer/Seller match"),
    (11, 2, "Partilha na rede"),
    (12, 2, "Publicar nas redes sociais ( Facebook, Insta, Whatsapp, Youtube)"),
    (13, 2, "Distribuição de cartas na envolvente"),
    (14, 3, "Colocação de placa no imóvel"),
    (15, 3, "Partilha com outras agências"),
    (16, 3, "Colocação anuncio na montra da loja"),
    (17, 3, "Publicar nas redes sociais - anuncio patrocinados"),
    (18, 4, "Republicar no site da marca com troca de fotos"),
    (19, 4, "Republicar nas redes sociais (Facebook, Insta, Whatsapp, Youtube)"),
    (20, 4, "Distribuição de Flyers"),
    (21, 5, "Elaboração da ACM"),
    (22, 5, "Agendar reunião presencial com o proprietário"),
    (23, 5, "Apresentar relatório de atividade ao proprietário"),
    (24, 5, "Apresentaçao ACM e discução do asking price"),
    (25, 5, "Republicar no site da marca com troca de fotos"),
    (26, 5, "Republicar nas redes sociais (Facebook, Insta, Whatsapp, Youtube)"),
    (27, 5, "Partilha rede"),
    (28, 5, "Partilha com outras agências"),
    (29, 5, "Buyer/Seller match"),
    (30, 6, "Republicar no site da marca com troca de fotos"),
    (31, 6, "Publicar nas redes sociais - anuncio patrocinados"),
    (32, 6, "Partilha rede"),
    (33, 6, "Partilha com outras agências"),
    (34, 6, "Buyer/Seller match"),
    (35, 7, "Republicar no site da marca com troca de fotos"),
    (36, 7, "Republicar nas redes sociais (Facebook, Insta, Whatsapp, Youtube)"),
    (37, 7, "Partilha rede"),
    (38, 7, "Partilha com outras agências"),
    (39, 7, "Buyer/Seller match"),
    (40, 8, "Agendar reunião presencial com o proprietário"),
    (41, 8, "Apresentar relatório de atividade ao proprietário"),
    (42, 8, "Apresentaçao ACM e discução do asking price"),
    (43, 8, "Republicar no site da marca com troca de fotos"),
    (44, 8, "Publicar nas redes sociais - anuncio patrocinados"),
    (45, 8, "Buyer/Seller match"),
]
SEMANAS = 8


def offset_dias(semana: int) -> int:
    """Semana 1 → +0 dias, semana 2 → +7, …, semana 8 → +49."""
    return 7 * (semana - 1)
