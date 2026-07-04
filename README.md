# Army Style Task & Time Tracking

> AST3

## Быстрый старт

### Требования

- Ubuntu (x86_64 / arm64), Docker Engine и Compose plugin
- `git`

### Старт нового проекта

```bash
git clone <REPO_URL> ast3
cd ast3
chmod +x deploy.sh
./deploy.sh
```

Первый запуск может занять 5–15 минут на сборку Docker-образов.

### Доступ

- UI: http://localhost:8080
- GraphQL: http://localhost:8000/graphql/
- Frontend: http://localhost:5173
- PostgreSQL: `localhost:5433` / `ast3:ast3dev`

Демо-учётные данные: `admin@test.local` / `admin`

### Идемпотентность

Повторный запуск `./deploy.sh` не сломает данные: база не очищается, `seed_demo.py` дубликатов не создаёт.

### Сервисы

```bash
cd infra
docker compose down
docker compose up -d --build
docker compose logs -f backend
```

## Адреса

- http://localhost:3000 — Grafana
- http://localhost:9090 — Prometheus
