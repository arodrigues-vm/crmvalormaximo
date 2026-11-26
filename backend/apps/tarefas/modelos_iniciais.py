"""Modelos de pós-venda iniciais escolhidos pelo proprietário (D-50). Só se criam se ainda não houver modelos,
para nunca repor modelos que o Administrador tenha alterado ou desativado."""

INICIAIS = [
    ("Mudança de contadores", "Ajudar o cliente com a mudança dos contadores de água, luz e gás.", 7),
    (
        "Contacto de acompanhamento",
        "Perguntar ao cliente como correu a mudança e pedir uma recomendação ou testemunho.",
        30,
    ),
    ("Aniversário da compra", "Contactar o cliente no primeiro aniversário da escritura.", 365),
]


def semear_modelos(**kwargs):
    from .models import ModeloTarefa

    if ModeloTarefa.objects.exists():
        return
    for ordem, (nome, descricao, dias) in enumerate(INICIAIS):
        ModeloTarefa.objects.create(nome=nome, descricao=descricao, dias_apos=dias, ordem=ordem)
