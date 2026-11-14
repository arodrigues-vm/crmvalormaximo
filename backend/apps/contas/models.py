"""Utilizadores, equipas, perfis de acesso e matriz de permissões.

Distinção fundamental (Especificação §29/§35):
- *perfil de acesso* (Administrador, Responsável de Equipa, Consultor, Assistente)
  determina o que a pessoa pode fazer na aplicação;
- *função comercial* (ex.: Agente de Angariação) é apenas informativa;
- o papel comercial de uma Entidade (proprietário, comprador…) nada tem a ver
  com acesso à aplicação.
"""

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.db.models.functions import Lower


class Perfil(models.TextChoices):
    ADMINISTRADOR = "administrador", "Administrador"
    RESPONSAVEL = "responsavel", "Responsável de Equipa"
    CONSULTOR = "consultor", "Consultor"
    ASSISTENTE = "assistente", "Assistente"


class Operacao(models.TextChoices):
    CONSULTAR = "consultar", "Consultar"
    CRIAR = "criar", "Criar"
    EDITAR = "editar", "Editar"
    ELIMINAR = "eliminar", "Eliminar / enviar para lixeira"
    RESTAURAR = "restaurar", "Restaurar"
    APROVAR = "aprovar", "Aprovar"
    EXPORTAR = "exportar", "Exportar"
    PARTILHAR = "partilhar", "Partilhar"
    TRANSFERIR = "transferir", "Transferir"
    ADMINISTRAR = "administrar", "Administrar configurações"


class Ambito(models.TextChoices):
    """Que registos uma permissão abrange. A ordem é crescente."""

    NENHUM = "nenhum", "Nenhum"
    ATRIBUIDOS = "atribuidos", "Atribuídos ou partilhados"
    EQUIPA = "equipa", "Da equipa"
    TODOS = "todos", "Todos"


ORDEM_AMBITO = {Ambito.NENHUM: 0, Ambito.ATRIBUIDOS: 1, Ambito.EQUIPA: 2, Ambito.TODOS: 3}


class Equipa(models.Model):
    nome = models.CharField(max_length=120, unique=True)
    ativa = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nome"]
        verbose_name = "equipa"
        verbose_name_plural = "equipas"

    def __str__(self):
        return self.nome


class GestorUtilizadores(BaseUserManager):
    use_in_migrations = True

    def _criar(self, email, password, **campos):
        if not email:
            raise ValueError("O email é obrigatório.")
        email = self.normalize_email(email).lower()
        utilizador = self.model(email=email, **campos)
        utilizador.set_password(password)
        utilizador.save(using=self._db)
        return utilizador

    def create_user(self, email, password=None, **campos):
        campos.setdefault("is_staff", False)
        campos.setdefault("is_superuser", False)
        return self._criar(email, password, **campos)

    def create_superuser(self, email, password=None, **campos):
        campos.setdefault("is_staff", True)
        campos.setdefault("is_superuser", True)
        campos.setdefault("perfil", Perfil.ADMINISTRADOR)
        return self._criar(email, password, **campos)


class Utilizador(AbstractUser):
    """Conta individual de acesso. O login é feito pelo email."""

    username = None
    email = models.EmailField("email", unique=True)
    nome = models.CharField(max_length=150)
    perfil = models.CharField(max_length=20, choices=Perfil.choices, default=Perfil.CONSULTOR)
    equipa = models.ForeignKey(
        Equipa, null=True, blank=True, on_delete=models.PROTECT, related_name="membros"
    )
    funcao_comercial = models.CharField(
        "função comercial", max_length=80, blank=True, help_text="Informativa; não concede acessos."
    )

    first_name = None
    last_name = None

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nome"]

    objects = GestorUtilizadores()

    class Meta:
        ordering = ["nome"]
        verbose_name = "utilizador"
        verbose_name_plural = "utilizadores"
        constraints = [models.UniqueConstraint(Lower("email"), name="utilizador_email_unico_ci")]

    def __str__(self):
        return self.nome or self.email

    def save(self, *args, **kwargs):
        self.email = (self.email or "").strip().lower()
        super().save(*args, **kwargs)

    @property
    def e_administrador(self) -> bool:
        return self.is_active and (self.perfil == Perfil.ADMINISTRADOR or self.is_superuser)


class PermissaoPerfil(models.Model):
    """Matriz configurável: perfil × módulo × operação → âmbito."""

    perfil = models.CharField(max_length=20, choices=Perfil.choices)
    modulo = models.CharField(max_length=40)
    operacao = models.CharField(max_length=20, choices=Operacao.choices)
    ambito = models.CharField(max_length=12, choices=Ambito.choices, default=Ambito.NENHUM)

    class Meta:
        verbose_name = "permissão de perfil"
        verbose_name_plural = "permissões de perfil"
        constraints = [
            models.UniqueConstraint(fields=["perfil", "modulo", "operacao"], name="permissao_perfil_unica")
        ]

    def __str__(self):
        return f"{self.get_perfil_display()} · {self.modulo} · {self.operacao} → {self.ambito}"


class PermissaoUtilizador(models.Model):
    """Exceção individual que substitui o âmbito do perfil para um utilizador."""

    utilizador = models.ForeignKey(Utilizador, on_delete=models.CASCADE, related_name="permissoes_proprias")
    modulo = models.CharField(max_length=40)
    operacao = models.CharField(max_length=20, choices=Operacao.choices)
    ambito = models.CharField(max_length=12, choices=Ambito.choices)

    class Meta:
        verbose_name = "permissão individual"
        verbose_name_plural = "permissões individuais"
        constraints = [
            models.UniqueConstraint(
                fields=["utilizador", "modulo", "operacao"], name="permissao_utilizador_unica"
            )
        ]

    def __str__(self):
        return f"{self.utilizador} · {self.modulo} · {self.operacao} → {self.ambito}"
