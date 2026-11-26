# 插件装配改动边界验收

## 方式 A：代码装配

证据提交：

```text
d1759f3 feat：演示 box 插件代码装配
branch: evidence/code-assembly
```

该提交从 `b3bd494~1` 建立，只增加 `shape-box` 插件包、一个组合根装配
文件和一个端到端测试：

```powershell
git diff --name-status d1759f3~1 d1759f3
```

输出：

```text
M  src/bootstrap/CompositionRoot.ts
A  src/plugins/shape-box/Box.ts
A  src/plugins/shape-box/BoxAttributeHandler.ts
A  src/plugins/shape-box/BoxProvider.ts
A  src/plugins/shape-box/index.ts
A  src/plugins/shape-box/package.json
A  src/plugins/shape-box/tsconfig.json
A  tests/e2e/box-code-assembly-evidence.test.ts
```

除新增插件目录外，唯一的运行代码变化是
`src/bootstrap/CompositionRoot.ts`。

## 方式 B：配置装配

证据提交：

```text
b3bd494 feat：实现 box 复合图形插件
```

已有的运行源码没有修改，只新增插件包、修改 `plugins.config.json` 并更新
测试和依赖元数据：

```powershell
git diff --name-status b3bd494~1 b3bd494
```

## 公共判据

以下命令分别检查两种方式是否会修改内核、加载器或既有插件。两条命令的输出
都必须为空：

```powershell
git diff --name-status d1759f3~1 d1759f3 -- src/application src/domain src/infrastructure src/interfaces src/shared src/host src/plugin-api src/plugins/builtin-shapes src/plugins/command-stats src/plugins/command-dir
git diff --name-status b3bd494~1 b3bd494 -- src/application src/domain src/infrastructure src/interfaces src/shared src/host src/plugin-api src/plugins/builtin-shapes src/plugins/command-stats src/plugins/command-dir
```

两种装配使用的是同一个插件内容。下列命令输出的树哈希必须相同：

```powershell
git rev-parse d1759f3:src/plugins/shape-box
git rev-parse b3bd494:src/plugins/shape-box
```

当前结果都是：

```text
1ebe3adcd0fc23b6eaf8ed18cd4c8c6e9652049a
```

加载器独立性采用测试和人工扫描共同验证。以下扫描不应找到具体插件包名或
名称分支：

```powershell
rg -n "@svgframe/plugin|shape-box|tree-box-label|tree-star|command-stats|command-dir" src/host/PluginLoader.ts
```

以上路径和提交均实际存在。代码装配证据分支的全量测试为 45 个测试文件、
173 个测试全部通过。
