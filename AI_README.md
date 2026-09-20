# Mindustry-C（mindc）

一个用 JavaScript 编写的、把 C 编译为 Mindustry Logic（mlog）的编译器，附带一个 mlog 模拟执行器。

## 目录

- `mindc/` —— 编译器源码（`mindc*.js`）。入口是 `mindc.js` 中的 `Compiler`。
- `tools/`
  - `sim.mjs` —— mlog 模拟执行器（`Processor`，支持 set/op/jump/read/write/getlink/sensor/lookup/select/print/printflush/draw/drawflush/control/radar/ubind/ucontrol/...）
  - `runsim.mjs` —— 编译并运行单个 `.c` 文件（`simulate(file, blocks)`）
  - `check.mjs` —— 跑 `tests/check/` 下所有用例，文件首行写 `/* EXPECT: ... */` 给出预期输出
  - `runall.mjs` —— 跑所有测试目录，只检查能否编译并运行
  - `fulldump.mjs` —— 只输出编译产物（`compileTo(file, blocks)`）
  - `sizetest.mjs` —— 在不同内存容量下跑同一批用例
- `tests/`
  - `check/` —— 带预期输出的完整用例
  - `suite/`、`mem/`、`arr/`、`arr2/`、`ptr2/`、`stack/` —— 专项用例

## 用法

```js
import { Compiler } from './mindc/mindc.js';
import { AttributeClass } from './mindc/mindcBase.js';
import { MemoryBlock } from './mindc/mindcGeneratorBase.js';

const cfg = new AttributeClass();
cfg.setAttribute('targetVersion', 154.3);
const c = new Compiler(src, [new MemoryBlock('bank1', 64)], cfg);
const r = await c.compile();   // { success, code, errors, warnings, fatalError }
```

运行测试：`node tools/check.mjs`

## 模拟器的可注入行为

`Processor` 实例上可以设置：

- `sensorProvider = (device, property) => value` —— 自定义 `sensor` 的读数；返回 `undefined` 时回落到内置实现（`@type`、`@name`），未知属性读为 `null`。
- `processor.actions()` —— 该处理器对世界发出的所有指令（`control`、`draw`、`ucontrol` 等）。
- `processor.lines` —— 每次 `printflush` 的内容。

## 支持的 pragma

- `#pragma optimize(array[, mutable][, const])`
- `#pragma optimize(pointer)`（默认关闭，需要 v150）
- `#pragma stackcheck(fn)` / `#pragma stackcheck()` —— 栈溢出时调用 fn / 不检查；不写该 pragma 时向 `__error` 写入固定信息并停机
- `#pragma stackunderflow(fn)` / `#pragma stackunderflow()` —— 栈下溢，默认不检查
