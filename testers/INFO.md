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
| `node ..\tools\check.mjs` | `check/` | **267 passed, 0 failed**（163 shape assertions, 1189 pragma-invariance runs） | 编译后在模拟器里真跑一遍，输出逐行比对 |
| `node ..\tools\negative.mjs` | `negative/` | **102 passed, 0 failed** | 必须编译失败，**且给出说得清的理由** |
| `node ..\tools\nomem.mjs` | `nomem/` | **16 passed, 0 failed** | 不链接任何内存块时仍能正确工作 |
| `node ..\tools\loadorder.mjs` | 仓库根的 `mindc*.js` | **12 passed, 0 failed, 2 exempt** | 每个入口单独起一个 `node` 进程导入，不得有循环依赖 |
| `node ..\tools\runall.mjs` | 14 个目录：`suite/` `mem/` `arr/` `arr2/` `ptr2/` `stack/` `tests/` `uc/` `cases/` `exttests/` `hdr/` `t/` `big/` `u/` | **267/275**（8 个已知坏例以 KNOWN-GAP 如实上报，不算失败） | 能编译、能跑完不崩；带 `EXPECT:` 的还比对输出 |

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
| `EXPECT-LINE: [ 3]` | `check/` | 期望输出，保留行内空格（逐行精确比较） |
| `CONCAT` | `check/` | 比较连续的 print 缓冲区；不插入模拟器默认的逐条换行 |
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
| `VERSION: 140` | `check/`、`negative/`、`nomem/` | 用旧目标版本编译 |
| `KNOWN-GAP: <理由>` | `negative/`、`runall/` | 今天达不到标准（`negative/` 是编译器接受它）；如实上报，不算通过。`runall.mjs` 还会在它开始通过时点名注解过期 |
| `EXPECT: a b c` | `runall/` | 期望输出，与 `check.mjs` 同样的逐行比对；runall 目录里只有 6 个文件带它 |

`check/` 的 pragma 不变性：每个用例都会被加上各种 `optimize(...)` 变体**重跑一遍**，
输出必须完全一致。**任何 pragma 都不得改变程序输出。** 目前 267 个用例里只有
t214、t216 和 t221 声明 `NO-INVARIANT`：它们固定用 148 编译，而 `pointer` / `struct_pointer`
这些变体本身要求 v150+。

重跑时变体是写成**真实文件**（`check/<名字>__INV.c`）再交给 `simulate` 的，不是把
源码文本喂进去。因为 `simulate` 是按**文件路径**去解析 `// PEER:` 的；只给文本的话
对端会被静默丢掉，于是这个用例会因为一个跟 pragma 毫无关系的原因失败。

## 目录地图

`testers/unit_tests/` 下共 **671 个 `.c`，全部有 runner**（267 + 11 + 102 + 16 + 275 = 671）：

| 目录 | 文件数 | 谁来跑 |
|---|---|---|
| `check/` | 267 | `check.mjs`（同时驱动 `check/peers/` 的 11 个对端，见下文） |
| `t/` | 98 | `runall.mjs`（早期按主题分的用例，`2dc683e` 起纳入） |
| `negative/` | 102 | `negative.mjs` |
| `suite/` | 50 | `runall.mjs` |
| `mem/` | 25 | `runall.mjs` |
| `tests/` | 25 | `runall.mjs`（另有手工的 `batch.mjs [baseline]`） |
| `uc/` | 15 | `runall.mjs` |
| `ptr2/` | 13 | `runall.mjs` |
| `hdr/` | 12 | `runall.mjs`（另有手工的 `hdr.mjs` / `hdrsim.mjs`） |
| `arr2/` | 11 | `runall.mjs` |
| `peers/` | 11 | 不是独立用例：由 `check.mjs` 代它们的属主跑 |
| `big/` | 8 | `runall.mjs` |
| `nomem/` | 16 | `nomem.mjs` |
| `u/` | 6 | `runall.mjs` |
| `exttests/` | 4 | `runall.mjs` |
| `cases/` | 3 | `runall.mjs` |
| `stack/` | 3 | `runall.mjs`（`2dc683e` 起纳入；§3.3 修复后 3 个全部通过） |
| `arr/` | 2 | `runall.mjs` |

有 runner 不等于断言密：`check/` 每个用例都比对输出，而 `runall.mjs` 那 275 个的
门槛只是「能编译、跑完不崩」，runall 目录里只有 6 个文件带 `EXPECT:`（`suite/04_struct`、`mem/d1`、`ptr2/p1`、`tests/compound` 是最近补的四个）。

## check/ 的编号约定

`check/` 用 `tNN_主题.c` 命名，**编号 1–254 已用满，没有空号**，下一个用例是 `t255`。
另有 13 个不带编号的（`m1`–`m3`、`n1`–`n2`、`rw1`–`rw2`、`seq1`、`memsp2`–`memsp3`），
它们早于编号制，保留原名。

`// RUNS: N` 让测试模拟器在 `end()` 后从 pc 0 重启并保留寄存器/内存（`stop()` 仍然永久停止）；t186–t189 使用这一机制验证跨运行状态。

新增用例时：**挑一个没人验证过的行为**，并且先确认要断言的事实没有被别的用例断言过——
同一个事实记两遍，两处都会各自腐烂。

### `check/peers/` —— 对端处理器

`check/peers/` 里的 11 个 `.c` **不参与 `check.mjs` 自己的用例循环**——它们是**另一个
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

当前用到的：`t92`、`t101`–`t106`、`t108`、`t123`、`t246`（`t106` 用两个对端，`t246`/`t249`/`t250` 共用 `t246.peer.c`，共 11 个对端文件）。

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
| `t160`–`t161` | **Phase 7**：typedef 数据指针走别名构造器（`t160`，`&全局数组元素` 一条已由 §3.4 修好并移入 `t166`）；`&` 对 remote 与非 remote 必须生成不同代码（`t161`，`EMIT` 断宽度、`EMIT-NOT` 断不得互串） |
| `t162` | **§7.1**：单引号字符字面量是 `int`（取 ASCII 值），双引号 `"a"` 才是 `char`；`'x'` 走 `int` 重载、`"a"` 走 `char` 重载，转义与全局初始化器都按数值来；`char c = 'x'` 现在是干净的 `int`→`char` 拒绝 |
| `t163` | **§7.2**：`for` 的每个子句都可以为空，init 也可以是声明，且声明活在循环自己的作用域里——循环后名字就没了（`negative/for_loop_init_scoped_refused.c`），外层同名变量被正确遮蔽（`0 1 2 99` 就是遮蔽段）；`for (;;)` 靠 `break` 正常终止 |
| `t164` | **§3.6**：两边都是数组的 `a = b;` 是逐元素拷贝（与 `veccpy` 同一个循环，取两者长度的较小值）；以前是按引用、什么都不拷，`a[0]` 会读回自己的初值 |
| `t165` | **§3.6**：寄存器数组也照拷——`array("embedded_divided")` 目标走同一个循环，布局不参与，因为以前根本没写 |
| `t166` | **§3.4**：全局数组元素地址（`&arr[2]`、`&arr[0]`、经函数传递后解引用）与全局结构体/联合体成员地址（含带初始化器列表的）全部可用；启动时把活地址对 `X_block`/`X_pos` 从容器自己的内存位置写入 |
| `t167` | **§3.7**：open-dimension 数组参数（`int s[]`）是按值传的 packed handle；写元素（`s[i] = ...`）能到调用方数组，runner 用 `#pragma noinline` 等五种不变性 pragma 重跑也一致 |
| `t168` | **§3.8**：有尺寸参数（`int s[4]`）接收已绑定的 unbound handle（`int h[]; h = e;`）时按 handle 传递；读元素、`lenof`、写穿到调用方都正确，五种不变性 pragma 下一致 |
| `t169` | **§3.9**：数组别名（`int a[] = mem;`）的元素写会到达目标；genuine memory、常量初始化的自动 encoded、embedded、别名套别名都覆盖，runner 在五种不变性 pragma 下重跑 |
| `t170` | **§3.11**：do-while 语义——body 至少执行一次、`continue` 跳到 test、`break`、嵌套；五种不变性 pragma 下一致 |
| `t171` | **§7.9**：与相同 trip count 的 while 对比，两者都被完全优化掉（`EMIT: print 3`、`EMIT-NOT: op lessThan`） |
| `t172` | **§7.10**：switch-case（C fallthrough、`break`、`default` 位置、case 常量、char、switch 内 `continue`、嵌套、内联函数中的 switch）；五种不变性 pragma 下一致 |
| `t173` | **§7.10**：switch 与循环的四向嵌套——do-while 内 switch（改循环变量 / 只改副作用变量）、switch 的 case 内 for/while/do-while、while → switch → for；含 switch 的循环不参与确定性优化，五种不变性 pragma 下输出一致 |
| `t174` | **§7.11**：常量 discriminant 的 switch 被折叠成实际路径；顶层 `switch(2)` → `print 5`，`while` 内 `switch(0)` → `print 3`；`EMIT-NOT: op lessThan` |
| `t175` | **§7.11/§7.12**：折叠的保守边界——`if` 内的 switch `break`、平铺层声明保持 switch；case 块内声明可折；并在循环内运行条件 `break` 的 switch（防陈旧常量折叠）；输出 `1 5 7 3` |
| `t176` | **§7.12**：`switch(i)` 的逐轮模拟——统一步长、非统一步长、带 fallthrough 的累加变量；三个循环全部折叠为常量，输出 `3 3 4 221`；`EMIT-NOT: op lessThan` |
| `t177` | **§7.13**：密集 switch 的 encoded 跳转表——base-57 字符串存目标行号，`read` + Horner + `set @counter`；filler 把 switch 推到 57 行之后，覆盖高低位与 `$`/`&`；无 default（越界走 `switch_end`），输出 `10 13 17`；`EMIT: read __switch_tgt_` |
| `t178` | **§7.13**：稀疏 range（0..6 与 100000）回退比较链；输出 `10 17 99`；`EMIT-NOT: read __switch_tgt_` |
| `t179` | **§7.13**：encoded 表保持 default 居中、fallthrough、循环内 break/continue、嵌套 switch；输出 `100 9 1 3 200 9 1 99 99 99 3 299` |
| `t180` | **§7.14**：`#pragma optimize(switch_table, off)` 让密集 switch 保持比较链；输出 `10 13 17 99` |
| `t181` | **§7.14**：`#pragma optimize(switch_table, 32)` 强制 3-case 稀疏 switch 用 encoded 表；输出 `10 11 12 99` |
| `t182` | **§7.15**：`for (int i = ...)` 的 switch 累加——`i` 在 forinit 作用域、`sum` 在外层作用域，两者分别播种；fallthrough 输出 `150`，带 `break` 输出 `65`；`EMIT-NOT: op lessThan` |
| `t183` | **§7.15**：更多 `for (int i = ...)` 形状——普通累加、`break`、步长 2、`i != 5`；全部折叠，输出 `10 3 20 10`；`EMIT-NOT: op lessThan` |
| `t184` | **§7.15**：for-init 循环的保守路径——`continue`、含 `print` 的 switch（不再被误删）、switch 内累加并打印、条件 `break` 的 switch；输出 `8 10 20 0 20 1 2 100 200 300 6 3` |
| `t185` | **§7.16**：左/右移与复合赋值——运行时/常量、与 `+`/`<` 的优先级、左结合、`<<=`/`>>=`、unsigned、变量移位数、case 标签中的 `1 << 3`；输出 `8 4 8 8 1 16 8 4 15 12 7`；`EMIT: op shl` / `EMIT: op shr` |
| `t186` | **§7.17**：`static` 本次运行内持久——局部/全局 static 两次运行都输出 `2 1`；静态局部被多调用点调用也不会被内联复制 |
| `t187` | **§7.17**：`persistent` 跨运行持久——局部/全局/未初始化 persistent 输出 `2 1 0`，下一次运行 `4 2 1` |
| `t188` | **§7.17**：存储形状——static/persistent 的 embedded 数组、未初始化数组、未初始化 struct、普通全局变量；两次运行输出 `2 3 0 2 3 0 0 2 3 0 4 5 0 0` |
| `t189` | **§7.17**：`extern` 显式初始化仍在本侧每次运行执行（`10 0`），无初始化器的 `extern` 不重置（下一次运行 `10 1`）；`// RUNS: 2` |
| `t190` | **§7.17**：嵌套结构体初始化 `{{1,2},3}`；static 每次运行重置、persistent 跨运行累加；指针成员不置零、非指针成员正常置零 → `123 223 0 0 123 323 0 0` |
| `t191` | **§7.18**：`char` 是数值/字符——`char c='A'`、`char[]="Hi"`、`char*` 指针算术、`sizeof("Hi")`、`sizeof(char)`；输出 `65 66 67 88 105 0 105 2 3 72 1 2` |
| `t192` | **§7.18**：`string_t` + `string_view` + message 拼接——`@size` 与 `@bufferSize`、`concat_to_message`、`read(message1,i)`；输出 `5 104 101 6 5 hellohello10 104 111` |
| `t193` | **§7.18**：`const char*` 上下文的字面量物化——赋值、函数参数、返回值；可写 `char[]` 仍通过 `char*` 修改；输出 `72 72 105` |
| `t194` | **§7.18**：`include/string.h` 的 C 字符缓冲区函数——`strcat`、`strcpy`、`strlen`、`strcmp` 作用于真正的 `char*`；输出 `4 0 97 100` |
| `t195` | **§7.18**：`#pragma legacy_char_string` 过渡入口——`char` 在词法层读作 `string_t`；`char s="hi"; s[0]` 输出 `104 105` |
| `t196` | **§7.19**：01-A3——`abs`/`min`/`max` 的整型参数结果不再多插一条 `op floor`；输出 `4 3 7`，`EMIT-NOT: op floor/` |
| `t197` | **§7.20**：`&&`/`||` 与 `?:` 的 C 求值顺序——内联后仍短路，未选中分支不执行；输出 `0 0 1 1 1 1 2 0 3 0` |
| `t198` | **§7.20**：`#include <stdbool.h>` 兼容头；`bool`/`true`/`false` 正常；输出 `1 0 1` |
| `t199` | **§7.21**：`enum` 值/自增/typedef/数组长度/switch；输出 `0 5 6 3 6 13 6 3 7` |
| `t200` | **§7.21**：匿名/具名/自引用/嵌套/指针 `typedef struct`；输出 `3 1 2 7 1 2` |
| `t201` | **§7.22**：`printf` 的 `%d`/`%s`/`%f`，格式串编译期拆分；输出 `a=3 s=hi f=2.5` |
| `t202` | **§7.22**：`assert(1)` 不阻断 + `__FILE__`/`__LINE__`；输出 `<source> 1 9` |
| `t203` | **§7.22**：`assert(0)` 打印并 `stop`，后续代码不可达；输出为空 |
| `t204` | **§7.23**：多成员 union 强制内存——offset 0、`sizeof` = 最大成员、嵌套 struct、单成员 union 仍可用寄存器；输出 `7 7 0 2 4 1` |
| `t205` | **§7.24**：unsigned 位域寄存器布局——3/5/12/26-bit、LSB-first、掩码、`++`/`+=`、52-bit 上限、超过换 cell；输出 `7 3 1 0 5 4095 1234 2345 3456 67108863 33554431 1 7 3 2 3 134217727 1 2` |
| `t206` | **§7.24**：内存结构体中的位域——嵌入数组迫使内存，bitfield cell 仍用 mask/shift；输出 `7 3 2 3 9` |
| `t207` | **§7.24**：signed 位域——3-bit 的 -1/-4、内存回退、52-bit 边界；输出 `-1 3 3 -4 -2 3 -1 2251799813685247` |
| `t208` | **§7.25**：函数原型——定义前调用、定义后冗余原型、重载原型、从未调用的原型；输出 `3 4 1 2` |
| `t209` | **§7.25**：`auto` 函数原型——原型并入模板条目，只有定义展开具体版本；输出 `1 2` |
| `t210` | **§7.25**：结构体/联合体前向声明——互指结构体、`typedef struct P P;`、指针与值类型、`sizeof`；输出 `1 2 1 5 3 1` |
| `t211` | **§7.25**：模板结构体前向声明——`auto` 成员定义后按值/typedef 使用，指针类型可在完成前声明；输出 `7 3 8 4 2` |
| `t212` | **§7.25**：块作用域——局部原型指向后面的全局定义、局部 struct/typedef/enum、tag 与 typedef 遮蔽；输出 `4 2.5 2 3 5 7` |
| `t213` | **§7.26**：enum 作为 struct/union 成员与函数参数——具名/匿名/内联 enum、`enum ... var;`、typedef、参数与返回值、局部 struct；输出 `1 11 21 31 41 1 1 3 2 51` |
| `t214` | **§7.27**：148 目标下的 stdio——`assert`/`stdbool`/`string.h`/`strlen` 可用；`printf` 逐段生成 `print`，常量 `%02d` 正常；`EMIT-NOT: format`；输出 `5 1 7 hello x= 3 [03]` |
| `t215` | **§7.27**：`printf` 常量 flags/宽度/精度——`%2d`、`%02d`、`%+d`、`%.2f`、`%5s`、`%-5s`、`%%`；运行时 `%d` 仍走 `format`；输出保留行内空格 |
| `t216` | **§7.28**：148 目标下 `ulocate`/`ucontrol` 使用 `&x` 输出；无需 byname；输出 `11 22 1 core1 1` |
| `t217` | **§7.28**：JS 扩展 `nominalPointers`——`nomstore(&x, 42)` 走寄存器名，`volatile` 目标走指针回写；输出 `42 7` |
| `t218` | **§7.29**：运行时整数宽度/精度——`%5d` 内联，`%+05d`/`%.5d`/`%-5d`/`%05d` 走 `__printf_int`；输出保留空格 |
| `t219` | **§7.29**：运行时浮点宽度/精度——`%.2f`、`%8.2f`、`%08.2f`、`%+8.2f`、`%-8.2f`、负数、进位；输出保留空格 |
| `t220` | **§7.29**：v154 运行时字符串宽度/精度——`%5s`、`%-5s`、`%.2s`、`%6.2s`；输出保留空格 |
| `t221` | **§7.29**：148 目标下运行时整数/浮点字段；`NO-INVARIANT`；输出保留空格 |
| `t222` | **§7.30**：C99 兼容头——stddef/stdint/limits/float/ctype/stdlib/string/inttypes/assert/math；输出 `3 42 … d` |
| `t223` | **§7.30**：`NDEBUG` 移除 `assert(0)`；输出 `7` |
| `t224` | **§7.30**：`_Static_assert`/`static_assert`、`__func__`、`restrict`；输出 `main f 3 3` |
| `t225` | **§7.31**：指定初始化器——结构体/数组、全局/局部、未指定成员补零；输出 `0 2 7 0 0 0 0 0 5 3 4` |
| `t226` | **§7.31**：宏 `#`/`##`/`__VA_ARGS__`——`STR`/`XSTR`、`CAT`/`CAT3`、`ADD`；输出 `42 hello 3 7 5` |
| `t227` | **§7.32**：标准复合字面量——标量/旧写法、寄存器与内存结构体、指定初始化器、数组、直接后缀访问、函数参数、取地址、`sizeof`、全局对象；输出 `3 3 7 1 2 0 7 2 5 6 8 9 7 8 5 6 4 7 2 3 8 9 7 6` |
| `t228` | **§7.33**：复合字面量作为数组初始化器——固定/开放/extern、结构体与指针二维数组、designator；输出 `7 8 9 1 2 3 4 5 6 5 6 10 20 7 3` |
| `t229` | **§7.33**：extern 数组按实际布局导出——memory 导出 `_block/_pos`、寄存器数组导出元素名、handle 不导出；输出 `2 5 8` |
| `t230` | **§7.33**：别名解析——本地与 extern 别名数组的 `remote()` 绑定使用根数组；输出 `2 2 5 5` |
| `t231` | **§7.33**：extern 生命周期组合——`extern`、`extern static`、`persistent extern` 两轮运行；输出 `1 0 1 1 1 1 1 2` |
| `t232` | **§7.34**：本地多维数组——embedded/encoded/memory、嵌套与扁平初始化、嵌套下标；输出 `6 2 12 6 5 2 6` |
| `t233` | **§7.34**：多维数组作为一维 handle——memory/embedded 的 `int s[]` 平铺视图与固定二维参数；输出 `6 6 6 12 12 2` |
| `t234` | **§7.35**：多维 remote 数组——shaped `[2][3]`、扁平 `[]`、`lenof` 与扁平导出；输出 `2 6 2 6 6 5` |
| `t235` | **§7.35**：真实对端的多维 remote——owner `int[2][3]`，remote shaped 与显式扁平视图；输出 `2 6 6 6` |
| `t236` | **§7.36**：复杂元素数组自动 memory——struct/指针数组、显式 traditional；输出 `3 4 3 7 8` |
| `t237` | **§7.37**：byname 指针数组——自动/显式寄存器布局、解引用、动态下标、赋值、handle；输出 `7 8 8 10 8 9 2 9` |
| `t238` | **§7.38**：flat registry struct 寄存器数组——成员访问、整体赋值、嵌套 struct、补零、lenof/sizeof；输出 `3 4 9 3 4 7 0 5 6 7 2 4` |
| `t239` | **§7.38**：多维 register struct 数组——常量下标、lenof/sizeof；输出 `5 4 2 8` |
| `t240` | **§7.39**：动态 register struct 下标——逐叶读取、选中名字写入、整体赋值、嵌套 struct；输出 `3 4 9 10 3 4 4 6` |
| `t241` | **§7.40**：enum / 嵌套 enum 成员的 register struct 数组——常量/动态下标、整体赋值；输出 `1 4 2 3 4 2 3 1 5 5 7` |
| `t242` | **§7.40**：数组/union/普通指针/byname 指针/位域成员数组的 memory 布局——含位域打包与 byname 名字初始化；输出 `4 5 6 7 8 7 9 11 12 3 5 1 2` |
| `t243` | **§7.41**：位域 register struct 数组——打包、常量/动态读写、整体赋值、混合与嵌套；输出 `3 5 7 3 8 5 3 5 9 1 2 6 9 1 2 3 5 9 6` |
| `t244` | **§7.41**：byname 成员的 register struct 数组——常量/动态解引用与赋值、整体赋值、嵌套；输出 `7 1 7 3 4 8 2 8 8 2 7 3 4 8` |
| `t245` | **§7.42**：memory struct 数组元素赋值——寄存器值、复合字面量、裸初始化列表、元素间复制、反向读取、解引用指针；输出 `1 2 3 4 5 6 3 4 5 6 9 10` |
| `t246` | **§7.43**：真实对端上的 remote struct 数组——标量、位域、byname 成员；输出 `4 1 7 9` |
| `t247` | **§7.43**：多维 remote struct 数组——动态下标、整体读写、嵌套展平、lenof；输出 `5 6 9 3 4 7 2` |
| `t248` | **§7.44**：self-remote byname 赋值通过默认 device 检查；输出 `7` |
| `t249` | **§7.44**：真实对端 device 不匹配，`#pragma checkRemote(fail)` 调用 handler 后停止；输出 `99` |
| `t250` | **§7.44**：`#pragma checkRemote()` 关闭检查后继续；输出 `1` |
| `t251` | **§7.45**：persistent register struct 数组清零——位域/标量/嵌套叶子直接置 0，不再生成 `0.<leaf>`；输出 `0 0 0` |
| `t252` | **§7.46**：lookup handle helper——`lookup`/`sensor`/`read`，不再生成内容名 select 链；输出 `7 7` |
| `t253` | **§7.46**：packed lookup struct——一个 storage cell 的 struct 用 content 名字存整个值，动态位域读写；输出 `7 7` |
| `t254` | **§7.46**：remote lookup packed struct——lookup/sensor 后对 owner 读写，位域在本地提取；输出 `7 7` |

设计背景见 `docs/PLAN_array_layout.md`。

## negative/ —— 必须编译失败

「必须编译失败」只是**一半**的要求。另一半是**必须说出可操作的理由**：
「编不过」和「说清为什么编不过」不是一回事。

一个程序常常同时有好几个无关的拒绝理由。只断言「是否失败」的用例，
在它想守住的那条检查被删掉之后**依然会通过**——这正是删掉的检查不被发现的方式。
所以每条 `MESSAGE:` 都必须匹配到编译器真实给出的某一条错误。

**负债已清零**（`1584cf3`）。`negative/` 的 96 个用例全部带 `MESSAGE:`，没有
`KNOWN-GAP`：原先那两个（`ovl_auto.c`、`ovl_pragma.c`）已删除——自动模板 / 重载
已经实现，`check/t109`、`check/t110` 用正向用例断言同一事实。
`remote_as_value_refused.c`（§7.3）是第一个真正用上 `NOT-MESSAGE:` 的用例，
也顺带暴露并修掉了注解解析器的一个潜在冲突：`annotationsOf` 里的 `\bMESSAGE:`
会连 `NOT-MESSAGE:` 里的 `MESSAGE` 一起读进去——「不得出现」的那条于是被当成
正断言。现在要求标记前既不是字母数字也不是 `-`（`testers/tools/annotations.mjs`）。

`array_subscript_out_of_bounds.c`（§7.4）断言常量下标越界被拒：编译期已知长度时
按名字要求两条拒绝（`r[3]` 长度 3、`m[5]` 长度 2）；动态下标与长度未知的指针/句柄
不在这里查。它不增加 `MESSAGE:` 负债。

`array_parameter_assignment_refused.c`（§3.7）断言 open-dimension 数组参数（`int s[]`）的
整体赋值被拒：它按值收到调用方 handle 的副本，赋值只会改本函数的副本。写元素
（`s[i] = ...`）是受支持的路径，`check/t167` 在五种不变性 pragma 下都要求它到达调用方。

`alias_write_into_constant_refused.c`（§3.9）断言别名写入常量目标被拒：显式
`array("encoded")` 目标是正常语义错误（不再出现 `Internal parser error`），`const`
目标仍走既有的 `Cannot assign to const variable`。

五条 `switch_*` negative 用例（§7.10）断言：重复 case、非常量 case、重复 default、
float discriminant，以及 switch 内没有外层 loop 的 `continue`。

`negative/` 目前没有 `KNOWN-GAP`。

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
include→扩展这条路径，不再被静默跳过。`mindc.js:322` 那句
`extensions (Currently not working!!!)` 已确认是过期注释（初始上传 `d98dd2b` 时留下的）：
constructor 的 `extensions` 会进入 `embeddedExtensions`，`compile()` 把它们与
`#include "*.js"` 导入的扩展合并进 parser 的类型 / 函数 / handler 表；`exttests/` 的 4 个
用例就是证据。注释已改成说明这个参数实际做什么，§4.4 关闭。

## 已知的坏工具

`testers/tools/` 里的 6 个一次性脚本（`ex6run.mjs`、`ms2run.mjs`、`ms3run.mjs`、
`ms4run.mjs`、`hdrsim.mjs`、`pdtest.mjs`）曾把 `sim.mjs` 引成 `'../sim.mjs'`——
**`2dc683e` 已全部改成 `'./sim.mjs'`**。`testers/unit_tests/tools/` 下的同名副本
写的也是 `'../sim.mjs'`、而且那个目录里连 `sim.mjs` 都没有，但它们不是任何 runner
的入口、也没有谁 import 它们，保持原样（见 `docs/OPEN_WORK.md` §4.1）。
