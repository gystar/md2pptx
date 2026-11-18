#!/usr/bin/env bash
# Relative Markdown and PPTX paths are resolved from the caller's directory.
set -euo pipefail
TOOL_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'HELP'
Ubuntu Markdown → PPTX
  bash ubuntu.sh --install              安装 package-lock.json 中的依赖
  bash ubuntu.sh --check                检查 Node.js、依赖和字体
  bash ubuntu.sh --test                 运行工具回归测试
  bash ubuntu.sh input.md --out out.pptx 转换指定文件，不覆盖已有输出
  bash ubuntu.sh                       转换 examples/minimal.md

PPTX_NODE       指定 Node.js 可执行文件路径
PPTX_FONT_SANS  指定字体，Linux 默认 Noto Sans CJK SC
安装依赖需要联网；转换无需联网。脚本不会安装系统软件或修改 Markdown。
HELP
}
case "${1:-}" in
  --help|-h) usage; exit 0 ;;
esac

node_supported() {
  [[ -x "$1" ]] && "$1" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' >/dev/null 2>&1
}
NODE_BIN=""
if [[ -n "${PPTX_NODE:-}" ]]; then
  if node_supported "$PPTX_NODE"; then NODE_BIN="$PPTX_NODE"; fi
else
  NODE_CANDIDATE="$(command -v node || true)"
  if node_supported "$NODE_CANDIDATE"; then
    NODE_BIN="$NODE_CANDIDATE"
  else
    # A locally supplied Node.js distribution can be stored under .runtime/.
    shopt -s nullglob
    for NODE_CANDIDATE in "$TOOL_DIR"/.runtime/node-*/bin/node; do
      if node_supported "$NODE_CANDIDATE"; then NODE_BIN="$NODE_CANDIDATE"; break; fi
    done
    shopt -u nullglob
  fi
fi
if [[ -z "$NODE_BIN" ]]; then
  echo '需要 Node.js >=20（附带 npm）。请安装后加入 PATH，或将 PPTX_NODE 设置为 node 的绝对路径。' >&2
  exit 1
fi
NODE_BIN="$(cd -- "$(dirname -- "$NODE_BIN")" && pwd)/$(basename -- "$NODE_BIN")"
export PATH="$(dirname -- "$NODE_BIN"):$PATH"

check_dependencies() {
  "$NODE_BIN" --input-type=module - "$TOOL_DIR/package.json" <<'JS'
import {createRequire} from 'node:module';
const require = createRequire(process.argv[2]);
try {
  for (const name of ['pptxgenjs', 'image-size', 'jszip']) require.resolve(name);
} catch (error) {
  console.error('依赖缺失；请先运行 ubuntu.sh --install。' + '\n' + error.message);
  process.exit(1);
}
JS
}
check_font() {
  local requested="${PPTX_FONT_SANS:-Noto Sans CJK SC}"
  if command -v fc-match >/dev/null 2>&1; then
    local matched
    matched="$(fc-match -f '%{family}' "$requested")"
    echo "字体：$requested → $matched"
    if [[ "$matched" != *"$requested"* ]]; then
      echo '提示：字体被替换；可安装 fonts-noto-cjk 或通过 PPTX_FONT_SANS 指定已有字体。' >&2
    fi
  else
    echo '提示：未安装 fontconfig，无法核对字体；不影响生成 PPTX。' >&2
  fi
}
case "${1:-}" in
  --install)
    if ! command -v npm >/dev/null 2>&1; then
      echo '未找到 npm；请使用附带 npm 的完整 Node.js 安装。' >&2; exit 1
    fi
    cd -- "$TOOL_DIR"
    npm ci --include=dev --no-audit --no-fund
    check_dependencies
    check_font
    exit 0
    ;;
  --check)
    echo "Node.js：$("$NODE_BIN" --version) ($NODE_BIN)"
    check_dependencies
    check_font
    echo '环境检查通过。字体替换提示需按实际展示环境处理。'
    exit 0
    ;;
  --test)
    check_dependencies
    exec "$NODE_BIN" "$TOOL_DIR/test.mjs"
    ;;
esac
check_dependencies
if [[ $# -eq 0 ]]; then
  DEFAULT_INPUT="$TOOL_DIR/examples/minimal.md"
  if [[ ! -f "$DEFAULT_INPUT" ]]; then
    echo '未找到 minimal.md 示例，请显式指定 input.md 和 --out output.pptx。' >&2
    exit 1
  fi
  set -- "$DEFAULT_INPUT" --out "$TOOL_DIR/output/minimal.pptx"
fi
exec "$NODE_BIN" "$TOOL_DIR/convert.mjs" "$@"
