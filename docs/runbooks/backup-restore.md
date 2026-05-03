# Runbook: Резервное копирование и восстановление PostgreSQL

## Обзор

| Параметр | Значение |
|----------|---------|
| Инструмент | `pg_basebackup` + WAL-G |
| Расписание | Ежедневно 03:00 UTC |
| Retention | 7 ежедневных + 4 еженедельных |
| RTO цель | < 1 час |
| RPO цель | < 5 минут (WAL streaming) |

## Ручной запуск резервной копии

```bash
cd /path/to/ast3
./scripts/backup.sh
```

Скрипт создаёт `.tar.gz` дамп базы в `$BACKUP_DIR` и логирует результат в `$LOG_FILE`.

## Восстановление из резервной копии

```bash
# 1. Остановить backend и celery
docker compose -f infra/docker-compose.yml stop backend celery-worker celery-beat

# 2. Запустить восстановление
./scripts/restore.sh /path/to/backup-YYYYMMDD-HHMMSS.tar.gz

# 3. Поднять сервисы
docker compose -f infra/docker-compose.yml start backend celery-worker celery-beat

# 4. Запустить smoke-test
curl -f https://your.domain/healthz && echo "OK"
```

## Проверка целостности резервной копии

```bash
# Проверить checksum
sha256sum -c /backups/backup-YYYYMMDD-HHMMSS.tar.gz.sha256

# Тестовое восстановление в отдельный контейнер
docker run --rm -e POSTGRES_PASSWORD=test -v \
  /backups/backup-YYYYMMDD-HHMMSS.tar.gz:/backup.tar.gz \
  postgres:16-alpine sh -c "tar -xzf /backup.tar.gz -C /var/lib/postgresql/data && echo RESTORE_OK"
```

## Алерты

| Алерт | Условие | Действие |
|-------|---------|---------|
| `BackupMissing` | Нет новой резервной копии за 25 часов | Запустить `backup.sh` вручную; проверить cron/celery-beat |
| `DiskSpaceLow` | < 20% свободного места на томе резервных копий | Очистить старые бэкапы, расширить том |
| `RestoreTestFailed` | Еженедельный тест восстановления упал | Немедленно расследовать; резервная копия может быть испорчена |
