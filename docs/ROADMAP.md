# AST3 — Дорожная карта реализации

> **AST3** (Army Style Task & Time Tracking) — внутренняя платформа управления задачами, временем и проектами для закрытого контура с требованиями ФСТЭК.
> Лицензия проекта: **MIT**. Стек: **Django + Strawberry GraphQL + PostgreSQL (Postgres Pro Certified) + Refine/React + Astra Linux**.

---

## 0. Аналитическая сводка (резюме перед стартом)

### 0.1. Что мы строим
Закрытая on-premise платформа на 30–100 пользователей, объединяющая:
- Канбан-доски и трекинг задач (ПО + производство экспериментальных изделий);
- Учёт рабочего времени (тайм-трекинг);
- Диаграмму Ганта;
- Аналитику прогресса по людям/подразделениям/проектам;
- Автоматический расчёт рисков срыва сроков;
- Полный аудит действий.

### 0.2. Ключевые ограничения
| Ограничение | Следствие |
|---|---|
| ФСТЭК (предположительно КС1/КС2) | Стек только из реестра, свой код, обязательный SDLC с SAST/DAST |
| Только MIT-лицензии зависимостей | Plane/OpenProject/Taiga отпадают как код-база; используем как референс |
| Закрытый контур | Никаких SaaS-зависимостей, оффлайн-установка пакетов, локальные зеркала |
| Свой сертификат на изделие | Версионирование, документация ИБ, формализованный процесс сборки |

### 0.3. Архитектурные принципы
1. **Monorepo** — `backend/` + `client/` + `infra/` + `docs/` в одном репозитории.
2. **API-first** — GraphQL как единственная точка входа для клиента; REST только для системных нужд (healthz, metrics, file upload через tus).
3. **Domain-driven** — разбиение на bounded contexts: `accounts`, `projects`, `tasks`, `tracking`, `risks`, `audit`, `reports`, `integrations`.
4. **Event-driven для фоновой работы** — Celery + Redis (или RabbitMQ, если Redis не пройдёт по ФСТЭК).
5. **RBAC + ABAC** — роли + контекст подразделения/проекта; всё через единый `permissions`-слой.
6. **Audit by design** — каждое мутирующее действие пишется в неизменяемый журнал.
7. **Security by default** — JWT с короткоживущим access + refresh-rotation, CSP, HSTS, защита от IDOR на уровне резолверов.

### 0.4. Целевая архитектура (high-level)
```
              ┌─────────────────────────┐
              │  Reverse proxy (Nginx)  │  TLS, mTLS опционально
              └────────────┬────────────┘
                           │
           ┌───────────────┴────────────────┐
           │                                │
   ┌───────▼────────┐               ┌───────▼────────┐
   │  Refine/React  │               │ Django + ASGI  │
   │   (статика)    │ ── GraphQL ─► │ Strawberry GQL │
   └────────────────┘               └───┬────┬───┬───┘
                                        │    │   │
                              ┌─────────▼┐ ┌─▼──┐│
                              │Postgres  │ │Redis│
                              │  Pro     │ │     │
                              └──────────┘ └──┬──┘
                                              │
                                       ┌──────▼──────┐
                                       │   Celery    │
                                       │  workers +  │
                                       │   beat      │
                                       └─────────────┘
```

### 0.5. Доменная модель (первичный контур)
- `User` — учётная запись, привязана к `Department` и набору `Role`.
- `Department` — иерархическое подразделение (mptt/ltree).
- `Project` — проект с руководителем, участниками, плановыми сроками, типом (`software` | `hardware`).
- `Task` — задача: тип, статус, приоритет, исполнитель, плановые/фактические сроки, оценка, прогресс.
- `TaskDependency` — связи для Ганта (FS/SS/FF/SF).
- `TimeEntry` — запись времени (start/stop или ручная).
- `Risk` — риск (вычисляемый и ручной), уровень, owner, mitigation.
- `Comment`, `Attachment` — обсуждения и файлы (антивирусная проверка обязательна).
- `AuditLog` — журнал действий (append-only).
- `IntegrationJob` — задания обмена файлами с внешними системами.

---

## 1. Roadmap верхнего уровня

| Фаза | Цель | Длительность (ориентир) |
|---|---|---|
| **Ф0. Подготовка** | Репозиторий, CI/CD, инфраструктурные шаблоны, политики ИБ | 2–3 нед. |
| **Ф1. MVP-ядро** | Auth, RBAC, Project/Task CRUD, базовый канбан | 3–4 мес. |
| **Ф2. Тайм-трекинг + Гант** | TimeEntry, таймеры, диаграмма Ганта, зависимости | 2–3 мес. |
| **Ф3. Риски и аналитика** | Авто-расчёт рисков, дашборды, отчёты для руководства | 2 мес. |
| **Ф4. Интеграции и hardening** | Файловый обмен, антивирус, аудит, pen-test | 1–2 мес. |
| **Ф5. Сертификация ФСТЭК** | Документация, испытательная лаборатория, устранение замечаний | 6–12 мес. |

> Pen-test и SAST/DAST встраиваются в CI **с Ф0**, а не в конце.

---

## 2. Детальный TODO-план

### Фаза 0. Подготовка (организационно-технический фундамент)

#### 0.1. Юридическое и процессное
- [ ] Зафиксировать лицензию проекта **MIT** (`LICENSE` в корне).
- [ ] Утвердить класс защиты по ФСТЭК (КС1/КС2/КС3) — от этого зависят требования к стеку и журналированию.
- [ ] Составить реестр разрешённых зависимостей (только MIT/BSD/Apache-2.0/PSF/ISC; AGPL/GPL — запрещены).
- [ ] Подготовить политику SDLC: код-ревью обязательно, 2 аппрува, без force-push в `main`.
- [ ] Назначить ответственных: tech lead, security officer, релиз-менеджер.

#### 0.2. Репозиторий и структура
- [ ] Инициализировать monorepo:
  ```
  /backend     — Django-проект
  /client      — Refine + React
  /infra       — Docker, Ansible/SaltStack, конфиги Nginx
  /docs        — TAD, ADR, runbook'и, документация ИБ
  /scripts     — служебные скрипты (бэкап, миграции, генерация SBOM)
  /tests       — e2e, нагрузочные, security-тесты
  ```
- [ ] Завести `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`.
- [ ] Завести `docs/adr/` (Architecture Decision Records) — каждое крупное решение фиксируется отдельным ADR.

#### 0.3. CI/CD (внутренний GitLab CE / Gitea + собственный runner)
- [ ] Pipeline для backend: `lint (ruff) → typecheck (mypy) → unit (pytest) → SAST (Bandit, Semgrep) → SCA (pip-audit/Safety) → build → integration`.
- [ ] Pipeline для frontend: `lint (eslint) → typecheck (tsc) → unit (vitest) → SAST (eslint-plugin-security) → SCA (npm audit/osv-scanner) → build`.
- [ ] DAST по nightly-расписанию: OWASP ZAP против staging-окружения.
- [ ] Генерация **SBOM** (CycloneDX) на каждый релиз.
- [ ] Подпись артефактов (cosign / GPG) и верификация при деплое.
- [ ] Локальное зеркало pip/npm (devpi, Verdaccio) — для закрытого контура.

#### 0.4. Инфраструктура (dev/stage/prod)
- [ ] Базовый образ: **Astra Linux SE 1.7** (для prod), Debian/Ubuntu для dev (с пометкой "non-prod only").
- [ ] PostgreSQL → план миграции на **Postgres Pro Certified** для prod.
- [ ] Redis (или RabbitMQ — решить ADR'ом исходя из требований ФСТЭК).
- [ ] Nginx с TLS 1.2/1.3, HSTS, OCSP stapling.
- [ ] Контейнеризация через Docker/Podman (Podman предпочтителен как rootless).
- [ ] Бэкап БД: pg_basebackup + WAL-G на изолированное хранилище, тест восстановления — раз в месяц.
- [ ] Централизованные логи: rsyslog / Vector → защищённое хранилище, retention ≥ 1 год.
- [ ] Мониторинг: Prometheus + Grafana + Alertmanager (все MIT/Apache-2.0).

#### 0.5. Документация на старте
- [ ] **TAD** (Technical Architecture Document) — версия 0.1.
- [ ] **Модель угроз** по методике ФСТЭК (БДУ, актуальные угрозы).
- [ ] **Матрица ролей и доступов** (RBAC matrix).
- [ ] **Runbook** для базовых операций (деплой, бэкап, инцидент).

---

### Фаза 1. MVP-ядро (3–4 месяца)

#### 1.1. Backend — каркас
- [ ] Django 5.x, структура: `core/` (settings), приложения по bounded contexts.
- [ ] `pyproject.toml` (Poetry или uv), пиннинг версий, `requirements.lock`.
- [ ] Конфиг через `django-environ`; секреты — только из переменных окружения / Vault.
- [ ] Миграции: `django-migration-linter` в CI.
- [ ] Логирование: structlog + JSON формат, корреляционные ID запросов.
- [ ] Healthcheck endpoints: `/healthz`, `/readyz`.

#### 1.2. Аутентификация и авторизация
- [ ] Кастомная модель `User` (email как логин, поле `department`, `position`, `is_active`, `mfa_enabled`).
- [ ] JWT (access ~15 мин, refresh ~7 дней с rotation и blacklist).
- [ ] Рекомендуется: **`djangorestframework-simplejwt`** (MIT) + интеграция с GraphQL контекстом.
- [ ] Логин с защитой от brute-force (django-axes, MIT).
- [ ] Опционально на Ф1, обязательно к Ф4: TOTP MFA (django-otp, BSD — приемлемо).
- [ ] Парольная политика: длина ≥ 12, проверка на словари (zxcvbn-python), история паролей.
- [ ] Слой `permissions/`: декораторы и хелперы `require_role`, `require_department_access`, `require_project_member`.
- [ ] Все GraphQL-резолверы проходят через permission-чеки **на уровне объекта**, а не только корневого запроса (защита от IDOR).

#### 1.3. Доменные модели (минимальный набор для MVP)
- [ ] `accounts.User`, `accounts.Department` (ltree-иерархия через `django-tree-queries` или `django-ltree`).
- [ ] `accounts.Role`, `accounts.RoleAssignment` (роль может быть глобальной или скоупнутой на department/project).
- [ ] `projects.Project` (поля: `code`, `name`, `type`, `lead`, `department`, `planned_start/end`, `status`).
- [ ] `projects.ProjectMembership` (user, project, role-in-project).
- [ ] `tasks.Task` (см. модель ниже).
- [ ] `tasks.TaskStatus` (настраиваемый workflow на проект, не хардкод).
- [ ] `audit.AuditLog` (append-only, с хэш-цепочкой для tamper-evidence).

```python
# Эскиз tasks.Task
class Task(models.Model):
    code = models.CharField(max_length=32, unique=True)  # PRJ-123
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="tasks")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=32)  # software/hardware/research/...
    status = models.ForeignKey(TaskStatus, on_delete=models.PROTECT)
    priority = models.SmallIntegerField(default=0)
    assignee = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    reporter = models.ForeignKey(User, on_delete=models.PROTECT, related_name="reported_tasks")
    planned_start = models.DateTimeField(null=True, blank=True)
    planned_end = models.DateTimeField(null=True, blank=True)
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)
    estimated_hours = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    progress = models.SmallIntegerField(default=0)  # 0..100
    risk_level = models.SmallIntegerField(default=0)  # вычисляется в Ф3
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

#### 1.4. GraphQL API (Strawberry)
- [ ] Подключить `strawberry-graphql-django` (MIT).
- [ ] Типы для `User`, `Department`, `Project`, `Task`, `TaskStatus`.
- [ ] Queries: `me`, `users`, `departments`, `projects`, `project(id)`, `tasks(filter)`, `task(id)`.
- [ ] Mutations: `createProject`, `updateProject`, `createTask`, `updateTask`, `moveTask` (изменение статуса/позиции на канбане), `assignTask`.
- [ ] DataLoader для устранения N+1.
- [ ] Глобальный middleware: проверка JWT, инъекция `request.user`, корреляционный ID.
- [ ] Лимит сложности запросов (depth limit, cost analysis) — защита от DoS через GraphQL.
- [ ] Отключить introspection в prod.

#### 1.5. Frontend — каркас
- [ ] Инициализация: `npm create refine-app@latest client` → Ant Design + GraphQL data provider.
- [ ] Структура: `src/{providers,resources,components,pages,hooks,gql,styles}`.
- [ ] `authProvider` на JWT с refresh-rotation и автоматическим повтором запроса.
- [ ] `dataProvider` для GraphQL (использовать встроенный refine-graphql или собственный на graphql-request).
- [ ] Кодген типов из схемы: `graphql-codegen` (MIT).
- [ ] Локализация: ru-RU first, en-US second (i18next).
- [ ] Темизация (light/dark), доступность (a11y) — закладываем сразу.
- [ ] CSP-совместимый билд (никаких inline-скриптов без nonce).

#### 1.6. UI MVP
- [ ] Логин / смена пароля / профиль.
- [ ] Список проектов (таблица + фильтры).
- [ ] Карточка проекта с вкладками: Канбан / Список / Участники / Настройки.
- [ ] **Канбан-доска**: drag-n-drop через `@hello-pangea/dnd` (MIT) или `@dnd-kit/core` (MIT).
- [ ] Карточка задачи: просмотр/редактирование, комментарии (заглушка), вложения (заглушка).
- [ ] Управление пользователями и подразделениями (только для админа).

#### 1.7. Тесты MVP
- [ ] Backend: pytest-django, factory_boy, fixtures для ролей. Coverage ≥ 80% по `permissions/` и моделям.
- [ ] GraphQL: snapshot-тесты схемы (защита от случайных breaking changes).
- [ ] Frontend: vitest + @testing-library/react. e2e — Playwright (MIT) на критичных сценариях.

**Definition of Done для Ф1:** пользователь может логиниться, видеть свои проекты, создавать задачи, перетаскивать их на канбане, всё пишется в `AuditLog`, все действия покрыты permission-чеками.

---

### Фаза 2. Тайм-трекинг и диаграмма Ганта (2–3 месяца)

#### 2.1. Тайм-трекинг
- [ ] Модель `tracking.TimeEntry` (`user`, `task`, `start_time`, `end_time`, `duration`, `source`: `timer|manual`, `description`).
- [ ] Инвариант: у пользователя одновременно может быть только один активный таймер (constraint в БД + проверка в сервисе).
- [ ] Mutations: `startTimer(taskId)`, `stopTimer`, `createManualEntry`, `updateEntry`, `deleteEntry` (с аудитом).
- [ ] Запрет редактирования записей старше N дней (закрытие периодов) — настраиваемо.
- [ ] UI: кнопки Play/Stop в карточке задачи, виджет "активный таймер" в шапке, страница "Мои записи" с фильтрами по дате/проекту.
- [ ] Отчёт "Загрузка по сотруднику/подразделению за период".
- [ ] Экспорт CSV/XLSX (`openpyxl`, MIT).

#### 2.2. Зависимости задач и Гант
- [ ] Модель `tasks.TaskDependency` (`predecessor`, `successor`, `type`: FS/SS/FF/SF, `lag`).
- [ ] Валидация: запрет циклов (DFS-проверка при создании).
- [ ] Расчёт критического пути (CPM) — фоновая задача Celery, кэш в Redis.
- [ ] GraphQL query `ganttData(projectId, range)` → плоский список задач + связей в формате под библиотеку.
- [ ] Frontend: компонент Gantt на базе **`gantt-task-react`** (MIT) или **`frappe-gantt-react`** (MIT) — выбрать ADR'ом после PoC.
- [ ] Drag-resize в Ганте → мутация `updateTaskSchedule`.
- [ ] Подсветка критического пути и просроченных задач.

#### 2.3. Календарь и рабочее время
- [ ] Производственный календарь РФ (выходные/праздники) — справочник, обновляется раз в год.
- [ ] Индивидуальные графики работы (опционально на Ф2, обязательно к Ф3 для рисков).
- [ ] Учёт отпусков/больничных (минимально — справочник `Absence`).

**Definition of Done для Ф2:** сотрудник запускает таймер на задаче, RG/PM видит Гант проекта с критическим путём и фактическими часами по задаче.

---

### Фаза 3. Риски и аналитика для руководства (2 месяца)

#### 3.1. Модуль рисков
- [ ] Модель `risks.Risk` (ручные риски: `title`, `description`, `level`, `probability`, `impact`, `owner`, `mitigation`, `status`, `linked_task/project`).
- [ ] Авто-риски на задаче: считаются периодической Celery-задачей (каждые 15 мин или по событию).
- [ ] Правила (вынести в конфиг/БД, чтобы PM мог настраивать):
  - срок до `planned_end` ≤ 20% оставшегося плана и `progress` < ожидаемого → **medium**;
  - `planned_end` в прошлом и статус ≠ done → **high**;
  - блокирующие зависимости не закрыты при близком сроке → **high**;
  - перерасход оценки > 50% → **medium**.
- [ ] Журнал изменений уровня риска (для аудита).
- [ ] Уведомления: email + внутренние нотификации (модель `notifications.Notification`).

#### 3.2. Дашборды
- [ ] Дашборд руководителя: общий прогресс портфеля, риск-хитмап по проектам, топ-5 проблемных задач, загрузка подразделений.
- [ ] Дашборд PM проекта: burndown, распределение задач по статусам, плановые vs фактические часы.
- [ ] Дашборд сотрудника: мои задачи, моё время за неделю/месяц, ближайшие сроки.
- [ ] Графики через **Recharts** (MIT) или **visx** (MIT).
- [ ] Все агрегации — на уровне БД (materialized views или CTE), кэш в Redis с инвалидацией по событию.

#### 3.3. Отчёты
- [ ] Конструктор отчётов (MVP — преднастроенные шаблоны):
  - "Прогресс по подразделениям за период";
  - "Реестр рисков";
  - "Трудозатраты по проекту";
  - "Просроченные задачи".
- [ ] Экспорт в XLSX и PDF (`weasyprint`, BSD — приемлемо; либо headless Chromium).
- [ ] Расписание отчётов: еженедельная рассылка руководителю.

**Definition of Done для Ф3:** в понедельник утром начальник получает на почту PDF со сводкой по портфелю, рисками и отклонениями.

---

### Фаза 4. Интеграции и security hardening (1–2 месяца)

#### 4.1. Файловый обмен с внешними системами
- [ ] Модель `integrations.IntegrationEndpoint` (тип: `inbox_dir|outbox_dir|sftp`, путь, расписание, маппинг).
- [ ] Celery-задачи: периодический скан inbox → создание/обновление сущностей; экспорт в outbox по событию.
- [ ] Все входящие файлы — обязательная антивирусная проверка (**ClamAV** через clamd, GPL у самого AV — но он используется как внешний сервис, не линкуется в код, поэтому совместимо с MIT-проектом).
- [ ] Карантинная зона для подозрительных файлов.
- [ ] Подписи файлов (опционально): проверка ЭП по ГОСТ через КриптоПро CSP (если потребуется).

#### 4.2. Вложения и комментарии (полная реализация)
- [ ] Хранилище: локальная ФС с разграничением доступа на уровне приложения (S3-совместимое — MinIO, AGPL → НЕ берём; вместо него простое FS-хранилище или SeaweedFS Apache-2.0).
- [ ] Загрузка через tus-протокол (resumable) — `tus-js-client` MIT.
- [ ] Все вложения проходят антивирус **до** того, как становятся доступными.
- [ ] Превью только безопасных типов; для остального — только скачивание.

#### 4.3. Security hardening
- [ ] Полный аудит зависимостей: pip-audit, osv-scanner, npm audit — 0 high/critical.
- [ ] Проверка соответствия OWASP ASVS L2.
- [ ] Внутренний pen-test (своими силами или подрядчик с лицензией ФСТЭК).
- [ ] Устранение находок, регресс-тесты на найденные уязвимости.
- [ ] Настройка WAF (опционально — modsecurity с CRS).
- [ ] Rate limiting на уровне Nginx + на уровне GraphQL-резолверов.
- [ ] Защита от GraphQL-специфичных атак: alias overloading, batch attacks, deep queries.

#### 4.4. Аудит и неотказуемость
- [ ] `AuditLog` с цепочкой хэшей (каждая запись содержит hash предыдущей).
- [ ] Периодический выгруз лога в иммутабельное хранилище (WORM).
- [ ] UI просмотра аудита для администратора и офицера ИБ.

**Definition of Done для Ф4:** независимый pen-test пройден без high/critical, файлы из внешних систем безопасно подхватываются, весь аудит работает.

---

### Фаза 5. Сертификация ФСТЭК (6–12 месяцев, параллельно эксплуатации)

- [ ] Финализировать **модель угроз** и **техническое задание** под класс защиты.
- [ ] Подготовить **формуляр**, **описание применения**, **руководство администратора/пользователя**, **руководство по обеспечению безопасности**.
- [ ] Обеспечить идентификацию версии ПО (контрольные суммы дистрибутива).
- [ ] Выбрать испытательную лабораторию ФСТЭК.
- [ ] Передать на испытания, отработать замечания.
- [ ] Получить сертификат, занести изделие в реестр.
- [ ] Регламент поддержки сертифицированной версии (отдельная ветка релизов, контролируемые обновления).

---

## 3. Сквозные практики (применяются на всех фазах)

### 3.1. Безопасная разработка
- [ ] Pre-commit хуки: `ruff`, `mypy --strict` на новых модулях, `eslint`, `prettier`, `gitleaks` (поиск секретов).
- [ ] Branch protection: запрет push в `main`, обязательное ревью, обязательный CI green.
- [ ] Threat modeling по STRIDE для каждой новой крупной фичи (фиксируется ADR'ом).
- [ ] Security champions в команде разработки.

### 3.2. Качество
- [ ] Coverage gate: backend ≥ 80%, frontend ≥ 70%.
- [ ] Performance budget: p95 GraphQL-запроса < 300 мс на типовых выборках; первая отрисовка канбана < 2 с.
- [ ] Нагрузочное тестирование (Locust, MIT) перед каждым major-релизом: профиль 100 одновременных пользователей.

### 3.3. Документация
- [ ] ADR на каждое архитектурное решение.
- [ ] Автогенерация GraphQL-схемы и публикация в `docs/api/`.
- [ ] Журнал релизов (`CHANGELOG.md`) по Keep a Changelog.
- [ ] Документация ИБ ведётся в `docs/security/` и согласуется с офицером ИБ.

### 3.4. Релизы
- [ ] SemVer, теги `vMAJOR.MINOR.PATCH`.
- [ ] Воспроизводимые сборки (фиксированные хэши базовых образов, lock-файлы).
- [ ] Подписанные релизные артефакты + SBOM.

---

## 4. Риски проекта и митигации

| Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|
| Зависимость с несовместимой лицензией | Средняя | Высокое | Автопроверка лицензий (pip-licenses, license-checker) в CI; allowlist |
| Затяжная сертификация ФСТЭК | Высокая | Высокое | Начать сбор документации с Ф0; ранний контакт с лабораторией |
| Уход ключевого разработчика | Средняя | Среднее | Парное программирование, ADR, ≥ 2 владельца на каждый домен |
| Найдены критические уязвимости на pen-test | Высокая | Среднее | SAST/DAST с Ф0, регулярные внутренние ревью ИБ |
| Производительность GraphQL на больших проектах | Средняя | Среднее | DataLoader, materialized views, нагрузочные тесты с Ф2 |
| Несоответствие требованиям к стеку | Низкая | Высокое | Ранняя проверка совместимости Postgres Pro / Astra Linux на Ф0 |

---

## 5. Ближайшие действия (на ближайшие 2 недели)

1. [ ] Утвердить класс защиты по ФСТЭК и перечень допустимых лицензий.
2. [ ] Создать структуру monorepo и базовые `LICENSE`, `README`, `SECURITY.md`, `CONTRIBUTING.md`.
3. [ ] Поднять CI с минимальным набором: lint + unit + SAST (Bandit, Semgrep, eslint-plugin-security) + SCA.
4. [ ] Сделать PoC: Django + Strawberry + Postgres + Refine + GraphQL — минимальный «hello world» с авторизацией.
5. [ ] Написать первые 3 ADR: выбор GraphQL-библиотеки, выбор Gantt-библиотеки, схема аутентификации.
6. [ ] Поднять dev-окружение в Docker Compose (для prod позже — Astra Linux + Podman).
7. [ ] Составить первичную RBAC-матрицу и согласовать с заказчиком.

---

> Документ живой. Все изменения — через PR с пометкой `docs(roadmap)` и аппрувом tech lead + security officer.
