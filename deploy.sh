#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$REPO_DIR/infra"

if [[ ! -f "$INFRA_DIR/docker-compose.yml" ]]; then
  echo "Ошибка: запускайте скрипт из корня репо ast3."
  exit 1
fi

ensure_cmd() {
  command -v "$1" >/dev/null 2>&1
}

install_docker_ubuntu() {
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg lsb-release
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $CODENAME stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
  echo "Docker установлен. Перелогиньтесь и запустите скрипт снова."
  exit 0
}

if ! ensure_cmd docker; then
  echo "Docker не найден. Устанавливаю..."
  install_docker_ubuntu
fi

if ! ensure_cmd docker-compose && ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose плагин не найден. Устанавливаю..."
  sudo apt-get update
  sudo apt-get install -y docker-compose-plugin
fi

if ! groups | grep -q docker; then
  echo "Пользователь $USER не в группе docker. Добавляю..."
  sudo usermod -aG docker "$USER"
  echo "Перелогиньтесь или выполните 'newgrp docker' и запустите ./deploy.sh снова."
  exit 1
fi

cd "$INFRA_DIR"

echo "Останавливаю предыдущий стек..."
docker compose down --remove-orphans || true

echo "Собираю и поднимаю стек..."
docker compose up -d --build

echo "Ожидаю готовности бэкенда..."
for i in $(seq 1 30); do
  if curl -fsS http://localhost:8000/graphql/ >/dev/null 2>&1; then
    echo "Бэкенд готов (попытка $i)"
    break
  fi
  echo "  жду... ($i)"
  sleep 5
done

echo "Заполняю демо-данными..."
docker exec -e DJANGO_SETTINGS_MODULE=core.settings.dev infra-backend-1 python /app/seed_demo.py
SEED_EXIT=$?
if [[ $SEED_EXIT -ne 0 ]]; then
  echo "FAIL seed_demo.py (exit=$SEED_EXIT)"
else
  echo "OK seed_demo.py"
fi

PASS=0

check() {
  local url="$1" name="$2"
  if curl -fsS "$url" >/dev/null 2>&1; then
    echo "OK $name: $url"
    PASS=$((PASS+1))
  else
    echo "FAIL $name: $url"
  fi
}

check "http://localhost:8080/" "Nginx"
check "http://localhost:8000/graphql/" "Backend GraphQL"
check "http://localhost:5173/" "Frontend"

if [[ "$PASS" -gt 0 ]]; then
  echo ""
  echo "Проект запущен:"
  echo "  UI:         http://localhost:8080"
  echo "  Frontend:   http://localhost:5173"
  echo "  GraphQL:    http://localhost:8000/graphql/"
  echo "  PostgreSQL: localhost:5433 / ast3:ast3dev"
  echo "  Grafana:    http://localhost:3000"
  echo "  Prometheus: http://localhost:9090"
  echo ""
  echo "Логи:  cd infra && docker compose logs -f <service>"
else
  echo ""
  echo "Не всё поднялось. Логи:"
  docker compose logs --tail=200
  exit 1
fi
