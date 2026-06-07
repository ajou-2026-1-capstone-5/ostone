#!/usr/bin/env sh
set -eu

host="${LLM_SERVER_HOST:-0.0.0.0}"
port="${LLM_SERVER_PORT:-8000}"
model_path="${LLM_MODEL_PATH:-/models/model.gguf}"

if [ ! -f "$model_path" ]; then
  echo "LLM model file not found: $model_path" >&2
  echo "Mount or pre-seed a GGUF model at LLM_MODEL_PATH before starting the LLM service." >&2
  exit 78
fi

if command -v llama-server >/dev/null 2>&1; then
  server_bin="$(command -v llama-server)"
elif [ -x /app/llama-server ]; then
  server_bin="/app/llama-server"
elif [ -x /usr/local/bin/llama-server ]; then
  server_bin="/usr/local/bin/llama-server"
else
  echo "llama-server binary not found in the base image." >&2
  exit 127
fi

ctx_size="${LLM_CONTEXT_SIZE:-8192}"
parallel="${LLM_PARALLEL:-1}"
n_gpu_layers="${LLM_N_GPU_LAYERS:-999}"
model_name="${LLM_MODEL_NAME:-}"
api_key="${LLM_RUNTIME_API_KEY:-}"

set -- "$server_bin" \
  --host "$host" \
  --port "$port" \
  --model "$model_path" \
  --ctx-size "$ctx_size" \
  --parallel "$parallel" \
  --n-gpu-layers "$n_gpu_layers"

if [ -n "$model_name" ]; then
  set -- "$@" --alias "$model_name"
fi

if [ -n "$api_key" ]; then
  set -- "$@" --api-key "$api_key"
fi

exec "$@"
