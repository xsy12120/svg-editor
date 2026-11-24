# SVG Editor for Visual Studio Code

这是一个用于 SVG 文件的 VSCode 扩展实践项目。扩展提供两项功能：

- 在 Explorer 中为普通 `.svg` 文件显示 `[]` 标记。
- 在原生 Outline 中显示 SVG 元素的嵌套层级，并支持点击定位源码。

扩展不会修改 SVG 文件名或文件内容，也不实现完整的 SVG 校验或图形预览。

## 环境要求

- Visual Studio Code 1.95 或更高版本
- Node.js
- npm

## 安装依赖

在 VSCode 中打开本目录：

```text
PJ1/vscode-extension
```

然后在终端执行：

```powershell
npm install
```

## 构建扩展

```powershell
npm run build
```

构建结果位于 `dist/`。扩展入口由 `package.json` 的 `main` 字段指向：

```json
"main": "./dist/extension.js"
```

## 启动扩展开发宿主

1. 使用 VSCode 打开 `vscode-extension` 目录。
2. 确认调试配置选择为 `Run SVG Extension`。
3. 按 `F5` 启动 Extension Development Host。

调试配置已经包含构建任务，因此按 F5 时会先自动执行：

```powershell
npm run build
```

如果 VSCode 没有出现 `Run SVG Extension`，检查以下文件是否存在：

- `.vscode/launch.json`
- `.vscode/tasks.json`

## 打开示例工作区

在 Extension Development Host 中打开：

```text
PJ1/vscode-extension/examples
```

示例目录包含：

```text
examples/
├── .vscode/
│   └── settings.json
├── folder.svg/
│   └── nested.txt
├── example.svg
├── notes.txt
└── uppercase.SVG
```

示例工作区通过 `examples/.vscode/settings.json` 将 SVG 的默认编辑器设置为文本编辑器，避免 VSCode 内置 Image Preview 妨碍 Outline 验证。

## 验证文件标记

打开 `examples` 后，Explorer 应显示：

- `example.svg` 右侧显示 `[]`。
- `uppercase.SVG` 右侧显示 `[]`。
- `notes.txt` 不显示标记。
- `folder.svg` 是目录，不显示标记。

标记只是 Explorer 的附加展示信息，不会改变文件名或文件内容。

如果 Explorer 没有显示徽章：

1. 等待扩展完成启动，或执行 `Developer: Reload Window`。
2. 检查 VSCode 设置 `explorer.decorations.badges` 是否启用。
3. 确认开发宿主打开的是本地文件系统目录。

## 验证 SVG 大纲

1. 在 Explorer 中打开 `examples/example.svg`。
2. 如果文件被 Image Preview 打开，点击 `Reopen as Source Text`。
3. 展开左下角的 `Outline`。

大纲应显示：

```text
svg#root
└── g#flowchart
    ├── rect#start
    ├── text
    └── line#arrow
```

规则如下：

- 有 `id` 的元素显示为 `标签名#id`。
- 没有 `id` 的元素只显示标签名。
- 点击 `rect#start` 等节点会定位到对应源码位置。
- 编辑合法 SVG 后，大纲会重新读取文档并刷新。
- XML 暂时不完整时，大纲可以显示为空，但扩展不应崩溃。
- 修复 XML 后，大纲应恢复。

## 验证异常 XML

在 `example.svg` 中先删除根闭合标签末尾的 `>`，例如把：

```xml
</svg>
```

改成：

```xml
</svg
```

此时 Outline 应清空，扩展不显示崩溃提示。使用 `Ctrl+Z` 恢复标签后，大纲应重新出现。

## 运行单元测试

单元测试覆盖文件分类、装饰 provider、解析器、异常 XML、Outline 映射和激活生命周期。

```powershell
npm test
```

监听模式：

```powershell
npm run test:watch
```

## 运行真实 Extension Host 测试

集成测试会在真实 VSCode Extension Host 中验证：

- 扩展激活。
- SVG DocumentSymbolProvider 注册和调用。
- Outline 层级与源码范围。
- 编辑后的 Symbol 刷新。
- 不完整 XML 返回空大纲。
- 修复 XML 后大纲恢复。

使用本机已安装的 VSCode：

```powershell
$env:VSCODE_EXECUTABLE_PATH="D:\Path\To\Microsoft VS Code\Code.exe"
npm run test:integration
```

不设置 `VSCODE_EXECUTABLE_PATH` 时，`@vscode/test-electron` 会下载测试用 VSCode：

```powershell
npm run test:integration
```

一次运行单元测试和真实 Extension Host 测试：

```powershell
npm run test:all
```

## 类型检查

```powershell
npm run typecheck
npm run build:integration
```

## 项目结构

```text
src/
├── extension.ts                 # 组合根和 VSCode 注册
├── svgFileDecoration.ts         # SVG 路径规则和文件装饰 provider
├── svgOutlineParser.ts          # 带源码位置的轻量解析器
├── svgOutlineProvider.ts        # Outline provider 和异常兜底
├── svgOutlineSymbolMapper.ts    # 轻量节点到 DocumentSymbol 的映射
└── vscodeSvgEntryInspector.ts   # VSCode 文件系统类型适配器

test/                            # Vitest 单元测试
integration-test/                # 真实 Extension Host 测试
examples/                        # 人工验收样例
```

## 已知边界

- 不验证完整 SVG 规范。
- 不提供图形预览。
- XML 编辑到中间状态时允许暂时清空 Outline。
- Explorer 文件标记使用 VSCode 提供的 Provider API；扩展不直接控制 Explorer 的绘制。
