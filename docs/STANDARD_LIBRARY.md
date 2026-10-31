# Mindustry-C 标准库与内建函数

本文列出：

- 编译器直接提供、无需 `#include` 的 Mindustry 指令包装和数学内建；
- `include/` 下的头文件与 `.js` 编译器扩展；
- 数组/内存/伪列表等运行时辅助函数；
- 与 C 标准库的对应关系。

语言层的类型、限定符、`auto`、`remote`、`byname`、数组句柄、`#pragma` 等见：

- [DIFFERENCES_FROM_C99.md](DIFFERENCES_FROM_C99.md)

本文中的“内建”指编译器直接降成一条或几条 mlog 指令，通常不生成普通函数调用；“头文件函数”则是用 C/内建写成的普通函数或宏。

---

## 1. 调用约定

Mindustry 的指令风格是“输出参数在左边”。本编译器采用：

- 如果原指令把返回值放在第一个参数，函数就用**返回值**表示它；
- 其余输出参数用**指针**传入（`ulocate`、`ucontrol` 等）；
- 如果是 `device` 这类不支持指针的类型，用 `(volatile type*)(object)` 的“原样传递”形式；
- `...` 表示变参：按 Mindustry 指令文本中“必要参数”的顺序传入。

字符串型参数（`draw` 的 action、`control`/`ucontrol` 的 action、`radar` 的条件/排序、`lookup`/`ulocate` 的类别等）通常**必须是字符串字面量**，因为它们在编译期要拼进指令。

`print` 不是 C 的 `printf`：它按参数依次输出，不解析格式串；需要发送到消息板时调用 `printflush(device)`。

---

## 2. 核心 Mindustry 内建

这些函数由编译器直接处理，不需要 include。

| 签名 | 说明 |
|---|---|
| `void print(...)` | 依次输出参数；字符串、数值、内容、设备等都可输出。 |
| `void printchar(...)` | Mindustry 的 `printchar` 指令封装。 |
| `void format(...)` | Mindustry 的 `format` 指令封装；具体格式以目标版本为准。 |
| `void printflush(device target)` | 把输出缓冲发送到消息板/显示器。 |
| `void draw(string_t action, ...)` | `action` 必须是字符串字面量；如 `"clear"`、`"rect"`、`"line"` 等。 |
| `void drawflush(device target)` | 刷新绘图缓冲。 |
| `device getlink(int id)` | 取第 `id` 个链接建筑。 |
| `void control(string_t action, device target, ...)` | `action` 必须是字符串字面量；控制建筑。 |
| `device radar(string_t c1, string_t c2, string_t c3, string_t sort, device from, int order)` | 四个筛选/排序字符串必须是字面量。 |
| `null_t sensor(device source, content_t property)` | 读取属性；返回值可能是任意类型，按需转换。 |
| `content_t lookup(string_t category, int id)` | `category` 必须是字面量，如 `"item"`、`"liquid"`、`"unit"`、`"block"`。 |
| `void wait(float time)` | Mindustry 的等待。 |
| `void stop()` | 停止处理器。 |
| `void end()` | 结束当前执行轮。 |
| `void ubind(content_t unit)` | 绑定单位。 |
| `void ucontrol(string_t action, ...)` | `action` 必须是字符串字面量；输出参数按指针/原样转换传入。 |
| `device uradar(string_t c1, string_t c2, string_t c3, string_t sort, int reserved, int order)` | `reserved` 通常为 0。 |
| `int ulocate(string_t action, ...)` | `action` 必须是字面量；输出参数见 §2.1。 |

### 2.1 `ulocate` 的输出参数

`ulocate` 的 `x`、`y`、`found`、`building` 四个输出不能用普通返回值表示。它们要么是：

```c
int x, y;
bool found;
device building;
ulocate("building", "core", false, &x, &y, &found, &building);
```

要么使用“原样传递”的 volatile 转换（`device` 不支持指针）：

```c
volatile device out;
ulocate("building", "core", false, &x, &y, &found, (volatile device*)(&out));
```

具体参数顺序随 action 不同；以 Mindustry 的 `ulocate` 指令和 `include/merui.h` 的示例为准。

### 2.2 原始/低层内建

这些函数直接对应 mlog，类型检查较弱，通常只在实现底层功能时使用。

| 签名 | 说明 |
|---|---|
| `void set(...)` | 原始 `set` 指令。 |
| `void op(...)` | 原始 `op` 指令。 |
| `void jump(...)` | 原始 `jump` 指令。 |
| `bool stricteq(...)` | 严格相等比较。 |
| `null_t read(device source, null_t reference)` | 原始 `read`；优先使用数组/memsp。 |
| `void write(null_t value, device source, null_t reference)` | 原始 `write`。 |
| `null_t asm(string_t code)` / `asm("...")` | 原始指令字符串，支持 `${expr}` 替换；见 [asm.md](asm.md)。 |

---

## 3. 数学

这些数学函数由编译器降成 `op` 指令，不需要 include：

| 签名 | 说明 |
|---|---|
| `float sin(float x)` | 正弦。 |
| `float cos(float x)` | 余弦。 |
| `float tan(float x)` | 正切。 |
| `float asin(float x)` | 反正弦。 |
| `float acos(float x)` | 反余弦。 |
| `float atan(float x)` | 反正切。 |
| `float adiff(float a, float b)` | 角度差。 |
| `float min(float a, float b)` | 最小值。 |
| `float max(float a, float b)` | 最大值。 |
| `float ceil(long x)` | 向上取整。 |
| `float floor(long x)` | 向下取整。 |
| `float sqrt(float x)` | 平方根。 |
| `float pow(float a, float b)` | 幂。 |
| `float abs(float x)` | 绝对值。 |
| `float rand(float x)` | 随机数（Mindustry `rand`）。 |

`include/math.h` 还提供一个普通函数：

| 签名 | 说明 |
|---|---|
| `double distance(double x1, double y1, double x2, double y2)` | 两点距离，内部用 `sqrt(pow(...))`。 |

Mindustry 的 `float`/`double` 都是单个逻辑值；没有完整的 `libm`，也没有 `printf` 浮点格式化。

---

## 4. 内存、数组和伪列表

### 4.1 数组相关内建

这些是编译器特殊形式/内建，不是普通库函数；详细语义见语言文档。

| 形式 | 说明 |
|---|---|
| `int lenof(array)` | 元素数；对指针使用会报错。 |
| `int widthof(type_or_expr)` | 占用的寄存器数。 |
| `sizeof(type_or_expr)` | 占用的内存单元数（运算符）。 |
| `void vecalias(int *dst, int src[])` | 把句柄单元绑定到数组；`dst` 要写成 `&a`。 |
| `void veccpy(int dst[N], int src[M])` | 逐元素复制，复制 `min(N,M)` 个元素。 |
| `array("layout", {...})` | 数组初始化时的布局请求，见语言文档 §7.2。 |
| `byname(&x)` | 请求名字指针，见语言文档 §8。 |
| `remote(processor, name)` | 绑定另一个处理器上的变量/数组/指针，见语言文档 §9。 |

### 4.2 `memcpy` 与 `memsp`

| 签名 | 说明 |
|---|---|
| `void memcpy(void *dst, void *src, unsigned size)` | 复制 `size` 个内存单元（内建）。 |
| `void *memsp(device cell, int location)` | 取得某个 memory cell/bank 中 `location` 处的指针。 |

`memsp` 适合直接操作链接的内存块；普通数组优先使用数组语法。`auto device` 的 cell 名字在 `memsp` 中可以被优化成启动时记录 link id。

### 4.3 `pdlist_t`：本地伪列表

`include/mindc_min.h` 声明，运行时用寄存器实现，不占 memory block，访问复杂度 O(log n)。适合“没有内存但需要动态设备/内容访问”的场景。

| 签名 | 说明 |
|---|---|
| `pdlist_t pdcreate(int size)` | 创建伪列表；`size` 必须是整数常量（当前实现）。 |
| `null_t pdread(pdlist_t list, int pos)` | 读取。 |
| `void pdwrite(pdlist_t list, int pos, null_t data)` | 写入。 |

示例见 [PSEUDO_LIST.md](PSEUDO_LIST.md)。

### 4.4 `sdlist_t`：跨处理器共享伪列表

需要：

```c
#include "sharelist.js"
```

| 签名 | 说明 |
|---|---|
| `sdlist_t sdcreate(int id, int size)` | 创建共享列表；`id`、`size` 必须是整数常量。 |
| `null_t sdread(device at, sdlist_t list, int pos)` | 从 `at` 处理器读取。 |
| `void sdwrite(device at, sdlist_t list, int pos, null_t data)` | 写入 `at` 处理器。 |

`sdlist` 把读/写 helper 的入口、长度等信息打包进一个句柄；`at` 决定实际访问哪台处理器。示例见 `testers/unit_tests/exttests/ex3.c`、`ex4.c`。

---

## 5. 头文件

### 5.1 `mindc.h`

```c
#include "mindc.h"
```

提供：

- 常用内容常量：`copper`、`lead`、`water`、`duo`、`dagger` 等；
- 在编译器模式下映射到 `@copper`、`@water` 等；
- 在“给 linter 看”的模式下使用普通 C 的 `typedef` 和数字 id；
- 包含 `time.h` 和 `mindc_min.h`。

完整内容列表以 `include/mindc.h` 为准；这里不重复几百个 id。`#pragma id` 可以覆盖内容 id。

### 5.2 `mindc_min.h`

只提供类型、内建函数原型和 `pdlist_t`/`sdlist_t` 等声明，适合只想拿声明、不想要内容常量的场景。它在非 `__MINDUSTRY__` 模式下会包含 `<stdbool.h>`，并定义 `auto` 为空宏，方便 linter。

### 5.3 `math.h`

```c
#include "math.h"
```

| 签名 | 说明 |
|---|---|
| `double distance(double x1, double y1, double x2, double y2)` | 两点距离。 |

### 5.4 `memory.h`

```c
#include "memory.h"
```

| 签名 | 说明 |
|---|---|
| `void memset(void *target, null_t data, unsigned size)` | 把 `size` 个单元写成 `data`。 |
| `void memset_near(near void *target, null_t data, unsigned size)` | 同上，但目标按 `near` 指针处理。 |

`memcpy` 是编译器内建；`memory.h` 不重复声明它。`memory.h` 在 linter 模式下会包含 `<string.h>`，但真正的 Mindustry-C 编译不提供 C 字符串库。

### 5.5 `remote.h`

```c
#include "remote.h"
```

这是 Peterson/Filter 互斥算法的库，不是 `remote` 类型本身（`remote` 是语言特性）。

宏：

| 宏 | 说明 |
|---|---|
| `begin_atomic` | 空宏，标记临界区开始。 |
| `end_atomic` | `wait(0);`，让出本轮执行。 |

函数：

| 签名 | 说明 |
|---|---|
| `void rpeinit(int me, remote bool flag[2], remote int *turn)` | 两进程 Peterson 初始化。 |
| `void rpelock(int me, remote bool flag[2], remote int *turn)` | 两进程加锁。 |
| `void rpeunlock(int me, remote bool flag[2])` | 两进程解锁。 |
| `void rpeminit(int me, int total, remote int level[], remote int turn[])` | N 进程 Filter 初始化。 |
| `void rpemlock(int me, int total, remote int level[], remote int turn[])` | N 进程加锁。 |
| `void rpemunlock(int me, int total, remote int level[])` | N 进程解锁。 |

这些函数要求对端处理器声明对应的 `extern` 变量，并用 `remote` 绑定；`me` 是当前进程编号，`total` 是进程数。

### 5.6 `time.h`

```c
#include "time.h"
```

| 签名 | 说明 |
|---|---|
| `long time()` | `floor(@time / 1000)`，即 Mindustry 时间（毫秒）的秒数。 |
| `void printTime(long second)` | 把秒数打印成 `MM:SS` 形式；要求非负。 |

这是自定义的简化版，不是完整的 C `time.h`。

### 5.7 `mcolor.h`

```c
#include "mcolor.h"
```

| 类型/签名 | 说明 |
|---|---|
| `struct colorinfo_t { float r, g, b, alpha; }` | RGBA 分量。 |
| `typedef double color_t` | 打包颜色。 |
| `colorinfo_t rgba(float r, float g, float b, float a)` | 构造 `colorinfo_t`。 |
| `color_t packcolorw(float r, float g, float b, float a)` | 用 `asm("packcolor ...")` 打包。 |
| `color_t packcolor(colorinfo_t c)` | 打包结构体。 |
| `colorinfo_t unpackcolor(color_t c)` | 用 `asm("unpackcolor ...")` 解包。 |

`unpackcolor` 依赖目标 Mindustry 版本的 `unpackcolor` 指令。

### 5.8 `button.h`

```c
#include "button.h"
```

| 类型/签名 | 说明 |
|---|---|
| `struct button { device buttonDevice; bool buttonReset; }` | 按钮设备 + 是否自动复位。 |
| `typedef struct button button_t` | 别名。 |
| `button_t createButton(const device d, const bool reset)` | 构造。 |
| `bool hasPressedDev(device d, const bool reset)` | 读取 `@enabled`；`reset` 为真时用 `control("enabled", d, false)` 复位。 |

**已知问题：** `button.h` 里的 `hasPressed(button)` 当前多了一个右括号，可能无法编译；在修复前请直接调用 `hasPressedDev(button.buttonDevice, button.buttonReset)`。

### 5.9 `merui.h` 与 `merui_simp.h`

```c
#include "merui.h"
#include "merui_simp.h"   // 可选：sync/async 别名
```

`merui.h` 把常用的“绑定单位、移动、采矿、取放物品”组合成返回 `mOpRet_t` 的函数：

| 类型/签名 | 说明 |
|---|---|
| `struct mOpRet_t { bool success; int operation_id; int err_code; }` | 操作结果。 |
| `device get_core(bool combat)` | 循环寻找核心/敌方核心；直到找到才返回。 |
| `device get_player()` | 用 `radar` 找玩家。 |
| `mOpRet_t unit_bind(content_t type, bool rebind)` | 绑定单位；`rebind` 为假时先检查当前绑定。 |
| `mOpRet_t go_to(float x, float y, float radius)` | 移动到目标；`within` 成功返回，否则 `pathfind`。 |
| `mOpRet_t take_item(device source, content_t object, int amount)` | 走到来源并取物品。 |
| `mOpRet_t drop_item(device target, content_t object, int amount)` | 走到目标并放物品。 |
| `mOpRet_t mining(content_t category)` | 找矿并开采。 |

常量：

```c
OP_BIND OP_GOTO OP_TAKE OP_DROP OP_MINE
ERR_IN_PROGRESS ERR_OK ERR_MINE_NOT_FOUND
```

宏：

| 宏 | 说明 |
|---|---|
| `wait_for_succ(op)` | 反复执行 `op`，直到 `success`。 |
| `exit_or_succ_with(op, code)` | 失败时 `return code;`。 |
| `exit_or_succ_as(op)` | 失败时返回 `mOpRet_t`。 |
| `exit_or_succ(op)` | 失败时 `return;`。 |
| `sync(x)` | `wait_for_succ(x)` 的别名（`merui_simp.h`）。 |
| `async(x)` | `exit_or_succ_with(x)` 的别名（`merui_simp.h`）。 |

`get_core` 是死循环直到找到目标；不要在无法找到核心的地图里直接调用。

### 5.10 `error.h`

```c
#include "error.h"
```

| 名称 | 说明 |
|---|---|
| `extern int _errId` | 错误号，默认 0。 |
| `extern string_t _errInfo` | 错误信息字符串。 |
| `void perror()` | 当 `_errId` 非 0 时打印 `<ERROR>: (id): info`。 |
| `errno` | `_errId` 的宏别名。 |

它不是线程安全的，也不是完整的 C `errno`。

### 5.11 `archon.h` / `archon.js`

世界/规则/天气/状态/特效等扩展，需要：

```c
#include "archon.h"     // 等价于 #include "archon.js"
```

| 签名 | 说明 |
|---|---|
| `content_t argetblock(string_t layer, int x, int y)` | 取方块；`layer` 是字符串字面量。 |
| `void arsetblock(string_t layer, content_t block, int x, int y, content_t team, float rotation)` | 放方块。 |
| `device arspawn(content_t unit, int x, int y, float rotation, content_t team)` | 生成单位。 |
| `void arstatus(string_t type, ...)` | `type` 为 `"apply"` 或 `"clear"`，后接状态参数。 |
| `bool arweathersense(content_t weather)` | 读取天气。 |
| `void arweatherset(content_t weather, bool active)` | 设置天气。 |
| `void arspawnwave(int x, int y, bool natural)` | 生成波次。 |
| `void arsetrule(string_t name, ...)` | 设置规则；`name` 为字面量。 |
| `void armessage(string_t type, ...)` | `type` 如 `"notify"`、`"mission"`。 |
| `void arcutscene(string_t type, ...)` | 过场/镜头。 |
| `void areffect(string_t effect, ...)` | 特效；参数以 `archon.js` 为准。 |
| `void arexplosion(content_t team, int x, int y, float radius, float damage, bool air, bool ground, bool pierce, bool effect)` | 爆炸。 |
| `null_t arfetch(string_t type, content_t team, null_t id, content_t category)` | 取实体/数据。 |
| `void arsetprop(content_t prop, device target, null_t value)` | 设置属性。 |
| `bool argetflag(string_t name)` | 读全局 flag。 |
| `void arsetflag(string_t name, bool value)` | 写全局 flag。 |
| `void arplaysound(string_t type, ...)` | `"global"` 或 `"positional"`。 |
| `void armakemarker(string_t type, int id, int x, int y, bool replace)` | 创建 marker。 |
| `void arsetmarker(string_t type, ...)` | 修改 marker。 |

这些函数的字符串参数、变参个数和顺序由 `include/archon.js` 的处理器决定；本文只列稳定签名。目标 Mindustry 版本必须支持对应指令。

### 5.12 `sharelist.js`

```c
#include "sharelist.js"
```

提供 `sdlist_t` / `sdcreate` / `sdread` / `sdwrite`，详见 §4.4。

### 5.13 `test.h`

```c
#include "test.h"
```

只有一个测试辅助函数：

| 签名 | 说明 |
|---|---|
| `int add(int x, int y)` | 返回 `x + y`；用于编译/调用测试，不是正式标准库。 |

### 5.14 `string.h`

```c
#include <string.h>
```

| 签名 | 说明 |
|---|---|
| `struct string_view { null_t source; int base; int length; }` | 只读、带长度的字符视图。 |
| `string_view sv_of_string(string_t s)` | 视图覆盖一个原生字符串；长度来自 `sensor s @size`。 |
| `string_view sv_of_message(device m)` | 视图覆盖 message 建筑；长度来自 `sensor m @bufferSize`（不是 `@size`）。 |
| `char sv_at(string_view v, int i)` | 读取第 `i` 个字符。 |
| `int sv_len(string_view v)` | 视图长度。 |
| `void sv_print(string_view v)` | 逐字符输出；需要 v150+。 |
| `int strlen(const char* s)` | C 字符串长度（数到 NUL）。 |
| `void strcpy(char* dst, const char* src)` | 复制到 `char` 缓冲区。 |
| `void strcat(char* dst, const char* src)` | 追加到 `char` 缓冲区；调用者负责容量。 |
| `int strcmp(const char* a, const char* b)` | 逐字符比较。 |
| `string_view concat_to_message(device msg, string_t a, string_t b)` | 把 `a`、`b` 写入 message 并 flush，返回 message 的活视图；需要 v150+。 |
| `void concat_print(device msg, string_t a, string_t b)` | v150 以下的纯输出拼接；不返回视图。 |

`string_view` 是只读视图：没有指针算术、不能写入；message 被覆盖后旧视图内容会改变。需要稳定副本时复制到 `char[]` 缓冲区。`string_t` 与 `char*` 不隐式互转；`char*` 只指向真正的字符数组。

### 5.15 `stdio.h`

```c
#include <stdio.h>
```

兼容头；`printf` 是**编译器内建**：

- 格式串必须是字面量；
- 支持 `%d` / `%i` / `%u` / `%f` / `%s` / `%%`；
- 编译期拆成一条 `print`（带 `{n}` 占位符）加若干 `format`；
- `scanf`、`FILE` 等不提供。

### 5.16 `assert.h`

```c
#include <assert.h>
```

兼容头；`assert(expr)` 是内建：条件为假时打印 `assertion failed at line N` 并 `stop()`。`NDEBUG` 目前不会移除断言。

### 5.17 `stdbool.h`

```c
#include <stdbool.h>
```

兼容头；`bool` / `true` / `false` 本身是编译器关键字。

---

## 6. 与 C 标准库的关系

**直接提供/近似的 C 函数：**

- `memcpy`（内建）；
- `sin`、`cos`、`tan`、`asin`、`acos`、`atan`、`ceil`、`floor`、`sqrt`、`pow`、`abs`（内建）；
- `memset`、`memset_near`（`memory.h`，自定义实现）；
- `strlen`、`strcpy`、`strcat`、`strcmp`（`string.h`，按 `char*` 实现，不是 `string_t`）；
- `printf`（内建；格式串必须是字面量，支持 `%d/%i/%u/%f/%s/%%`）；
- `assert`（内建；失败时打印并 `stop()`）；
- `time()`（`time.h`，基于 `@time`）；
- `errno`（`error.h`，实际是 `_errId` 宏）。

**不提供：**

- `scanf`、`puts`、`getchar`；
- `malloc`、`calloc`、`realloc`、`free`；
- `FILE`、`fopen`、文件/目录/网络 API；
- `qsort`、`bsearch`、`atexit`、`exit`；
- `setjmp`/`longjmp`、信号、线程。

字符串值直接交给 `print()`/`printchar()`/`format()` 或内置函数；`string_t` 不是 `char*`。需要 C 字符缓冲区时使用 `char[]`/`char*`，需要只读字符串视图时使用 `include/string.h` 的 `string_view`。

---

## 7. 已知限制和注意事项

- `draw`/`control`/`ucontrol`/`radar`/`uradar`/`lookup`/`ulocate` 的 action/条件/类别字符串必须是**字面量**，不能是运行时拼接的字符串。
- `ulocate` 的输出参数必须是指针或 `(volatile type*)(object)`；`device` 不支持普通指针。
- `#pragma id` 会覆盖内容 id，并关闭基于内置 lookup 表的数组选择；跨处理器时两边要使用一致的布局/id。
- `remote`/`sdlist` 需要真实存在的对端处理器和稳定的 `extern` 变量。
- `pdcreate`/`sdcreate` 的 size/id 当前要求整数常量。
- `button.h` 的 `hasPressed` 有语法错误；用 `hasPressedDev`。
- `archon.h`/`archon.js` 生成的指令依赖目标 Mindustry 版本；不同版本支持的动作/参数可能不同。
- `format`、`unpackcolor` 等较新的指令需要相应版本；`format` 和字符级的字符串操作要求 v150+，默认目标版本是 `154.3`。
- 没有动态内存分配；数组大小、结构体布局和句柄表示在编译期确定。
- `printf` 的格式串必须是字面量；`%d/%i/%u/%f/%s/%%` 已支持，字段宽度/精度暂未应用。
- `assert` 失败时会打印并入 `stop()`；`NDEBUG` 暂未接入。

语言层的差异（`goto`、VLA、`char`/`string_t` 的拆分、`remote`、`byname`、`auto`、数组布局、`#pragma` 等）见 [DIFFERENCES_FROM_C99.md](DIFFERENCES_FROM_C99.md)。
