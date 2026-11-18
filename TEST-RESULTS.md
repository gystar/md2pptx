# 测试记录

日期：2026-11-18。版本：0.2.0。

## 本次验证

环境为 Ubuntu、Node.js 22.23.5，字体为 Noto Sans CJK SC。

| 检查 | 结果 |
|---|---|
| `bash ubuntu.sh --check` | Node.js、转换及测试依赖可用，字体匹配 |
| `bash ubuntu.sh --test` | 通过 |
| minimal 示例转换 | 生成 3 页 PPTX |
| images 示例转换 | 生成 2 页 PPTX |
| Shell 语法及无效 Node.js 路径 | 语法检查通过，无效路径明确报错 |
| 独立目录发布复验 | 仅复制发布清单文件，使用 npm 缓存离线安装 18 个包、测试及默认示例转换均通过 |

回归测试核对文字示例的全部正文、表格单元格、公式转换结果和备注；图片示例核对两个图片对象及实际嵌入的原始图片字节。还覆盖 BOM/CRLF、非法表格、异常图片语法、未闭合及未知公式、超长标题、缺图、重复标题/备注和输出防覆盖。

## 验证边界

本次更换为通用示例，未改动转换算法。页底检查依据布局估算；本次两个通用示例尚未在 Windows PowerPoint 中目视复核。未执行完整 OOXML schema 验证，跨平台字体与换行仍需按实际稿件预览。

## 复验

```bash
bash ubuntu.sh --install
bash ubuntu.sh --check
bash ubuntu.sh --test
```

`SHA256SUMS.json` 为当前可发布源文件的校验清单，不包含自身及忽略目录。
