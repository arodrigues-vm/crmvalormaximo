"""Configuração Django do CRM Valor Máximo.

Todos os segredos e parâmetros dependentes do ambiente vêm de variáveis de
ambiente (ver ``.env.example`` na raiz do repositório). Nunca colocar
credenciais neste ficheiro.
"""

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    DJANGO_CSRF_TRUSTED_ORIGINS=(list, []),
    CRM_AMBIENTE=(str, "dev"),
)
environ.Env.read_env(BASE_DIR.parent / ".env", overwrite=False)

SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env("DJANGO_CSRF_TRUSTED_ORIGINS")

# Identifica o ambiente (dev / test / producao). Usado para impedir operações
# indevidas no ambiente errado e para mostrar o ambiente na interface.
CRM_AMBIENTE = env("CRM_AMBIENTE")
# Em produção a aplicação está atrás do Caddy: o IP real vem em X-Forwarded-For.
CRM_CONFIAR_PROXY = env.bool("CRM_CONFIAR_PROXY", default=False)
# Quantos proxies acrescentam endereços a X-Forwarded-For (1 = Caddy; 2 = nginx + Caddy).
CRM_NUMERO_PROXIES = env.int("CRM_NUMERO_PROXIES", default=1)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "rest_framework",
    "drf_spectacular",
    "simple_history",
    "apps.core",
    "apps.contas",
    "apps.configuracao",
    "apps.localizacao",
    "apps.entidades",
    "apps.imoveis",
    "apps.angariacoes",
    "apps.oportunidades",
    "apps.procuras",
    "apps.agentes",
    "apps.visitas",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.contas.middleware.ExigirConfiguracaoMFA",
    "django.contrib.messages.middleware.MessageMiddleware",
    "simple_history.middleware.HistoryRequestMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Base de dados: apenas PostgreSQL (fonte de verdade única do CRM).
DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["ATOMIC_REQUESTS"] = True
DATABASES["default"]["CONN_MAX_AGE"] = 60

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "contas.Utilizador"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Localização: Portugal. USE_TZ=True guarda instantes em UTC; a apresentação e
# as regras de negócio usam Europe/Lisbon.
LANGUAGE_CODE = "pt-pt"
TIME_ZONE = "Europe/Lisbon"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = env.path("CRM_MEDIA_ROOT", default=BASE_DIR / "media_privada")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.core.autenticacao.SessaoAutenticacao",
    ],
    # Por omissão tudo exige autenticação; endpoints públicos têm de o
    # declarar explicitamente.
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "COERCE_DECIMAL_TO_STRING": True,
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        "entrar": env("CRM_LIMITE_ENTRAR", default="10/min"),
        "recuperar": env("CRM_LIMITE_RECUPERAR", default="5/hour"),
        "mfa": env("CRM_LIMITE_MFA", default="10/min"),
    },
}

# Perfis com autenticação em dois passos obrigatória.
CRM_MFA_PERFIS_OBRIGATORIOS = env.list("CRM_MFA_PERFIS_OBRIGATORIOS", default=["administrador"])
# Tempo máximo entre a palavra-passe e o código MFA (segundos).
CRM_MFA_PENDENTE_SEGUNDOS = 300

# Endereço público da interface (usado nas ligações enviadas por email).
CRM_URL_FRONTEND = env("CRM_URL_FRONTEND", default="http://localhost:5173")

EMAIL_BACKEND = env("DJANGO_EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = env("DJANGO_DEFAULT_FROM_EMAIL", default="CRM Valor Máximo <nao-responder@localhost>")
PASSWORD_RESET_TIMEOUT = 60 * 60 * 2  # 2 horas

SPECTACULAR_SETTINGS = {
    "TITLE": "CRM Valor Máximo — API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SERVE_PERMISSIONS": ["rest_framework.permissions.IsAuthenticated"],
    "COMPONENT_SPLIT_REQUEST": True,
}

# Segurança de sessões e cookies.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 60 * 60 * 10  # 10 horas

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_HSTS_SECONDS = env.int("DJANGO_HSTS_SECONDS", default=0)
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simples": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"},
    },
    "handlers": {
        "consola": {"class": "logging.StreamHandler", "formatter": "simples"},
    },
    "root": {"handlers": ["consola"], "level": env("DJANGO_LOG_LEVEL", default="INFO")},
}
