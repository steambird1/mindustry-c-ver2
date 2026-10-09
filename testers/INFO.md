# 测试用例说明

本项目用一批 C 源程序做回归测试。**所有 runner 都必须从 `testers/unit_tests` 目录启动**，
因为它们用相对路径读用例目录。

> **注意**：`testers/unit_tests/` 底下**也有一个 `tools/` 目录**，那是早期留下的
> 草稿目录，里面只有 `patch_*.py`、`dbg*.mjs` 之类的脚本，**没有 `check.mjs`**。
> 所以必须写 `node ..\tools\check.mjs`，不能写 `node tools\check.mjs`。

## 五个 runner

全部在 `testers/tools/` 下。

| 命令（从 `testers/unit_tests` 执行） | 读哪个目录 | 当前结果 | 判定标准 |
|---|---|---|---|
| `node ..\tools\check.mjs` | `check/` | **176 passed, 0 failed**（102 shape assertions, 767 pragma-invariance runs） | 编译后在模拟器里真跑一遍，输出逐行比对 |
| `node ..\tools\negative.mjs` | `negative/` | **53 passed, 0 failed, 2 known gaps** | 必须编译失败，**且给出说得清的理由** |
| `node ..\tools\nomem.mjs` | `nomem/` | **7 passed, 0 failed** | 不链接任何内存块时仍能正确工作 |
| `node ..\tools\loadorder.mjs` | 仓库根的 `mindc*.js` | **12 passed, 0 failed, 2 exempt** | 每个入口单独起一个 `node` 进程导入，不得有循环依赖 |
| `node ..\tools\runall.mjs` | 14 个目录：`suite/` `mem/` `arr/` `arr2/` `ptr2/` `stack/` `tests/` `uc/` `cases/` `exttests/` `hdr/` `t/` `big/` `u/` | **265/277**（12 个已知坏例以 KNOWN-GAP 如实上报，不算失败） | 能编译、能跑完不崩；带 `EXPECT:` 的还比对输出 |

默认给两块 64 格内存（`bank1`、`bank2`），目标版本 154.3。
`loadorder.mjs` 豁免 `mindcCompileWorker.js` 与 `mindcHighlightWorker.js`（它们需要 `self`）。

### loadorder.mjs 为什么必须一进程一入口

在同一个进程里循环 import 各个入口，第一轮就已经把共享子图缓存热了，
后面的入口即使有循环依赖也会「通过」。这个假阴性被实测证伪过：未修复的代码树
在单进程版本下报 PASSING。所以每个入口都要独立进程。

## 注解

注解写在用例的注释里，由 `testers/tools/annotations.mjs` 统一解析——`check.mjs`、
`negative.mjs`、`nomem.mjs` 三个 runner 共用它。`runall.mjs` 也用注解，但只读它自己
认识的两条（`KNOWN-GAP`、`EXPECT`，见下表）；`loadorder.mjs` 不用注解。
下面三条规则都是踩过坑之后加的，改解析器前先读那个文件的头注释：

1. **注解值是整行**，可以含 `*`。早先 `check.mjs` 用 `([^*]*)` 读值，
   6 个文件里 8 条 `EMIT` 断言因此从未被执行，其中 6 条本来会失败。
2. **只从注释里读**。注释里「提到」一个 pragma 不等于代码里「写了」这个 pragma。
3. 源码里真正的 pragma 不影响注解解析，反之亦然。

| 注解 | 用在 | 含义 |
|---|---|---|
| `EXPECT: 1 2 3` | `check/` | 期望输出，一行一个值 |
| `EMIT: <正则>` | `check/` | 生成的代码**必须**有一行匹配 |
| `EMIT-NOT: <正则>` | `check/` | 生成的代码**不得**有行匹配 |
| `PEER: <名字>[=文件]` | `check/` | 另一个处理器的程序，见下文「`check/peers/`」 |
| `SELF: <名字>` | `check/` | 对端认识本程序处理器的名字（双向通信用） |
| `INTERLEAVE` | `check/` | 对端必须与主程序并发跑（互斥、握手类算法）。冒号可写可不写 |
| `NO-INVARIANT` | `check/` | 跳过下面的 pragma 不变性重跑 |
| `NO-INVARIANT: optimize(array)` | `check/` | 只跳过列出的这几个 pragma |
| `MESSAGE: <正则>` | `negative/` | 错误信息**必须**匹配一条（每行一条） |
| `NOT-MESSAGE: <正则>` | `negative/` | 错误信息**不得**匹配任何一条（每行一条）；用来断言「保持沉默」 |
| `NOMEM` | `negative/` | 这个用例在无内存块下编译 |
| `VERSION: 140` | `negative/` | 用旧目标版本编译 |
| `KNOWN-GAP: <理由>` | `negative/`、`runall/` | 今天达不到标准（`negative/` 是编译器接受它）；如实上报，不算通过。`runall.mjs` 还会在它开始通过时点名注解过期 |
| `EXPECT: a b c` | `runall/` | 期望输出，与 `check.mjs` 同样的逐行比对；全树只有 2 个文件带它 |

`check/` 的 pragma 不变性：每个用例都会被加上各种 `optimize(...)` 变体**重跑一遍**，
输出必须完全一致。**任何 pragma 都不得改变程序输出。** 目前 176 个用例里
没有任何一个声明 `NO-INVARIANT`。

重跑时变体是写成**真实文件**（`check/<名字>__INV.c`）再交给 `simulate` 的，不是把
源码文本喂进去。因为 `simulate` 是按**文件路径**去解析 `// PEER:` 的；只给文本的话
对端会被静默丢掉，于是这个用例会因为一个跟 pragma 毫无关系的原因失败。

## 目录地图

`testers/unit_tests/` 下共 **525 个 `.c`，全部有 runner**（176 + 10 + 55 + 7 + 277 = 525）：

| 目录 | 文件数 | 谁来跑 |
|---|---|---|
| `check/` | 176 | `check.mjs`（同时驱动 `check/peers/` 的 10 个对端，见下文） |
| `t/` | 100 | `runall.mjs`（早期按主题分的用例，`2dc683e` 起纳入） |
| `negative/` | 55 | `negative.mjs` |
| `suite/` | 50 | `runall.mjs` |
| `mem/` | 25 | `runall.mjs` |
| `tests/` | 25 | `runall.mjs`（另有手工的 `batch.mjs [baseline]`） |
| `uc/` | 15 | `runall.mjs` |
| `ptr2/` | 13 | `runall.mjs` |
| `hdr/` | 12 | `runall.mjs`（另有手工的 `hdr.mjs` / `hdrsim.mjs`） |
| `arr2/` | 11 | `runall.mjs` |
| `peers/` | 10 | 不是独立用例：由 `check.mjs` 代它们的属主跑 |
| `big/` | 8 | `runall.mjs` |
| `nomem/` | 7 | `nomem.mjs` |
| `u/` | 6 | `runall.mjs` |
| `exttests/` | 4 | `runall.mjs` |
| `cases/` | 3 | `runall.mjs` |
| `stack/` | 3 | `runall.mjs`（`2dc683e` 起纳入；其中 2 个是 KNOWN-GAP，见 `OPEN_WORK.md` §3.3） |
| `arr/` | 2 | `runall.mjs` |

有 runner 不等于断言密：`check/` 每个用例都比对输出，而 `runall.mjs` 那 277 个的
门槛只是「能编译、跑完不崩」，全树只有 2 个文件带 `EXPECT:`。

## check/ 的编号约定

`check/` 用 `tNN_主题.c` 命名，**编号 1–163 已用满，没有空号**，下一个用例是 `t164`。
另有 13 个不带编号的（`m1`–`m3`、`n1`–`n2`、`rw1`–`rw2`、`seq1`、`memsp2`–`memsp3`），
它们早于编号制，保留原名。

新增用例时：**挑一个没人验证过的行为**，并且先确认要断言的事实没有被别的用例断言过——
同一个事实记两遍，两处都会各自腐烂。

### `check/peers/` —— 对端处理器

`check/peers/` 里的 10 个 `.c` **不参与 `check.mjs` 自己的用例循环**——它们是**另一个
处理器的程序**。用到的用例在注释里声明（由 `runsim.mjs:126` 解析）：

```c
// PEER: processor1=peers/t101.peer.c   // 指定文件
// PEER: processor1                      // 省略文件 → 同目录的 <本文件名>.peer.c
// PEER: processor1=peers/a.c, p2=peers/b.c   // 多个对端
// INTERLEAVE:                            // 对端必须与主程序「并发」跑
// SELF: processorA                        // 对端认识本程序处理器的名字
```

**默认是对端先跑完、主程序再跑**（`sim.mjs:782`）：对端先把变量发布出去，主程序才能
直接从对端寄存器里读出 `q_block` / `q_pos`。所以 `remote` 语义的用例**必须有对端**——
一个处理器读不到另一个处理器的寄存器，没有对端的 `remote` 测试等于没测。

`INTERLEAVE` 是给互斥算法用的（`t105`/`t106`/`t108` 三个 Peterson 实现）：
它们要真的抢同一个变量，先跑完再跑就争不起来了。

当前用到的：`t92`、`t101`–`t106`、`t108`、`t123`（`t106` 用两个对端，共 10 个对端文件）。

### 分段覆盖

| 编号 | 主题 |
|---|---|
| `t01`–`t12` | 基础：运算、循环、数组、结构体、递归、指针、字符串、编码数组、综合、嵌套、指针混用 |
| `t13`–`t17`, `t25`, `t32`, `t39`, `t44`, `t45` | `widthof` 宽度矩阵（标量 / 指针层级 / 数组 / 结构体 / 表达式 / remote / byname 成员 / handle / 限定符 / 与 `sizeof` 对照） |
| `t18` | `bool` 返回值用在 `if` 条件里 |
| `t19`–`t21` | 编码数组（多位、全同值）与不加 pragma 的传统数组 |
| `t22`–`t28` | 内容编号、`#pragma id`、`#pragma var`、`@名字` 的不透明转换 |
| `t29`–`t33` | `embedded` / `encoded` 的元素寄存器必须真的被写入 |
| `t34`–`t38` | 输出参数在内存 / pragma / 寄存器指针 / volatile 下各自的行为 |
| `t40`–`t43` | `typedef`：数据指针、指针链、数组、多维数组 |
| `t46`–`t54` | 内联：副作用、名字指针、循环体、条件里的调用、`inline` 关键字 |
| `t55`–`t61` | 循环求值：`for` 转换、写全局、未知边界、超预算、无尽循环 + `break`、嵌套 |
| `t62`–`t63` | 已知边界链上的调用、调用前的语句删除 |
| `t64`–`t67` | 内容数组转换、`embedded` 辅助 get/set、长度推导 |
| `t68`–`t71` | 结构体数组（全局 / 嵌套 / 局部）、`sizeof` 与 `lenof` |
| `t72`–`t74` | 字符串拼接（编译期与运行期）、短路求值、`lenof` 的维度 |
| `t75`–`t77` | `memsp`、直接与运行期 `read`/`write` |
| `t78`, `t138`–`t142` | `byname` 限定符：基本、局部、赋值、全局目标、作为参数、两个指针 |
| `t79`–`t99`, `t101`–`t106`, `t108`, `t120`–`t123` | `remote` 与 handle：`@this`、数组、写入、lookup、混合、转发、双向、递增、指向数组元素 |
| `t83`–`t89` | 结构体名字指针与 `*remote` 结构体指针 |
| `t96`, `t113`–`t116`, `t136`, `t144` | 函数指针：指向指针、参数带数组、内存数组、handle 数组、内存数组当 handle、模板函数取地址 |
| `t100`, `t145`–`t149` | 数组参数：`noinline`、未定长参数、函数指针版、两个不同长度、未绑定变量 |
| `t107`, `t109`–`t112`, `t117`, `t143` | `auto` 的各种表示、混合指针表示、全局版、标量重载 |
| `t119` | `sensor` 的属性变量 |
| `t124`–`t131` | 结构体嵌套与模板实例、成员解引用、handle 打包、64 位位运算 |
| `t132`–`t135` | 结构体模板：实例、按值传、按指针传、多成员 |
| `t137` | 被取地址的函数直接调用 |
| `t150`–`t151` | **Phase 5**：`int a[];` 未绑定 handle，及其作为实参 |
| `t152`–`t156` | **Phase 6**：`vecalias`、`veccpy`（元素循环、handle 源、运行期钳制、remote） |
| `t157`–`t158` | 优化器 `canOptimize` 回归：循环体内声明必须真的被初始化；崩溃必须报出原因 |
| `t159` | `auto` 按实参个数的重载分派（`noinline` 防内联掩盖） |
| `t160`–`t161` | **Phase 7**：typedef 数据指针走别名构造器（`t160`；`&全局数组元素` 一条因 `OPEN_WORK.md` §3.4 缺陷故意缺席）；`&` 对 remote 与非 remote 必须生成不同代码（`t161`，`EMIT` 断宽度、`EMIT-NOT` 断不得互串） |
| `t162` | **§7.1**：单引号字符字面量是 `int`（取 ASCII 值），双引号 `"a"` 才是 `char`；`'x'` 走 `int` 重载、`"a"` 走 `char` 重载，转义与全局初始化器都按数值来；`char c = 'x'` 现在是干净的 `int`→`char` 拒绝 |
| `t163` | **§7.2**：`for` 的每个子句都可以为空，init 也可以是声明，且声明活在循环自己的作用域里——循环后名字就没了（`negative/for_loop_init_scoped_refused.c`），外层同名变量被正确遮蔽（`0 1 2 99` 就是遮蔽段）；`for (;;)` 靠 `break` 正常终止 |

设计背景见 `docs/PLAN_array_layout.md`。

## negative/ —— 必须编译失败

「必须编译失败」只是**一半**的要求。另一半是**必须说出可操作的理由**：
「编不过」和「说清为什么编不过」不是一回事。

一个程序常常同时有好几个无关的拒绝理由。只断言「是否失败」的用例，
在它想守住的那条检查被删掉之后**依然会通过**——这正是删掉的检查不被发现的方式。
所以每条 `MESSAGE:` 都必须匹配到编译器真实给出的某一条错误。

**负债已清零**（`1584cf3`）。54 个用例里 52 个带 `MESSAGE:`（个别用例还需要
`NOT-MESSAGE:` 断言「不得出现」），剩下 2 个是如实上报的 `KNOWN-GAP`——
编译器今天会接受它们，没有错误信息可断言：

| 用例 | 理由 |
|---|---|
| `ovl_auto.c` | 实参被解析到某一种表示，而不是被拒绝；这个用例记录的是缺失的检查 |
| `ovl_pragma.c` | 为尚未存在的特性写的 pragma 被接受并忽略，而不是被拒绝 |

`1584cf3` 之前哪 28 个缺注解，记在 `docs/PLAN_array_layout.md` §9；每个用例文件里
则是它自己那条注解为什么这么写。

## 模拟器

`testers/tools/sim.mjs` 的 `Processor` 支持
`set/op/jump/read/write/getlink/sensor/lookup/select/print/printflush/draw/drawflush/
control/radar/ubind/ucontrol/...`，并可注入 `sensorProvider`、`actions()`、`lines`
（详见 `AI_README.md`）。

`runsim.mjs` 导出两个函数，是所有 runner 的公共入口：

- `simulate(pathOrSource, memoryBlocks, extraAttributes = {})`
- `compileAndRun(source, memoryBlocks = bank1+bank2 64格, extraAttributes = {})`

`compileAndRun` 会预先处理 `#include "*.js"`（编译器扩展），把该行注释掉以保住行号，
再把扩展挂到 `Compiler` 上。**`2dc683e` 起 `EXT_ROOT` / `INCLUDE_ROOT` 指向仓库根的
`include/`**（真实存在，里面有 `.h` 和 `.js`），`exttests/` 那 4 个用例因此都能走通
include→扩展这条路径，不再被静默跳过。仍未对上的是 `mindc.js:322` 那句
`extensions (Currently not working!!!)`：要么它过期了，要么这 4 个用例没碰到它警告的
那部分——哪个对，读那句话写下的语境才知道，结论记在 `docs/OPEN_WORK.md` §4.4。

## 已知的坏工具

`testers/tools/` 里的 6 个一次性脚本（`ex6run.mjs`、`ms2run.mjs`、`ms3run.mjs`、
`ms4run.mjs`、`hdrsim.mjs`、`pdtest.mjs`）曾把 `sim.mjs` 引成 `'../sim.mjs'`——
**`2dc683e` 已全部改成 `'./sim.mjs'`**。`testers/unit_tests/tools/` 下的同名副本
写的也是 `'../sim.mjs'`、而且那个目录里连 `sim.mjs` 都没有，但它们不是任何 runner
的入口、也没有谁 import 它们，保持原样（见 `docs/OPEN_WORK.md` §4.1）。
