variable "CONTAINER_REGISTRY" {
  default = "local"
}

variable "IMAGE_TAG" {
  default = "ci"
}

group "ci" {
  targets = ["admin-ci", "worker-ci", "migrator-ci"]
}

group "release" {
  targets = ["admin", "worker", "migrator"]
}

target "common" {
  context = "."
}

target "admin-ci" {
  inherits = ["common"]
  dockerfile = "packages/admin/Dockerfile"
  target = "app"
  tags = ["lightning-tiger-admin:ci"]
}

target "worker-ci" {
  inherits = ["common"]
  dockerfile = "packages/worker/Dockerfile"
  tags = ["lightning-tiger-worker:ci"]
}

target "migrator-ci" {
  inherits = ["common"]
  dockerfile = "packages/admin/Dockerfile"
  target = "migrator"
  tags = ["lightning-tiger-migrator:ci"]
}

target "admin" {
  inherits = ["common"]
  dockerfile = "packages/admin/Dockerfile"
  target = "app"
  tags = ["${CONTAINER_REGISTRY}/lightning-tiger-admin:${IMAGE_TAG}"]
}

target "worker" {
  inherits = ["common"]
  dockerfile = "packages/worker/Dockerfile"
  tags = ["${CONTAINER_REGISTRY}/lightning-tiger-worker:${IMAGE_TAG}"]
}

target "migrator" {
  inherits = ["common"]
  dockerfile = "packages/admin/Dockerfile"
  target = "migrator"
  tags = ["${CONTAINER_REGISTRY}/lightning-tiger-migrator:${IMAGE_TAG}"]
}
