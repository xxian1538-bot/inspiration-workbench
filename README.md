# 灵感工作台原型

网页部署文件位于仓库根目录，完整可编辑项目位于 `prototype/`，需求文档见 `PRD.md`。

## 本地运行

```sh
cd prototype
pnpm install
pnpm dev
```

## 构建及预览

```sh
cd prototype
pnpm build
pnpm preview
```

如需使用原文话题和 AI 解读的本地接口，在构建后运行 `python3 server/preview.py --port 4173`。AI 服务需配置服务端模型凭据，或通过 `--codex-cli` 指定已登录的本机 Codex CLI。

GitHub Pages 展示静态原型。第三方数据、监测预警、真实用户目录及模型服务需要另行接入。浏览器中保存的订阅和任务记录不随代码发布共享。
