# PJ1 Phase 1：SVG 编辑器

## 1. 架构方案

### 1.1 架构目标

项目采用分层架构：

- **Command** 是所有编辑行为的唯一入口，CLI 不直接修改文档。
- 编辑命令使用 **PreparedEdit 反向操作**实现 undo/redo，不使用整文档快照。
- **ContainerShape + Composite** 统一表示图形树。
- Document 是已挂载树、id 索引和 shapeCount 的唯一所有者。
- SVG、文件系统和 CLI 通过 Port/Adapter 与核心逻辑隔离。
- 内置命令和图形也通过 Provider 注册。
- tree/show 返回结构化 Snapshot，CLI 只负责排版。

### 1.2 模块划分

```text
src/
  domain/
    model/          # Document、CanvasSize、ShapePlacement
    shapes/         # Shape、ContainerShape、Group、叶子图形、
                    # Point、Size、ShapeId、ShapeStyle 等值对象
  application/
    EditorSession.ts
    commands/       # Command、PreparedEdit、具体命令和 ShapeFeedback
    history/        # CommandProcessor、CommandInvoker
    extensions/     # CommandProvider、CommandRegistry
    queries/        # Tree/ShapeDetails Snapshot 和 Builder
    shapes/         # ShapeInit、ShapeProvider、ShapeFactory、providers
    ports/          # SvgCodec、FileStore、Renderer Ports
  infrastructure/
    svg/            # XmlSvgCodec、Parser、Serializer、IdAllocator、Transform
    fs/             # NodeFileStore
  interfaces/
    cli/            # REPL、Parser、Presenter 和具体 Renderer
  shared/errors/    # UserFacingError、UserInputError、CommandRejectedError
  bootstrap/        # CompositionRoot
  main.ts
tests/
  application/ commands/ domain/ infrastructure/
  interfaces/ shapes/ e2e/ support/
```

| 模块 | 职责 | 不承担 |
|---|---|---|
| `domain/model` | Document、画布尺寸、id 索引、父子关系、挂载状态 | CLI、XML、文件 IO |
| `domain/shapes` | Composite、图形操作、值对象和领域不变量 | 历史栈、命令分发 |
| `application/commands` | 准备、应用和反向执行操作 | 打印文本、直接访问 Node.js fs |
| `application/history` | 命令分类执行、历史栈和门禁 | 具体图形几何规则 |
| `application/queries` | 构建结构化 tree/show 结果 | CLI 排版 |
| `application/shapes` | Provider 注册、统一创建和公共样式应用 | 具体图形几何实现 |
| `application/ports` | SVG、文件和展示输出抽象 | 具体外部实现 |
| `infrastructure` | XML/SVG、文件系统、原子写入 | 修改命令历史 |
| `interfaces/cli` | REPL、参数解析、Snapshot 排版 | 保存领域状态 |
| `shared/errors` | 用户错误与内部异常分类 | 业务规则 |
| `bootstrap` | 注册实现并组装依赖 | 业务决策 |

### 1.3 包图

```plantuml
@startuml
skinparam packageStyle rectangle
left to right direction

package "interfaces/cli" {
  [CliApplication]
  [CommandParser]
  [CliPresenter]
  [CLI Renderers]
}

package "application" {
  [CommandRegistry]
  [CommandProcessor]
  [CommandInvoker]
  [ExecutableCommand]
  [PreparedEdit]
  [EditorSession]
  [Query Builders]
  [SvgCodec] <<port>>
  [FileStore] <<port>>
  [Renderer Ports] <<port>>
}

package "domain" {
  [Document]
  [Shape]
  [ContainerShape]
  [Group]
  [Leaf Shapes]
  [Value Objects]
}

package "infrastructure" {
  [XmlSvgCodec]
  [Svg Parser/Serializer]
  [NodeFileStore]
}

package "bootstrap" {
  [CompositionRoot]
}

[CliApplication] --> [CommandParser]
[CliApplication] --> [CommandRegistry]
[CliApplication] --> [CommandProcessor]
[CliApplication] --> [CliPresenter]

[CommandRegistry] --> [ExecutableCommand]
[CommandProcessor] --> [CommandInvoker]
[CommandProcessor] --> [ExecutableCommand]
[CommandInvoker] --> [PreparedEdit]
[ExecutableCommand] --> [EditorSession]
[EditorSession] --> [Document]
[Query Builders] --> [Document]

[Document] *-- [Shape]
[Group] --|> [ContainerShape]
[ContainerShape] --|> [Shape]
[ContainerShape] o-- [Shape]
[Leaf Shapes] --|> [Shape]
[Shape] --> [Value Objects]

[SvgCodec] <|.. [XmlSvgCodec]
[FileStore] <|.. [NodeFileStore]
[XmlSvgCodec] --> [Svg Parser/Serializer]

[CliPresenter] --> [Renderer Ports]
[CLI Renderers] ..|> [Renderer Ports]

[CompositionRoot] --> [CliApplication]
[CompositionRoot] --> [XmlSvgCodec]
[CompositionRoot] --> [NodeFileStore]
@enduml
```

CompositionRoot 是唯一同时认识所有具体实现的组装位置。

### 1.4 设计模式与落地

#### Command + 反向命令

```typescript
interface UndoableCommand<TContext> {
  readonly kind: "edit";
  prepare(context: TContext): PreparedEdit<TContext>;
}

interface PreparedEdit<TContext> {
  apply(context: TContext): CommandResult;
  revert(context: TContext): CommandResult;
}
```

执行流程：

```text
CLI -> CommandParser -> CommandRegistry -> CommandProcessor
    -> 编辑命令：CommandInvoker -> prepare -> PreparedEdit.apply
    -> 文档/查询/控制命令：直接执行
    -> CommandResult/CommandView -> CliPresenter
```

CommandInvoker 只保存 PreparedEdit：

```text
execute：prepare -> apply -> 入 undo 栈并清空 redo
undo：revert 成功 -> 移入 redo 栈
redo：apply 成功 -> 移回 undo 栈
```

反向信息均为局部状态：

| 操作 | 反向信息 |
|---|---|
| create | 新图形、父容器、插入索引 |
| delete | 被删除子树、原父容器、索引 |
| move/scale | 受影响图形的 GeometryState |
| set | 修改前属性值 |
| group/ungroup | 原父节点、索引、成员顺序、原容器 |
| addto | 原父节点、原索引、目标容器 |
| front/back | 原同级索引 |

所有编辑命令遵循 `prepare -> apply`：易失败条件在 prepare 阶段检查，apply 只提交已准备好的修改。经验证，操作失败不会写入历史或改变文档。

#### Composite 与 Document 所有权

```text
Shape
├── LeafShape：Rect、Circle、Ellipse、Line、Text
└── ContainerShape
    └── Group
```

ContainerShape 统一提供 children、`walkTree`、递归 move/scale、循环检测和局部几何恢复。已挂载容器的 add/insert/remove 会被拒绝，所有结构修改必须经过 Document，以同步父子关系、id 索引、shapeCount 和 attached 状态。

#### Provider / Factory

- `ShapeProvider.createFromCliArgs` 将 CLI 参数转换为中立的 ShapeInit。
- `ShapeProvider.create(ShapeInit)` 同时服务 CLI 创建和 SVG 读取。
- ShapeFactory 集中完成类型分派、Provider 调用和公共样式应用。
- CommandProvider 提供命令名称、usage、解析和命令创建。
- 内置命令和图形在 CompositionRoot 中使用同一注册路径。

按名字分派只有两处，均标记为待重构：

| 位置 | 内容 | 后续方向 |
|---|---|---|
| CommandRegistry | 命令名 → CommandProvider | 插件元数据驱动注册 |
| ShapeFactory | 图形类型名 → ShapeProvider | 完整插件注册表 |

#### Port / Adapter 与 Snapshot

- SvgCodec 隔离 XML/SVG，XmlSvgCodec 内部拆为 Parser、Serializer、IdAllocator。
- FileStore 隔离文件系统；NodeFileStore 使用临时文件加 rename 原子保存。
- tree/show 返回 TreeSnapshot/ShapeDetailsSnapshot；Command 不依赖 CLI Renderer。
- GUI 或智能体可直接复用 Snapshot，CLI Presenter 可替换。

#### 值对象和错误分类

CanvasSize、Point、Size、ShapeId、ShapeStyle、GeometryState 保证正数、有限坐标、非空 id 和可精确恢复的局部状态。move/scale 先计算完整目标状态，再一次性提交。

UserInputError 和 CommandRejectedError 属于用户可处理错误；CLI 只格式化这些错误，TypeError 等内部故障会保留为程序缺陷。

### 1.5 依赖方向

| 来源 | 可以依赖 | 理由 |
|---|---|---|
| interfaces/cli | application、shared | CLI 是应用用例的输入输出适配器 |
| application | domain、自身 ports、shared | 编排领域逻辑，不持有外部实现 |
| domain | 仅领域内部与 shared 无外设类型 | 核心规则独立、可测试 |
| infrastructure | application ports、domain | 实现 SVG/文件系统适配器 |
| bootstrap | 所有模块 | 唯一依赖组装位置 |

禁止：

- domain 导入 CLI、Infrastructure、Node.js fs 或 XML 库。
- Command 直接打印或访问具体文件/SVG 实现。
- CLI 绕过 CommandProcessor 修改 Document。
- 已挂载 ContainerShape 绕过 Document 修改结构。
- 多处重复命令名或图形类型分派。

### 1.6 变化点与阶段边界

| 变化点 | 预留方式 | 当前决定 |
|---|---|---|
| 新增图形或 box 插件 | ShapeProvider、ShapeFactory、ContainerShape、Descriptor | 不实现插件加载器；接口已备 |
| 新增命令或输入入口 | CommandProvider、CommandProcessor、CommandView | 不引入事件总线 |
| GUI/智能体 | 命令结果与 Snapshot 不绑定文本 | CLI Presenter 可替换 |
| SVG transform/属性扩展 | Codec、Parser、Serializer、ShapeInit | 支持 translate 和等比 scale |
| 大文档历史增长 | 命令只保存局部状态 | 先测量再优化 |
| 历史持久化 | 历史层只依赖 PreparedEdit | Phase 1 不持久化 |

Phase 1 边界：

- `box` 不实现，`create box` 返回未注册类型错误。
- transform 在读取时归一化为图形坐标，保存输出规范 SVG。
- rotate、matrix、非等比 scale 明确拒绝。
- 不承诺任意外部 SVG 的未知元素和属性完整 round-trip。

## 2. 过程记录

1. 最初考虑整文档 Memento，最终按高扩展性要求改为 PreparedEdit 反向命令。
2. 发现 CreateShapeCommand 存在隐藏可变准备状态，重构为显式 `prepare -> PreparedEdit`。
3. E2E 测试发现 `addto` 后图形脱离 Document id 索引，修复为 `detach -> Document.insertShapeAt`。
4. 为从结构上避免同类问题，引入 attached 状态和 Document 唯一结构修改入口。
5. 删除中心 ShapeVisitor，改用 ShapeDescriptor、ContainerShape.walkTree 和多态 SVG 属性。
6. 将 XmlSvgCodec 拆分为 Parser、Serializer、IdAllocator，并将测试从重复编译优化为预构建一次。
7. 将 tree/show 从文本改为 Snapshot，查询和排版分离。
8. 根据文档 transcript 修正 create-in、move、tree text、show 和恢复反馈格式。
9. 加强值对象与不变量，修复 canvas 查询清空历史、未初始化 undo/redo、非原子保存、插件容器 ungroup 和 Text transform 属性问题。

## 3. 一致性自查

### 3.1 模块划分

- 实际目录与本文档一致。
- 修订记录覆盖值对象位置、XmlSvgCodec 拆分、queries 和 errors 模块。
- 查询、Renderer 和领域模型职责已分离。
- 已挂载容器结构修改统一经过 Document。

### 3.2 依赖与分派

- domain 未导入 CLI、Infrastructure、Node.js fs 或 XML 库。
- CLI 只通过 CommandRegistry/CommandProcessor 执行命令。
- 命令名分派只集中于 CommandRegistry。
- 图形类型分派只集中于 ShapeFactory。
- SVG Parser 通过 ShapeFactory 创建图形。
- Command 不依赖 CLI Renderer。

### 3.3 行为

- 支持的编辑操作均使用 PreparedEdit。
- Group 与叶子图形统一支持标准操作。
- 结构命令恢复原父节点、成员顺序和 z-order。
- 失败的结构修改不改变文档或历史。
- 文档命令清空历史并门禁 undo/redo。
- 普通 tree/show/help/canvas 查询不属于文档修改。
- redo 后新编辑清空 redo 栈。
- 插件复合容器可通过 canUngroup=false 禁止 ungroup。

## 4. 质量保证

截至本文档更新：

```text
npm test
Test Files  23 passed
Tests       87 passed

npm run typecheck
通过

npm run build
通过
```

测试分层：

- 领域值对象、Composite、容器挂载不变量测试。
- CommandInvoker 异常安全、undo/redo 和 redo 清空测试。
- 所有编辑命令的 prepare/apply/revert 和结构恢复测试。
- CLI 参数解析、quoted text、help 和结构化查询测试。
- SVG Parser/Serializer、IdAllocator、transform、原子文件写入测试。
- save/read round-trip、缺 id warning 测试。
- 文档完整 transcript、标准错误矩阵和单场景全功能验收测试。

关键验收能力：

- 六种 Phase 1 图形与 Group 的创建和递归编辑。
- create-in、group、ungroup、addto、front/back。
- move/scale/set/delete 的精确 undo/redo。
- canvas、save、read 和 IO 历史门禁。
- 嵌套 SVG 保存、读取和结构保持。
- translate、等比 scale、Text font-size/text-anchor round-trip。
- 缺 id 自动补全、quoted text 和含空格参数。
- 用户错误与内部异常分类。

# Phase 2 第一部分：VSCode 插件实践

## 1. 功能与验收证据

扩展源码位于 `vscode-extension/`，提供两个功能：

1. 在 Explorer 中为普通 `.svg` 文件显示 `[]` 标记。
2. 在 VSCode 原生 Outline 中显示 SVG 元素的嵌套结构，并支持点击定位源码。

扩展不会修改文件名或文件内容。示例文件位于：

- `vscode-extension/examples/example.svg`
- `vscode-extension/examples/uppercase.SVG`
- `vscode-extension/examples/notes.txt`
- `vscode-extension/examples/folder.svg/`

### 1.1 文件标记截图

![alt text](<屏幕截图 2026-11-24 203653.png>)

预期结果：

- `example.svg` 和 `uppercase.SVG` 右侧显示 `[]`。
- `notes.txt` 不显示标记。
- `folder.svg` 是目录，不显示标记。
- 文件名和文件内容保持不变。

### 1.2 SVG 大纲与源码定位截图

![alt text](image.png)

预期结果：

- Outline 展示根元素、容器和叶子元素。
- 有 id 的元素显示为 `标签名#id`。
- 没有 id 的元素只显示标签名。
- 点击 `rect#start` 后定位到对应源码。
- 编辑合法 SVG 后，Outline 更新。

### 1.3 异常 XML 截图

![alt text](image-1.png)

不完整 XML 的允许行为是暂时清空 Outline。修复 XML 后，Outline 恢复。

### 1.4 自动化验证

`vscode-extension/test/` 中的 Vitest 测试覆盖：

- SVG 文件识别和装饰资格。
- 非 SVG 文件、目录和非文件 scheme 不产生装饰。
- 合法 SVG 的层级、顺序、id、自闭合标签和源码范围。
- 不完整 XML 返回空结果。
- 编辑后新增、修改、删除节点。
- Outline 节点到 `DocumentSymbol` 的递归映射。
- Provider 的激活和销毁生命周期。

`vscode-extension/integration-test/` 使用 `@vscode/test-electron` 启动真实 Extension Host，验证：

- 扩展能在真实 VSCode 中激活。
- VSCode 确实调用了注册的 SVG `DocumentSymbolProvider`。
- 大纲层级和源码范围正确。
- 编辑文档后 Symbol 树刷新。
- 不完整 XML 返回空大纲。
- 修复 XML 后大纲恢复。

运行命令：

```powershell
cd vscode-extension
npm test
npm run test:integration
```

## 2. 分析

### 2.1 VSCode 与扩展的职责

VSCode 是扩展宿主、文档模型和界面渲染者。扩展只提供附加信息以及从文档生成 Symbol 的能力。

| 职责 | VSCode | SVG 扩展 |
|---|---|---|
| 启动与生命周期 | 调用 `activate(context)`，保存扩展上下文 | 创建并注册 provider |
| 文件模型 | 管理 `Uri`、`TextDocument` 和文件系统 | 判断 URI 是否为 SVG，查询文件类型 |
| Explorer | 决定 Explorer 布局并绘制文件装饰 | 为合格 SVG 返回 `FileDecoration` 元数据 |
| Outline | 决定 Outline 的展示、选择、定位和刷新 | 返回嵌套的 `DocumentSymbol[]` |
| 编辑事件 | 在文档变化后重新请求 Symbol Provider | 每次调用读取最新 `document.getText()` |
| 销毁 | 释放 `context.subscriptions` | Provider 本身不持有需要手动清理的外部资源 |

扩展不能直接改变 Explorer 的绘制方式，也不能强制 Outline 刷新。扩展只实现 VSCode 公开的 Provider 接口，由 VSCode 根据当前工作区、文件类型和文档状态决定何时调用这些接口。

### 2.2 注册、回调和调用关系

当前实现在 `vscode-extension/src/extension.ts` 中完成组合根职责：

1. `activate(context)` 创建 `VscodeSvgEntryInspector`。
2. 创建 `SvgFileDecorationProvider`，并注入文件类型查询能力。
3. 创建 `SvgOutlineDocumentSymbolProvider`。
4. 调用 `window.registerFileDecorationProvider` 注册文件装饰。
5. 调用 `languages.registerDocumentSymbolProvider`，以 `{ scheme: "file", pattern: "**/*.svg" }` 注册大纲。
6. 把两个注册返回的 `Disposable` 放入 `context.subscriptions`。

Provider 每次激活都重新创建，不使用模块级共享实例。这样避免了多次激活之间的状态泄漏，也把资源生命周期绑定到当前 `ExtensionContext`。

文件装饰的调用关系如下：

```text
VSCode Explorer
  -> FileDecorationProvider.provideFileDecoration(uri)
  -> isSvgUri(uri)
  -> VscodeSvgEntryInspector.inspect(uri)
  -> workspace.fs.stat(uri)
  -> FileType -> SvgEntryKind
  -> { badge: "[]" } 或 undefined
  -> VSCode 绘制 Explorer 标记
```

非 SVG URI 在调用 `workspace.fs.stat` 前直接返回 `undefined`。SVG URI 只有在文件类型为普通文件时才返回 `{ badge: "[]" }`，所以目录不会获得标记。

Outline 的调用关系如下：

```text
VSCode 打开 .svg 文本文件
  -> DocumentSymbolProvider.provideDocumentSymbols(document)
  -> document.getText()
  -> SvgOutlineParser.parse(...)
  -> SvgOutlineSymbolMapper.map(document, root)
  -> DocumentSymbol[]
  -> VSCode 渲染原生 Outline
```

解析器返回轻量 `SvgOutlineNode`，不依赖 Phase 1 的 `Document`、`Shape` 或 `ShapeFactory`。`SvgOutlineSymbolMapper` 再把轻量节点转换为 VSCode 的 `DocumentSymbol` 和 `Range`。

如果 XML 暂时不完整，解析器返回 `null`，Provider 返回空数组。如果解析过程中出现意外异常，Provider 会捕获异常并返回空大纲，避免扩展宿主崩溃。

### 2.3 接口与对象组合

扩展使用三个内部边界：

```typescript
type InspectSvgEntry = (uri: Uri) => Promise<SvgEntryKind>;

type SvgOutlineParser = (
  source: string
) => SvgOutlineNode | null;

interface SvgOutlineSymbolMapping {
  map(document: TextDocument, root: SvgOutlineNode): DocumentSymbol[];
}
```

对象组合关系如下：

```text
activate
├── VscodeSvgEntryInspector
│   └── workspace.fs.stat
├── SvgFileDecorationProvider
│   └── InspectSvgEntry
└── SvgOutlineDocumentSymbolProvider
    ├── SvgOutlineParser
    └── SvgOutlineSymbolMapping
        └── DocumentSymbol
```

`SvgFileDecorationProvider` 和 `SvgOutlineDocumentSymbolProvider` 都通过构造函数获得可变依赖，因此可以在单元测试中注入测试替身。`extension.ts` 只负责实例化和注册，不实现文件系统判断、解析或 Symbol 映射逻辑。

涉及的主要 VSCode 接口是：

- `FileDecorationProvider`
- `DocumentSymbolProvider`
- `TextDocument`
- `DocumentSymbol`
- `Range`

内部代码没有继承 VSCode UI 类，而是实现接口并组合依赖，避免扩展逻辑和界面实现形成继承耦合。

### 2.4 文件装饰与经典 Decorator 的关系

经典 GoF Decorator 的典型结构是：

```text
Client -> Decorator -> Concrete Component
```

Decorator 通常持有被装饰对象，在把调用委托给原对象前后增加行为。被装饰对象和 Decorator 实现共同的接口，客户端仍然操作同一个组件抽象。

VSCode 的 `FileDecorationProvider` 与本项目中的 SVG 文件装饰有如下相似点：

- 都向原有对象增加显示信息。
- 都不修改原始文件内容。
- 都通过组合方式扩展行为。
- 都不需要修改 Explorer 或 VSCode 文件系统的内部实现。

但两者有本质差异：

| 比较项 | 经典 Decorator | VSCode 文件装饰 Provider |
|---|---|---|
| 是否包装目标对象 | 是，通常持有 Component 引用 | 否，只接收目标 `Uri` |
| 是否委托原对象行为 | 是 | 否 |
| 是否实现目标和装饰器的共同接口 | 是 | Provider 实现 VSCode 扩展接口 |
| 状态和调用权 | 由装饰器和客户端控制 | 由 VSCode 决定何时调用 |
| 输出 | 包装后的对象 | `FileDecoration` 展示元数据 |
| 是否改变文件模型 | 可改变对象行为 | 不改变文件模型 |

因此，本项目中的“文件装饰”不是严格的 GoF Decorator。它更接近 Decorator-style Provider/Strategy：VSCode 定义稳定的 Provider 接口，扩展在接口背后提供附加展示策略，最终绘制由 VSCode 完成。

### 2.5 与 Adapter 模式的关系

本项目包含两个明确的适配边界：

1. `VscodeSvgEntryInspector` 把 VSCode 的 `workspace.fs.stat` 和数值型 `FileType` 适配为领域侧的 `SvgEntryKind`。
2. `SvgOutlineDocumentSymbolProvider` 和 `SvgOutlineSymbolMapper` 把内部轻量 Outline 模型适配为 VSCode 的 `DocumentSymbol`、`Position` 和 `Range`。

它们的角色对应关系是：

| Adapter 角色 | 文件系统适配 | Outline 适配 |
|---|---|---|
| Target | `SvgEntryKind` 查询 | `DocumentSymbolProvider` |
| Client | `SvgFileDecorationProvider` | VSCode Outline |
| Adapter | `VscodeSvgEntryInspector` | Outline Provider/Mapper |
| Adaptee | `workspace.fs.stat` | VSCode `DocumentSymbol` API |

`FileDecorationProvider` 接口本身同时具有 Provider 和 Adapter 特征：扩展通过它接入 VSCode 的 Explorer 展示机制，但最终展示责任仍在 VSCode。

### 2.6 Phase 1 复用可能性评估

Phase 1 和 VSCode 扩展共享 TypeScript、SVG 文本输入和树形结构概念，但目标不同。
Phase 1 解析器服务于完整编辑器和几何模型；扩展只需要源码范围、标签名和 id。

| Phase 1 代码 | 是否直接复用 | 原因与替代方案 |
|---|---|---|
| `SvgDocumentParser` | 否 | 要求完整合法 SVG，依赖 `ShapeFactory`，并将元素转换为图形对象；不能保留 VSCode 所需源码 offset |
| `SvgIdAllocator` | 否 | 它会为无 id 元素自动分配 id；Outline 需要区分“有无显式 id” |
| `Document` | 否 | 负责挂载树、id 索引和结构不变量，超出 Outline 需要 |
| `Shape` 和各具体图形 | 否 | 包含几何和 SVG 语义；Outline 节点只需要标签、id、children 和 range |
| `ContainerShape.walkTree` | 思路可复用 | 使用相同的前序/递归遍历思想，但扩展使用独立只读轻量节点 |
| `ShapeDescriptor` | 思路可借鉴 | `标签名 + id` 的展示思想相近，但扩展不依赖 Phase 1 领域模型 |
| `fast-xml-parser` 配置 | 否 | 当前配置不提供 VSCode 所需的稳定源码范围，且完整 XML 解析不适合编辑中的半成品 |
| 错误分类与测试思路 | 可借鉴 | 可借鉴“非法输入不破坏状态”的测试原则，但不直接复用 CLI 错误类 |

当前扩展没有导入 Phase 1 的 `src/domain`、`ShapeFactory` 或 `Document`，因此 VSCode 部分可以独立构建和测试。扩展使用独立的 `svgOutlineParser.ts`，在遍历时记录开始标签、结束标签和标签名 offset，能够直接映射到 VSCode 的 `Range`。

未来如果两个部分都需要更复杂的 XML 处理，可以把“带源码位置的纯 XML tokenizer”抽成共享模块，但不应直接共享 CLI 领域模型。这样既能复用语法扫描能力，又能保持 CLI 编辑语义与 VSCode 展示语义的边界。

# Phase 2 第二部分：CLI 插件式重构

## 1. 重构目标与结果

Phase 2 在保持 Phase 1 命令、输出和编辑行为不变的前提下，把四类变化点从内核中拆出图形类型、命令、结构树标签和图形属性语义。接口与注册表留在内核，`PluginHost` 负责统一激活和校验，`PluginLoader` 负责配置式加载；具体插件只依赖公开入口 `svg-editor-pj1/plugin-api`。

```plantuml
@startuml
title Phase 1 → Phase 2 模块依赖
skinparam packageStyle rectangle
left to right direction

package "Phase 1：重构前" {
  [CompositionRoot] as P1Root
  [Built-in Commands] as P1Commands
  [ShapeFactory] as P1Factory
  [Built-in Shape Providers] as P1Shapes
}

package "Phase 2：重构后" {
  [CompositionRoot] as P2Root
  [PluginLoader]
  [PluginHost]
  [CommandRegistry]
  [ShapeFactory] as P2Factory
  [TreeDecoratorRegistry]
  [AttributeHandlerRegistry]
  [Plugin API]
  [CLI Kernel]
}

package "插件" {
  [builtin-shapes]
  [command-stats]
  [command-dir]
  [shape-box]
  [tree-box-label]
  [tree-star]
}

[P1Root] --> [P1Commands]
[P1Root] --> [P1Factory]
[P1Factory] --> [P1Shapes]

[P2Root] --> [PluginHost]
[P2Root] --> [PluginLoader]
[P2Root] --> [CLI Kernel]
[PluginHost] --> [CommandRegistry]
[PluginHost] --> [P2Factory]
[PluginHost] --> [TreeDecoratorRegistry]
[PluginHost] --> [AttributeHandlerRegistry]
[PluginLoader] --> [PluginHost]
[PluginHost] ..> [Plugin API] : validates/activating
[Plugin API] <.. [插件]
@enduml
```

重构前由组合根直接认识所有内置实现；重构后由插件宿主按稳定接口注册。插件可以依赖公开 API，内核不依赖具体插件包或配置加载器。依赖规则由 `tests/architecture/dependency-rules.test.ts` 自动检查。

## 2. 四个扩展点

| 扩展点 | 内核接口 | 内核调用位置 | 本阶段实现 | 未安装时的行为 | 错误契约 |
|---|---|---|---|---|---|
| 图形 | `ShapeProvider` | `ShapeFactory`、两阶段 SVG 读回 | `builtin-shapes`、`shape-box` | 只能创建已注册图形；未安装 box 时读入降级为普通 `g` | 参数不合法、类型未注册、SVG 匹配失败或读回结构不完整时拒绝该操作 |
| 命令 | `CommandProvider<TContext>` | `CommandRegistry`、`CommandProcessor` | `command-stats`、`command-dir` | 未注册命令返回 `unknown command` | 创建/校验失败按命令错误处理，不进入历史 |
| 树标签 | `TreeDecorator` | `TreeSnapshotBuilder` → `TreeDecoratorRegistry` | `tree-box-label`、`tree-star` | 输出 Phase 1 原始树文本 | 同名标签拒绝；装饰异常作为查询失败报告 |
| 属性 | `AttributeHandler` | `SetAttributeCommand`、`AttributeHandlerRegistry`、`AttributeHandlerEdit` | `box-attributes` | 回退到 Phase 1 标准属性白名单 | 多处理器同时命中时拒绝，未定义属性报错 |

四类插件通过清单中的 `shapes`、`commands`、`decorators`、`attributes` 声明贡献名。注册名在内核中稳定，清单声明和实际注册集合必须完全一致。

`ShapeProvider` 同时服务 CLI 创建和两阶段 SVG 读回，内置六种图形及 box 均由插件注册。`CommandProvider` 提供命令名、usage 和参数解析；`TreeDecorator` 只接收只读节点和文档变化状态并按 `priority` 稳定排序；`AttributeHandler` 返回可逆 `AttributeChange`，由 `AttributeHandlerEdit` 映射为一个 undo 单元。同一图形属性被多个处理器命中时直接拒绝，避免隐式覆盖。

`PluginHost.activate` 先让插件向私有暂存上下文注册，再校验清单、检测重名，全部通过后一次性提交。失败插件不会留下部分注册；诊断由 `CliPluginDiagnosticFormatter` 统一格式化。

## 3. 两种装配方式

### 3.1 方式 A：代码装配

组合根接受显式 `CodePluginActivation[]`：

```typescript
await createCliApplication(input, output, {
  codePlugins: [
    { plugin: statsPlugin, manifest: statsPluginManifest },
    { plugin: boxPlugin, manifest: boxPluginManifest }
  ]
});
```

该方式具有完整类型检查；完整验收入口为 `scripts/run-code-assembly.mjs`，与配置方式共用同一个 `createCliApplication` 和 `PluginHost.activate`。

### 3.2 方式 B：配置装配

CLI 入口：

```powershell
npm run cli -- --config plugins.config.json
```

当前配置：

```json
{
  "plugins": [
    { "module": "./src/plugins/command-stats" },
    { "module": "./src/plugins/command-dir" },
    { "module": "./src/plugins/shape-box" },
    { "module": "./src/plugins/tree-box-label" },
    { "module": "./src/plugins/tree-star" }
  ]
}
```

配置按数组顺序加载，`module` 可为包名、绝对路径或相对配置文件目录的路径； `enabled: false` 完全跳过解析，`options` 原样传给 `activate`。插件包的 `package.json` 提供 `main` 和 `contributes`。无 `--config` 时只加载默认内置能力；配置非法时输出 `error: invalid plugin config` 并继续启动。

失败诊断继续启动主程序，格式由统一 formatter 输出：

| 失败 | 输出 |
|---|---|
| 模块找不到 | `error: plugin not found: <module>` |
| 没有默认导出 | `error: plugin has no default export: <module>` |
| 清单与实际注册不一致 | `error: plugin manifest mismatch: <name> (...)` |
| 激活抛错 | `error: plugin failed to activate: <name> (<reason>)` |
| 注册名重复 | `error: duplicate registration: <category>/<name>` |
| 配置非法 | `error: invalid plugin config` |

`PluginLoader` 不包含具体插件包导入、名称映射表或按插件名分支；它只负责配置、模块解析、清单读取和调用宿主。

## 4. 本阶段插件与 `dir` 适配器

| 插件 | 贡献 | 行为 |
|---|---|---|
| `builtin-shapes` | 六个图形 provider | 保持 Phase 1 图形能力，并作为默认装配 |
| `command-stats` | `stats` | 深度优先统计叶子类型、总数和容器数；box 计作容器 |
| `command-dir` | `dir` | 通过目录端口列出当前目录，稳定排序并区分类型 |
| `shape-box` | `box`、`box-attributes` | 派生矩形和文字组成复合容器，支持 fill/label、嵌套和整体移动 |
| `tree-box-label` | `box-type-label` | 为 semantic type 为 box 的节点追加 `(box)` |
| `tree-star` | `modified-star` | 保存点比较、变化节点及祖先标星、根节点按 dirty 标星 |

所有插件包可独立构建和测试，并只从 `svg-editor-pj1/plugin-api` 导入。 `dir` 通过 `DirectoryReader` 端口访问目录，角色对应为：

| 角色 | 实现 |
|---|---|
| Target | `DirectoryReader` 应用端口 |
| Client | `command-dir` 的 `DirCommand` |
| Adapter | `NodeDirectoryReader` |
| Adaptee | Node.js `fs.readdirSync` 和 `Dirent` |

组合根注入 `NodeDirectoryReader`。插件测试使用固定目录替身，真实适配器测试使用临时文件系统验证目录、文件、符号链接和其他条目的分类。输出依次使用 `[DIR]`、`[FILE]`、`[LINK]`、`[OTHER]`，同组按名称升序，隐藏项保留； `dir` 查询当前工作目录且不改变文档或 undo/redo 历史。

## 5. 架构决策记录

### ADR-001：属性处理器使用单次可回滚事务

同一 `shape + attribute` 只允许一个处理器命中。处理器在 `prepare` 阶段读取旧值并返回可逆 `AttributeChange`，由 `AttributeHandlerEdit` 包装为一个`PreparedEdit`。因此 box 修改内部矩形或文字仍是一个 undo 单元。`apply` 失败时调用 `rollback()`；双重失败会报告两段错误，且不新增历史。多处理器冲突直接拒绝，避免覆盖和隐藏顺序。

### ADR-002：box 使用显式标记和两阶段读回

box 序列化为带 `data-kind="box"` 的 `g`，其必要子部件 id 为`<id>-rect` 和 `<id>-label`。SVG Parser 先递归构建 children，再把完整`SvgShapeReadRequest` 交给优先级最高的 `ShapeProvider`。这避免插件重复实现XML 遍历，同时让复合图形验证自身结构。

- 未安装 box 插件时，`data-kind` 的 `g` 按普通 Group 读入。
- 已安装 box 插件但必要子部件缺失、id 不符或类型错误时拒绝整个读入。
- 读入失败保留当前文档，不生成不完整 Box。
- 必要子部件不能通过普通删除或移走命令移除；box 拒绝 ungroup。
- 全局重复 id 始终拒绝，不能通过降级消除。

### ADR-003：dirty 按保存点内容比较，并传播到祖先

保存或读入文档时捕获尺寸、图形父节点、索引、类型和属性的快照。树查询时比较当前文档和保存快照：新增、删除、移动、层级或属性变化都使文档 dirty；新建节点立即标星并向祖先传播；根 SVG 在 dirty 时显示 `*`；undo 回到保存点后`*` 消失。标签按优先级排序，因此当前固定为 `(box)`、`*`。这比“发生过编辑命令”更符合保存点语义。

### ADR-004：先暂存注册，清单校验和去重通过后再提交

插件激活只写入插件私有暂存上下文。宿主比较归一化后的清单贡献和实际注册，检查跨插件及插件内部的重复名称，全部通过后一次性提交。失败插件不会污染已成功插件，清单错误、启动异常和重复注册共用结构化诊断。当前不支持运行时热卸载。

## 6. 双装配与改动边界验收

### 6.1 输出一致性

`npm run verify:assembly` 使用相同插件集合、顺序、options、初始文档和工作目录分别运行代码装配与配置装配，并比较完整进程 stdout。覆盖：

- Phase 1 基础编辑与 tree；
- box 创建、属性、移动和 undo；
- `stats` 与固定目录上的 `dir`。

固定输入和预期输出位于 `doc/transcript/`。三组输出均逐字节相同。

禁用全部可选插件后，`tests/fixtures/configs/phase1-compatible.json` 的输出仍与 Phase 1 `final` 基线 SHA-256 完全一致。具体命令和结果见[`transcript/README.md`](transcript/README.md)。

### 6.2 A/B 改动边界

- 代码装配证据提交：`d1759f3`（`evidence/code-assembly` 分支）。
- 配置装配证据提交：`b3bd494`。
- 两侧 `shape-box` 目录树哈希均为 `1ebe3adcd0fc23b6eaf8ed18cd4c8c6e9652049a`。
- 两种方式下，内核、加载器和既有插件差异均为空。
- 加载器源码中没有具体插件包名称或插件名称分支。

完整命令和输出范围见[`acceptance/change-boundaries.md`](acceptance/change-boundaries.md)。

## 7. 指标

指标由 `scripts/generate-metrics.mjs` 从 Git 对象生成，不读取工作区未提交修改，也不接受手填数字。

```powershell
npm run metrics -- --base=final --target=HEAD --target-label=p2
```

统计范围：

- **内核**：`src/` 下除插件和装配处之外的 CLI 源码；
- **装配处**：`src/bootstrap`、`src/host`、`src/main.ts`；
- **插件**：`src/plugins`；
- VSCode 扩展单独统计，不进入 CLI 增量；
- 测试、文档、依赖和构建产物不计入。

行数是 Git 跟踪 TypeScript 源文件的非空物理行。圈复杂度按文件统计：文件基数为 1，再计入 `if`、循环、`catch`、`case`、三元表达式、`&&`、`||` 和 `??`；分析前忽略注释和字符串字面量。

| 分类 | 基线行数 | 目标行数 | 行数增量 | 基线圈复杂度 | 目标圈复杂度 | 复杂度增量 |
|---|---:|---:|---:|---:|---:|---:|
| 内核 | 3923 | 4359 | +436 | 552 | 582 | +30 |
| 装配处 | 90 | 689 | +599 | 2 | 94 | +92 |
| 插件 | 0 | 1020 | +1020 | 0 | 96 | +96 |
| CLI 合计 | 4013 | 6068 | +2055 | 554 | 772 | +218 |

VSCode 扩展单独统计为 6 个文件、492 行、圈复杂度 87。

完整文件职责和逐文件数据见：

- [`docs/metrics/summary.md`](../docs/metrics/summary.md)
- [`docs/metrics/files.csv`](../docs/metrics/files.csv)
- [`docs/metrics/metrics.json`](../docs/metrics/metrics.json)

## 8. 可扩展性评价

### 8.1 已满足的性质

- **OCP**：新增 stats、dir、box 和两个标签时，不需要修改树渲染器或四个注册表 的分派逻辑。
- **DIP**：属性命令依赖 `AttributeHandlerResolver`，目录命令依赖 `DirectoryReader`，树查询依赖 `TreeDecorationResolver`。
- **SRP**：加载、暂存校验、基础命令、图形创建、查询构建和 CLI 排版分离。
- **组合优于继承**：插件通过对象注册和依赖注入扩展行为，只有领域图形使用 Composite 继承结构。
- **适配器**：文件系统、SVG、CLI、VSCode 和目录 API 都在边界处适配。
- **失败隔离**：配置插件失败不会撤销已成功插件，也不会退出主程序。

### 8.2 当前限制

- 插件与内核运行在同一个 Node.js 进程中，没有沙箱、权限列表或版本协商。
- 配置只在启动时读取，不支持热插拔或热卸载。
- 属性处理器冲突采用拒绝策略，不支持多个处理器组合修改同一属性。
- SVG 读回只覆盖项目支持的图形和属性，不承诺任意 SVG 完整 round-trip。
- 代码装配会在构建期形成静态依赖；配置装配适合部署后选择插件。

这些限制都在稳定接口之外，仍可在不修改命令、图形和标签分派代码的情况下扩展。

## 9. 质量保证与复现

当前完整验证：

```text
npm test
Test Files  50 passed
Tests       200 passed

npm run typecheck
通过

npm run build
通过

npm run verify:assembly
dual assembly: all checks passed
```

测试覆盖：

- 四个扩展点的注册、调用、缺省行为和重复注册；
- 插件宿主清单不一致、激活异常和回滚；
- 加载器模块缺失、无默认导出、清单不一致、激活失败和非法配置；
- 每个插件的独立测试；
- `dir` 的端口替身和真实 Node 文件系统适配器；
- box 的创建、嵌套、移动、属性事务、读回、降级和必要子部件保护；
- 两个树标签并存、优先级顺序、保存点 dirty 状态机和祖先传播；
- 代码装配与配置装配逐字节一致；
- Phase 1 golden transcript 和 `final` 哈希兼容；
- 指标脚本的分类、复杂度、排除路径和无效 ref 失败路径。

复现顺序：

```powershell
npm install
npm test
npm run typecheck
npm run verify:assembly
npm run metrics -- --base=final --target=HEAD --target-label=p2
```

最终 `p2` 标签应在上述验证完成后创建；已存在的 `final` 标签不得移动。

## 10. 过程记录

- 先用 Phase 1 golden transcript 固定兼容基线，再逐步引入插件宿主和四类扩展点。
- `dir` 最初可以放在命令内部直接访问 `fs`；最终改为 `DirectoryReader` 端口和 Node 适配器，使测试替身与真实适配器使用同一契约。
- box 读回最初只接受 XML 节点；改为先构建 children、再由 `ShapeProvider` 校验组合，避免插件复制 XML 遍历。
- 标签状态先按编辑事件记录，审查后改为保存点快照比较，使 undo 回到保存点后 `*` 消失；祖先传播和稳定优先级由独立测试锁定。
- 双装配验收从分散的 E2E 断言整理为固定会话、预期输出和统一脚本；代码装配另建独立证据分支，确保满足文档要求的提交级差异判据。
- 指标脚本优先保持版本稳定，使用文件级词法统计而不依赖 TypeScript 的不稳定编译器 AST API；原始数字统一由 Git 对象生成。
