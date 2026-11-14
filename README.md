# CRM Valor Máximo

Aplicação profissional de CRM imobiliário da **Valor Máximo — Soluções Imobiliárias**.

*Mais valor para o seu futuro.*

- **Frontend:** React + TypeScript (PWA), em `frontend/`
- **Backend:** Django + Django REST Framework, em `backend/`
- **Base de dados:** PostgreSQL
- **Documentação e decisões:** `documentacao/`

## Arrancar em desenvolvimento (Windows, com Docker Desktop)

1. Instalar o [Docker Desktop](https://www.docker.com/products/docker-desktop/) e o Git.
2. Clonar o repositório e entrar na pasta.
3. Copiar `.env.example` para `.env` e trocar `DJANGO_SECRET_KEY` por um valor aleatório.
4. Executar:

   ```bash
   docker compose up --build
   ```

5. Abrir <http://localhost:5173>. O estado da API está em <http://localhost:8000/api/saude/>.

## Arrancar sem Docker

Requer Python 3.12+, Node 22 e PostgreSQL 16 local.

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt   # Windows (Linux/macOS: .venv/bin/pip)
python manage.py migrate
python manage.py runserver
```

```bash
cd frontend
npm install
npm run dev
```

## Testes

```bash
cd backend && pytest
```

```bash
cd frontend && npm test
```

Os testes correm também automaticamente no GitHub Actions a cada envio.
