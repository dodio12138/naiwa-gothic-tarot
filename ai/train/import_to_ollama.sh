#!/bin/bash
# 把 Kaggle 导出的 GGUF 放进本机 Ollama。模板与参数照抄 qwen3:1.7b（训练时的提示词格式就是按它对齐的）。
# 用法：bash ai/train/import_to_ollama.sh <gguf 路径> [模型名，默认 naiwa-sft:1.7b]
set -euo pipefail
[ $# -ge 1 ] || { echo "用法：$0 <gguf 路径> [模型名]"; exit 1; }
GGUF="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
NAME="${2:-naiwa-sft:1.7b}"
MF="$(mktemp)"
ollama show qwen3:1.7b --modelfile | sed '/^#/d' | awk '/^LICENSE/{exit} {print}' | sed "s#^FROM .*#FROM $GGUF#" > "$MF"
grep -q "^TEMPLATE" "$MF" || { echo "没取到 qwen3:1.7b 的模板，先 ollama pull qwen3:1.7b"; exit 1; }
ollama create "$NAME" -f "$MF"
rm -f "$MF"
echo "已创建 $NAME。对照："
echo "  python3 ai/runtime/bench.py $NAME"
echo "  python3 ai/train/eval_corpus.py qwen3:1.7b $NAME"
