#!/usr/bin/env bash
set -Eeuo pipefail

network="lightning-tiger-ci-${GITHUB_RUN_ID:-local}-$$"
containers=(lt-ci-admin lt-ci-worker lt-ci-redis lt-ci-db)

cleanup() {
  docker rm -f "${containers[@]}" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$network" >/dev/null
docker run -d --name lt-ci-db --network "$network" \
  -e POSTGRES_DB=lightning_tiger -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  postgres:16.10-alpine >/dev/null
docker run -d --name lt-ci-redis --network "$network" redis:7.4.5-alpine >/dev/null

for _ in {1..30}; do
  docker exec lt-ci-db pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 2
done
docker exec lt-ci-db pg_isready -U postgres >/dev/null

database_url="postgresql://postgres:postgres@lt-ci-db:5432/lightning_tiger?schema=public"
docker run --rm --network "$network" -e DATABASE_URL="$database_url" \
  lightning-tiger-migrator:ci

common_env=(
  -e DATABASE_URL="$database_url"
  -e REDIS_URL=redis://lt-ci-redis:6379
  -e JWT_SECRET=ci-health-secret
  -e CORS_ALLOWED_ORIGINS=http://localhost:10086
  -e WECHAT_APPID=ci-appid
  -e WECHAT_SECRET=ci-secret
  -e MODEL_KEY_ENCRYPTION_KEY=YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=
  -e COS_BUCKET=ci-bucket
  -e COS_REGION=ap-shanghai
  -e COS_SECRET_ID=ci-secret-id
  -e COS_SECRET_KEY=ci-secret-key
)

docker run -d --name lt-ci-admin --network "$network" "${common_env[@]}" \
  lightning-tiger-admin:ci >/dev/null
docker run -d --name lt-ci-worker --network "$network" "${common_env[@]}" \
  lightning-tiger-worker:ci >/dev/null

wait_for_health() {
  local container="$1"
  for _ in {1..45}; do
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container")"
    if [[ "$state" == "healthy" ]]; then return 0; fi
    if [[ "$state" == "unhealthy" || "$state" == "exited" || "$state" == "dead" ]]; then
      docker logs "$container"
      return 1
    fi
    sleep 2
  done
  docker logs "$container"
  return 1
}

wait_for_health lt-ci-admin
wait_for_health lt-ci-worker
