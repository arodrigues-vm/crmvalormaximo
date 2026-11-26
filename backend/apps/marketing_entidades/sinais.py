"""Gatilhos do Marketing de Entidades (D-55) e revisão automática quando o RGPD da entidade muda.

Só atuam planos ativos com o gatilho ligado: o CRM nasce sem planos (D-04)."""

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.core.models import Interacao
from apps.entidades.models import Entidade
from apps.transacoes.models import Transacao
from apps.visitas.models import Visita


def _depois(fn):
    """Corre depois de a transação gravar (nunca a meio de uma gravação que ainda pode falhar)."""
    transaction.on_commit(fn)


@receiver(pre_save, sender=Entidade)
def _entidade_antes(sender, instance, **kwargs):
    antes = Entidade.objects.filter(pk=instance.pk).values("oposicao_marketing", "consentimento_marketing").first()
    instance._rgpd_antes = antes


@receiver(post_save, sender=Entidade)
def _entidade_gravada(sender, instance, created, **kwargs):
    from .servicos import disparar, rever_rgpd

    if created:
        _depois(lambda: disparar("entidade_criada", instance))
        return
    antes = getattr(instance, "_rgpd_antes", None)
    agora = {
        "oposicao_marketing": instance.oposicao_marketing,
        "consentimento_marketing": instance.consentimento_marketing,
    }
    if antes is not None and antes != agora:
        _depois(lambda: rever_rgpd(instance))


@receiver(post_save, sender=Interacao)
def _contacto(sender, instance, created, **kwargs):
    from .servicos import disparar

    if created and instance.tipo_conteudo_id == ContentType.objects.get_for_model(Entidade).pk:
        e = Entidade.objects.filter(pk=instance.objeto_id).first()
        if e is not None:
            _depois(lambda: disparar("contacto_registado", e))


def _categoria_antes(sender, instance):
    return sender.objects.filter(pk=instance.pk).values_list("estado__categoria", flat=True).first()


@receiver(pre_save, sender=Visita)
def _visita_antes(sender, instance, **kwargs):
    instance._cat_antes = _categoria_antes(sender, instance)


@receiver(post_save, sender=Visita)
def _visita(sender, instance, **kwargs):
    from .servicos import disparar

    agora = instance.estado.categoria if instance.estado_id else None
    if agora == "realizada" and getattr(instance, "_cat_antes", None) != "realizada" and instance.entidade_id:
        _depois(lambda: disparar("visita_realizada", instance.entidade))


@receiver(pre_save, sender=Transacao)
def _transacao_antes(sender, instance, **kwargs):
    instance._cat_antes = _categoria_antes(sender, instance)


@receiver(post_save, sender=Transacao)
def _transacao(sender, instance, **kwargs):
    from .servicos import disparar

    agora = instance.estado.categoria if instance.estado_id else None
    if agora == "concluida" and getattr(instance, "_cat_antes", None) != "concluida" and instance.entidade_id:
        _depois(lambda: disparar("negocio_concluido", instance.entidade))
