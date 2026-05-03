# Допустимые лицензии зависимостей (License Allowlist)

Проект AST3 распространяется под лицензией **MIT**.
Все зависимости — прямые и транзитивные — должны быть совместимы с MIT при закрытом использовании
и соответствовать требованиям ФСТЭК (не содержать вирусных копилефт-условий).

## Разрешённые лицензии

| Лицензия | SPDX ID | Примечание |
|----------|---------|------------|
| MIT | `MIT` | |
| BSD 2-Clause | `BSD-2-Clause` | |
| BSD 3-Clause | `BSD-3-Clause` | |
| Apache 2.0 | `Apache-2.0` | Допустимо при наличии NOTICE |
| Python Software Foundation | `PSF-2.0` | |
| ISC | `ISC` | |
| CC0 1.0 | `CC0-1.0` | Только для данных/документации |
| Unlicense | `Unlicense` | |

## Запрещённые лицензии

| Лицензия | SPDX ID | Причина |
|----------|---------|---------|
| GNU GPL (любая версия) | `GPL-2.0-only`, `GPL-3.0-only` | Вирусное копилефт |
| GNU AGPL | `AGPL-3.0-only` | Вирусное копилефт + требование публикации сетевого кода |
| GNU LGPL | `LGPL-2.0-only`, `LGPL-2.1-only`, `LGPL-3.0-only` | Требует LGPL-совместимого связывания |
| Server Side Public License | `SSPL-1.0` | |
| Commons Clause (любая лицензия + Commons Clause) | — | Ограничение коммерческого использования |
| Proprietary / Commercial | — | |

## Процедура проверки

### Backend (Python)

```bash
pip-licenses --from=all --format=csv \
  --allow-only="MIT;BSD-2-Clause;BSD-3-Clause;Apache-2.0;PSF-2.0;ISC;CC0-1.0;Unlicense;Python-2.0" \
  --output-file=reports/python-licenses.csv
```

Выполняется автоматически в `.github/workflows/backend.yml` задание `license-check`.

### Frontend (Node.js)

```bash
npx license-checker --onlyAllow "MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;CC0-1.0;Unlicense" \
  --csv --out reports/node-licenses.csv
```

Выполняется автоматически в `.github/workflows/frontend.yml`.

## Порядок добавления новой зависимости с «серой» лицензией

1. Открыть задачу в трекере с тегом `license-review`.
2. Получить согласование юридической службы (если проект коммерческий).
3. Задокументировать исключение ниже.

## Исключения (approved exceptions)

_Нет утверждённых исключений на дату написания документа._
