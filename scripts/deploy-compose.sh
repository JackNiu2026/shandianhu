#!/usr/bin/env bash
set -Eeuo pipefail

: "${CONTAINER_REGISTRY:?CONTAINER_REGISTRY is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
[[ "$IMAGE_TAG" =~ ^sha-[0-9a-f]{40}$ ]] || { echo "Refusing mutable image tag: $IMAGE_TAG"; exit 1; }

state_dir=".deploy"
mkdir -p "$state_dir"
current_file="$state_dir/current-image-tag"
previous_tag="$(cat "$current_file" 2>/dev/null || true)"

wait_for_service() {
  local service="$1"
  local container
  container="$(docker compose ps -q "$service")"
  [[ -n "$container" ]] || return 1
  for _ in {1..45}; do
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container")"
    [[ "$state" == "healthy" ]] && return 0
    [[ "$state" == "unhealthy" || "$state" == "exited" || "$state" == "dead" ]] && return 1
    sleep 2
  done
  return 1
}

export CONTAINER_REGISTRY IMAGE_TAG
docker compose up -d db redis
docker compose pull migrate admin worker

# Schema changes must follow the expand-contract rule. Application rollback does not undo migrations.
docker compose run --rm migrate

rollback() {
  if [[ -z "$previous_tag" ]]; then
    echo "Deployment failed and no previous image tag is recorded." >&2
    return 1
  fi
  echo "Deployment failed; rolling application containers back to $previous_tag" >&2
  export IMAGE_TAG="$previous_tag"
  docker compose up -d --no-deps --force-recreate admin worker
  wait_for_service admin
  wait_for_service worker
  echo "Application rollback is healthy: $previous_tag" >&2
}
trap rollback ERR

docker compose up -d --no-deps --force-recreate admin worker

wait_for_service admin
wait_for_service worker
curl --fail --silent --show-error "http://127.0.0.1:${ADMIN_PORT:-3000}/api/health/ready" >/dev/null

trap - ERR
printf '%s\n' "$IMAGE_TAG" > "$current_file"
echo "Deployment complete: $IMAGE_TAG"
