# Mindustry-C（mindc）

一个用 JavaScript 编写的、把 C 编译为 Mindustry Logic（mlog）的编译器，附带一个 mlog 模拟执行器。

这份文件是**给在本仓库里干活的 AI/人看的地图**：目录在哪、测试怎么跑、哪些地方踩过坑。
面向使用者的语言说明在 `docs/`。

## 目录

### 编译器源码（仓库根目录，无子目录）

全部是 ES module，编译器的入口是 `mindc.js` 里的 `Compiler`。**没有 `mindc/` 目录**——
旧版本有过，后来拍平了。

| 文件 | 职责 |
|---|---|
| `mindc.js` | `Compiler` 门面：tokenize → parse → 语义 → 优化 → 生成；pragma 分发也在这里 |
| `mindcLexer.js` | 词法。关键字表、`#pragma` / `#include` 的 token |
| `mindcParser.js` | 语法。AST 节点构造、`isBuiltinFunction` |
| `mindcSemantic.js` | 符号表、类型系统、`TypeInfo`、诊断。**改动风险最高** |
| `mindcOptimizer.js` | 常量折叠、循环求值、内联、无用代码删除 |
| `mindcGenerator.js` | AST → 指令。`emitVecAlias` / `emitVecCopy` / 数组下标在这里 |
| `mindcInfrastructure.js` | 指令构造、`arithmetic()`、各种 `*Ret` 表示类 |
| `mindcGeneratorBase.js` | `MemoryBlock`、`MemoryManager`、`FunctionRegisterer`、栈帧 |
| `mindcInstruction.js` | **叶子模块**：指令类。只依赖 `mindcBase.js` |
| `mindcBase.js` | `AttributeClass`、`ASTNode` 等基础类型 |
| `mindcContent.js` | 内容表（`@copper` 等的 id） |
| `mindcHighlightScan.js` / `mindcHighlightWorker.js` | 编辑器高亮（Worker 里跑） |
| `mindcCompileWorker.js` | 编译 Worker |

### 其它目录

| 目录 | 内容 |
|---|---|
| `docs/` | 面向使用者的文档 + 数组布局的设计记录（见下） |
| `testers/` | 回归测试与全部测试工具（见 `testers/INFO.md`） |
| `include/` | `#include` 用的头文件与 `.js` 扩展（`archon.h`、`math.h` 等） |
| `ds/` | `mindcArray.js`，独立的数据结构库 |
| `prompts/` | 生成这份代码时用的提示词存档 |
| `main.html` | 浏览器版 IDE。**也是最容易暴露加载顺序问题的地方** |
| `tester.html` | 浏览器版测试页 |

### 文档

| 文件 | 内容 |
|---|---|
| `docs/README.md` | 语言指南（入门读这个） |
| `docs/TYPES_AND_FUNCTIONS.md` | 类型表与内置函数表 |
| `docs/PSEUDO_LIST.md` | 伪列表：内存不够时的数组替代方案 |
| `docs/asm.md` | 直接插入汇编 |
| `docs/LiyueSprache/` | 中文文档 |
| **`docs/PLAN_array_layout.md`** | **数组表示 / handle / `vec` 内建函数的设计与实施记录**。动手改数组相关代码前先读它 |

## 编译器的用法

```js
import { Compiler } from './mindc.js';
import { AttributeClass } from './mindcBase.js';
import { MemoryBlock } from './mindcGeneratorBase.js';

const cfg = new AttributeClass();          // 传 null 也可以，默认 targetVersion 154.3
cfg.setAttribute('targetVersion', 154.3);
const c = new Compiler(src, [new MemoryBlock('cell1', 64)], cfg);
const r = await c.compile();               // { success, code, errors, warnings, fatalError }
```

`config` 传 `null` 也可以：`mindc.js:327` 会补一个空 `AttributeClass`，
:328-329 再把 `targetVersion` 默认成 154.3。

`main.html` 用的就是这一行（main.html:1232）：`new Compiler(code, blocks, null)`，
它页面上的默认内存块是 `cell1` / 64 格（main.html:351-352）。
**用 `cell1` 还是 `bank1` 不影响优化结果**——两者都只是名字，测试用的
`runsim.mjs` 传的是 `bank1`。

## 跑测试

**所有 runner 都必须从 `testers/unit_tests` 目录启动**，因为它们按相对路径读用例目录。

```powershell
cd testers\unit_tests
node ..\tools\check.mjs        # 171 个带预期输出的用例
node ..\tools\negative.mjs     # 51 个必须编译失败的用例
node ..\tools\nomem.mjs        # 7 个不链接内存块的用例
node ..\tools\loadorder.mjs    # 12 个模块入口的加载顺序
node ..\tools\runall.mjs       # 101 个「能编译能跑完」的用例
```

用例的注解（`EXPECT:` / `EMIT:` / `MESSAGE:` …）由 `testers/tools/annotations.mjs`
统一解析，各 runner 共用。**注解的值是整行**，可以含 `*`；它只从注释里读，
代码里写的 pragma 不算注解，反过来注释里提到的 pragma 也不算。

## 支持的 pragma

全部在 `mindc.js` 的 `tokens.pragmas.forEach(...)`（:372-508）里分发。

- `#pragma comment(attribute, value)` —— 直接写进 parser config
- `#pragma optimize(array[, mutable[, const]])` —— 数组优化
- `#pragma optimize(pointer)` —— 指针改存被指对象的**名字**而不是地址。**默认关闭**；
  需要 v150，且这些指针禁止做算术
- `#pragma optimize(struct_pointer[, N])` —— 结构体指针改存**每个成员的名字**。
  阈值是 N 个寄存器以内，超过就留在内存里。**不给 N 时**：有内存可用则取 4，
  没有内存则不限（反正也没别处可放）
- `#pragma overload(auto|default|none)` —— **仅记录，尚未实现**。记录下来是为了让语义
  分析能给出明确拒绝，而不是默默忽略；写了别的值直接抛错
- `#pragma noinline` / `#pragma noinline(fn)` —— 禁止自动内联；`inline` 关键字优先级更高
- `#pragma stackcheck(fn)` / `#pragma stackcheck()` —— 栈帧放不下时调用 fn / 完全不检查
  容量。**不写该 pragma 时**：向 `__error` 写一条固定信息并停机
- `#pragma stackunderflow(fn)` / `#pragma stackunderflow()` —— 栈被走到第一个块以下时
  调用 fn；**不写时（默认）不检查**
- `#pragma id(item, @myitem:300)` —— 覆盖内置内容编号，优先于内置表。
  `@oldname:null` 表示这个名字没有编号
- `#pragma var(int, @myVar)` —— 声明处理器变量（同 `@this`）

## 模拟器的可注入行为

`Processor` 实例（`testers/tools/sim.mjs`）上可以装这几个回调，用来自己建模世界。
**默认什么都不建模**——`control` / `draw` / 单位指令一律只记录不执行。

| 装什么 | 签名 | 什么时候被问 |
|---|---|---|
| `processor.sensorProvider` | `(device, property) => value` | 每次 `sensor`。**返回 `undefined` 就回落到内置实现**（`@name`、`@type`、`@id`），仍读不到则读为 `null`——和游戏里未连接／已摧毁的建筑一致 |
| `processor.unitProvider` | `(contentName) => unit \| null` | `radar` 和 `ubind`：找该类型的单位。找不到就是 `null` |
| `processor.ucontrolProvider` | `(actionName, argNames) => true \| undefined` | `ucontrol`：返回操作是否成功（写进 `args[4]` 那个结果寄存器）；返回 `undefined` 就不写 |
| `processor.ulocateProvider` | `(outNames) => [x, y, found, building]` | `ulocate`：**只传最后 4 个输出寄存器的名字**。返回数组按位写入；返回 `null` 则四个全写 `null` |

`actions()` 把这些记录汇总起来，检查生成的代码时很好用：

| 属性 | 内容 |
|---|---|
| `processor.actions()` | `[...controls, ...draws, ...effects]` —— 该处理器向世界发出的全部指令文本 |
| `processor.controls` | 只有 `control` |
| `processor.draws` | 只有 `draw` |
| `processor.effects` | 单位 / `ucontrol` / `ulocate` / `spawn` / `effect` 等 |
| `processor.lines` | 每次 `printflush` 刷出去的一行 |
| `processor.trap` | 停机原因，`null` 表示跑完了 |
| `processor.steps` | 已执行的指令数 |

## 踩过的坑（改代码前先看）

1. **模块加载顺序。** `main.html` 曾经报
   `ReferenceError: Cannot access 'Instruction' before initialization`，因为
   `mindcInfrastructure.js` 在模块求值期就读 `Instruction`（`class VariableRet extends
   Instruction`）。修法是把指令类抽成叶子模块 `mindcInstruction.js`，而不是去调
   `main.html` 的 import 顺序。`testers/tools/loadorder.mjs` 守着这条线——
   **它必须每个入口起一个独立 `node` 进程**：在同一个进程里循环 import 会因为第一轮
   已经把子图缓存热了而误报通过（这一点被实测证伪过）。
   `mindcCompileWorker.js` / `mindcHighlightWorker.js` 需要 `self`，故豁免。

2. **`mindcCompileWorker.js` 会把 `console.log` 整个换成 noop。** 想看编译器的调试输出，
   要在 import 任何模块**之前**先把真正的 logger 绑出来。

3. **优化器的调试日志不是无副作用的。** 它会对可能还在构造中的 AST 节点调
   `String()`，而 `IdentifierNode.toString()` 在 `location` 还没填上时会抛
   `Cannot read properties of undefined (reading 'line')`。所以想静音输出，
   要用 `() => {}`，**不要**用 `(...a) => a.map(String).join(' ')`。

4. **`canOptimize` 是一致性开关，不是性能开关。** 它决定「后续读能不能折成常量」，
   所以只要写完之后值不是真的已知，它就必须是 false —— 否则读到的是过期常量，
   属于**静默编译错误**而不是少优化了一次。`TRACKED`（写入发生、值未知，循环体里就是
   这个）必须把它置 false。详见 `docs/PLAN_array_layout.md` §8。

5. **`testers/tools/` 里有 6 个一次性脚本是坏的**：`ex6run.mjs`、`ms2run.mjs`、
   `ms3run.mjs`、`ms4run.mjs`、`hdrsim.mjs`、`pdtest.mjs` 都写着
   `from '../sim.mjs'`，而 `sim.mjs` 就在 `tools/` 里，应为 `'./sim.mjs'`。
   改路径即可修复，但先确认还需要不要它们。

6. **文件换行符不统一**（`core.autocrlf=true`）：`mindcGeneratorBase.js`、`mindc.js`、
   `mindcContent.js`、`mindcHighlightScan.js`、`mindcLexer.js`、`AI_README.md`、
   `README.md` 是 LF，其余是 CRLF。缩进也不统一：`mindcSemantic.js` 用 4 空格，
   `mindcGenerator.js` / `mindcOptimizer.js` 用 Tab。写脚本批量改文件时，
   锚点文本的行尾和缩进必须逐字节对上，否则会静默匹配 0 次。

7. **注释里的坑**：`**/` 会提前关掉 `/** */`；`EMIT:` 的正则里出现裸的 `/`；
   少写一个 `*/` —— 这三种都会让整块断言静默失效。`MESSAGE:` 的正则不能以 `/` 结尾。

## 不要重复记录同一个事实

数组表示有几条正交的轴（元素布局、传输方式、请求、remote、const、别名），
每条轴有且只有一个权威字段。完整表格和「为什么不能加 `TypeInfo.representation`」
在 `docs/PLAN_array_layout.md` §0。**加字段前先读那一节。**
