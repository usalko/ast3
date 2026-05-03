# Runbook: Инцидент безопасности

## Severity Matrix

| S | Описание | SLA ответа |
|---|----------|-----------|
| 1 | Активная эксплуатация / утечка данных | 15 мин |
| 2 | Обнаруженная критическая уязвимость (CVSS ≥ 9) | 4 часа |
| 3 | Высокая уязвимость (CVSS 7–8.9) | 24 часа |
| 4 | Средняя / низкая уязвимость | 72 часа |

## S1 / S2 — Активный инцидент

```
1. ИЗОЛЯЦИЯ
   □ Перевести nginx в режим обслуживания (503)
   □ Заблокировать подозрительные IP в nginx/fail2ban
   □ Ротировать SECRET_KEY и все JWT (logout всех пользователей)
   □ Ротировать пароль БД

2. ФИКСАЦИЯ СЛЕДОВ
   □ Сохранить логи nginx: /var/log/nginx/access.log
   □ Сохранить audit_log из БД: SELECT * FROM audit_auditlog ORDER BY timestamp DESC LIMIT 1000
   □ Сохранить docker logs: docker compose logs --no-log-prefix backend > incident-backend.log

3. РАССЛЕДОВАНИЕ
   □ Проверить audit_log на предмет аномальных действий
   □ Запустить ClamAV полное сканирование тома media: clamscan -r /media
   □ Проверить hash-chain AuditLog (скрипт verify_audit_chain)

4. УВЕДОМЛЕНИЕ
   □ Уведомить ФСТЭК (если персональные данные) в течение 24 часов
   □ Уведомить руководство

5. ВОССТАНОВЛЕНИЕ
   □ Устранить уязвимость, выпустить патч
   □ Восстановить из последней чистой резервной копии при необходимости
   □ Провести pen-test после устранения
```

## Полезные команды

```bash
# Проверить активные JWT-сессии (blacklist)
python manage.py shell -c "from rest_framework_simplejwt.token_blacklist.models import OutstandingToken; print(OutstandingToken.objects.count())"

# Ротация SECRET_KEY (logout всех пользователей)
# 1. Сгенерировать новый ключ
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
# 2. Обновить SECRET_KEY в .env
# 3. Перезапустить сервисы

# Блокировка IP в Axes
python manage.py axes_reset_ip --ip 1.2.3.4
```
