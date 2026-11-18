# md2pptx 0.2.0

将 Markdown 转换为固定版式的可编辑 PPTX。无需 HTML、浏览器或 Office，不调用在线 AI 服务。

## Ubuntu

需要 Node.js 20+（附带 npm）。安装后，在工具目录执行：

```bash
bash ubuntu.sh --install
bash ubuntu.sh --check
bash ubuntu.sh --test
bash ubuntu.sh examples/minimal.md --out output/minimal.pptx
bash ubuntu.sh examples/images.md --out output/images.pptx
```

`--install` 按 `package-lock.json` 安装包含测试依赖的完整环境，需要联网；转换无需联网。`--check` 检查 Node.js、依赖及字体。无参数运行 `bash ubuntu.sh` 等同于转换 minimal 示例。`run.sh` 保留为同一入口的别名。

脚本优先使用 `PPTX_NODE` 指定的可执行文件，其次使用 PATH 中满足版本要求的 Node.js，最后查找 `.runtime/node-*/bin/node`。不自动安装系统软件或修改 PATH 配置文件。

Ubuntu 推荐安装中文字体：

```bash
sudo apt-get update
sudo apt-get install -y fonts-noto-cjk
```

Linux 默认 Noto Sans CJK SC；可用 `PPTX_FONT_SANS` 指定已有字体。字体缺失时 PPTX 阅读器可能替换字体，生成文件前后应核对实际显示。

## Windows 和原生 Node.js 入口

在工具目录执行：

```bash
npm ci --include=dev
npm test
node convert.mjs examples/minimal.md --out output/minimal.pptx
```

Windows 默认 Microsoft YaHei。路径包含空格时使用双引号。

## 转换自己的稿件

```bash
bash ubuntu.sh "资料/report.md" --out "output/report.pptx"
```

输入和输出的相对路径以当前工作目录为基准，图片路径以 Markdown 所在目录为基准。输出目录自动创建；同名 PPTX 已存在时拒绝覆盖。脚本不修改 Markdown。

格式规则见 [FORMAT.md](FORMAT.md)。通用示例：

| 文件 | 演示内容 |
|---|---|
| [minimal.md](examples/minimal.md) | 表格、章节页、列表、公式与备注，共 3 页 |
| [images.md](examples/images.md) | 本地图片引用及图文排版，共 2 页 |

示例中的数值均为虚构演示数据。

## 输出与限制

- `.pptx`：文字可编辑，图片嵌入文件，备注进入 speaker notes。
- `.audit.json`：逐页字号、图表数量、内容底边和备注字数；包含本机输入路径，公开分享前请核对。
- 表格由文本框和横线构成，不是可整体增删行的原生表格。
- 公式转换为线性文本，不是 Office 数学对象。
- 正文超出允许字号和页面空间时失败，不自动改写或删减内容。
- 不支持导入任意 PPTX 母版。自动高度估算不能替代实际视觉检查。

`output/`、`node_modules/`、`.runtime/` 和本地环境文件已加入 `.gitignore`。不要将个人稿件、生成文件或环境文件放入公开示例中。

## 可选 PDF 预览

转换不依赖 LibreOffice。如已安装，可单独导出：

```bash
libreoffice -env:UserInstallation=file:///tmp/md2pptx-preview --headless --convert-to pdf --outdir output output/minimal.pptx
```

测试范围与环境见 [TEST-RESULTS.md](TEST-RESULTS.md)，实现说明见 [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)。
