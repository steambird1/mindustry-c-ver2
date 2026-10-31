# Mindustry-C 与 C99 的差异

本文只记录**语言、类型系统、内存模型、预处理器和编译器扩展**。标准库函数、`include/*.h` 里的函数以及 Mindustry 指令包装见另一篇：

- [STANDARD_LIBRARY.md](STANDARD_LIBRARY.md)

Mindustry-C 的目标是“写起来像 C，编译到 Mindustry 逻辑指令”。它不是宿主机上的 C 编译器：没有操作系统、文件、进程、标准输入输出和动态内存分配，程序运行在逻辑处理器里，值放在寄存器或链接的内存块中。

---

## 1. 程序模型

- 入口是 `void main()`。`main` 的返回类型会被忽略，通常写 `void`。
- 程序编译成一条 Mindustry 逻辑指令流，处理器会反复执行；`stop()` 停机，`end()` 结束当前这一轮。需要保持状态时通常写成 `while (true) { ... }`。
- 没有 `argc` / `argv`，没有进程退出码，没有文件、网络或线程。
- `print()` 只是写入处理器的输出缓冲；真正发送到消息板/显示器通常还要 `printflush(device)`。
- 目标版本由编译器配置决定，默认是 `154.3`。名称指针、encoded 数组等特性需要 v150 或更高；见 §7、§8。

一个最小程序：

```c
auto device message1;

void main() {
    print("hello");
    printflush(message1);
    stop();
}
```

`auto device message1;` 不是 C 的 `auto`，见 §6.1。

---

## 2. 不支持或语义不同的 C99 特性

| C99 特性 | 当前状态 |
|---|---|
| `goto` / 标签 | **不支持**。词法分析能识别 `goto`，但语法分析会拒绝。需要提前退出时用 `break`、`continue`、`return` 或重构控制流。 |
| 变长数组（VLA） | **不支持**。数组维度必须是编译期常量；`int a[n];` 会报 “Variable length arrays are not supported”。 |
| C 字符串 / `char *` | 字符串字面量是 `string_t`（Mindustry 原生字符串值），不是 `char *`。`const char* p = "hi";` 可以指向只读字符数组；`char* p = "hi";` 会被拒绝；需要可写副本时写 `char a[] = "hi";`。 |
| 用户自定义可变参数函数 | **不支持**。`print`、`draw` 等内置函数和扩展可以变参；普通函数参数表必须固定。 |
| `printf` / `scanf` / `FILE` / `malloc` / `free` / `str*` 等 | `printf` 是编译器内建（格式串必须是字面量；支持 `%d/%i/%u/%f/%s/%%`）；`assert` 也是内建；`scanf`、`FILE`、动态分配不提供；`strlen`/`strcpy`/`strcat`/`strcmp` 由 `include/string.h` 按 `char*` 提供。见 [STANDARD_LIBRARY.md](STANDARD_LIBRARY.md)。 |
| `setjmp` / `longjmp`、信号、线程、文件 | 不提供。 |
| 联合体（`union`） | 语法上可以解析，但当前代码生成**不保证** C 的成员重叠语义；不要依赖 `u.a` 写入后从 `u.b` 读出同一个值。 |
| 位域（bit-field） | 语法上可以解析，但位宽当前**未用于打包**；每个成员实际仍按普通单元处理，`a : 3` 不会自动掩码到 3 位。 |
| `char` 作为小整数 | **已支持**：`char c = 'A';` 和 `char c = 65;` 都得到 65，`char` 通常参与数值运算。没有 8 位宽度、回绕或有符号性；所有标量都是 1 个 cell。 |
| `auto` 类型推断 | 不支持 `auto x = ...;`。`auto` 是限定符/存储类，只用于 `auto device`、`auto` 参数/结构体成员等，见 §6。 |
| C 的独立编译/链接 | 没有。整个程序是一个翻译单元；`extern` 不是 C 的外部链接，见 §5。 |
| 空初始化列表等边界形式 | 行为以当前编译器为准；数组初始化建议显式写出长度或初值。 |

`int a[] = {1, 2, 3};` 现在可以从初始化列表推导最后一维；不带初始化列表的 `int a[];` 不是数组，而是“以后绑定到某个数组”的一字句柄，见 §7.3。

`enum`（含匿名/typedef）和 `typedef struct { ... } Name;` 现在受支持；`union`/位域仍只有语法解析，语义见上表。

---

## 3. 内建类型

### 3.1 基本类型

`int`、`char`、`float`、`double`、`long`、`short`、`signed`、`unsigned`、`bool`、`void` 都可以作为类型名。所有**基本标量**在 Mindustry 里都占 1 个单元/寄存器；不要按宿主机的 32/64 位去理解它们。`char` 是普通的 1-cell 数值/字符类型；原生 Mindustry 字符串是独立的 `string_t`。

```c
int a = 1;
char c = 'A';       // 65
string_t s = "hi";  // 1-cell Mindustry string
float b = 2.5;
double d = 3.5;
bool ok = true;
```

### 3.2 Mindustry 专用类型

| 类型 | 宽度/存储 | 说明 |
|---|---|---|
| `device` | 1 个寄存器 | 建筑/单位句柄。通常用 `auto device` 在启动时按链接名绑定。 |
| `content_t` | 1 个寄存器 | 内容（物品、液体、单位、方块）的句柄。 |
| `item_t`、`liquid_t`、`unit_t`、`block_t` | 1 个寄存器 | 更具体的内容类型；可转换到 `content_t`。 |
| `null_t` | 1 个寄存器 | 可容纳任意值，`null` 的类型；`sensor()` 返回它。 |
| `string_t` | 1 个寄存器 | 原生 Mindustry 字符串值；字符串字面量是 `string_t`。支持 `@size`、`s[i]`、`print`（索引/长度需要 v150+）。 |
| `char` | 1 个寄存器 | 普通字符/数值；`'A'` 是 65。`char[]` 是 C 数值数组，`char*` 是普通指针。 |
| 指针 | 2 个寄存器 | 普通内存指针：`block` + `position`。`char*` 与 `int*` 表示相同。 |
| `*byname` 指针 | 1 个寄存器 | 名字指针，指向寄存器/变量名，见 §8。 |
| 数组句柄 | 1 个寄存器 | 无地址数组、remote 数组、embedded 数组等的打包句柄，见 §7。 |
| 数组（内存布局） | 2 个寄存器 | 块号 + 偏移；元素本身在内存里。 |

`device` 和 `content_t` 是句柄类型。当前版本不建议把它们放进数组或结构体成员；某些位置会被静默转成布尔值。`item_t` 等更具体的内容类型限制稍少，但也建议先看测试/类型检查结果。

### 3.3 `sizeof`、`widthof`、`lenof`

这三个概念回答不同的问题：

| 表达式 | 回答 |
|---|---|
| `sizeof(x)` | 占多少**内存单元**。普通标量 1；内存数组是元素数 × 每元素单元数；句柄是 0（它本身没有元素存储）。 |
| `widthof(x)` | 值占多少**寄存器**。普通标量 1；普通指针 2；`*byname` 1；句柄 1；内存数组 2；开放句柄 1。 |
| `lenof(array)` | 数组元素数。多维数组先给行数，`lenof(grid[0])` 给一行的长度；对指针使用 `lenof` 会报错。 |

```c
int mem[4];
int open[];
print(sizeof(mem));   // 4 个内存单元
print(widthof(mem));  // 2（block + position）
print(widthof(open)); // 1（句柄）
print(lenof(mem));    // 4
```

`sizeof`/`widthof` 是编译期量；`lenof` 对开放句柄可能在运行时从打包句柄里取长度。

`sizeof("hi")` 是 3（C 字符数组，含 NUL），`sizeof(char)` 是 1，`sizeof(string_t)` 是 1（原生字符串值）。`char*`/`const char*` 的 `widthof` 是 2。

---

## 4. 存储类与限定符

除了 C 的 `const`、`volatile`、`static`、`extern`、`register`，Mindustry-C 还使用：

| 限定符 | 作用 |
|---|---|
| `const` | 常量/只读；要求初始化（`auto device` 例外）。const 数组可能被编码成寄存器表/字符串表。 |
| `volatile` | 强制变量放在内存中，不参与常量传播。`(volatile T)(expr)` 还是“原样传递”的转换语法，常用于 `ulocate` 的输出参数。 |
| `static` | **本次运行内持久**：跨函数调用共享，但每次程序从头执行时重置；不提供 C 的独立编译/链接模型。 |
| `persistent` | **跨运行持久**（Mindustry-C 扩展）：处理器/程序加载后只初始化一次，跨多次运行保留。 |
| `extern` | 文件作用域的处理器变量，其他处理器可以用 `remote` 按名字访问；不是 C 的外部符号链接。 |
| `register` | 请求放在寄存器中；结构体/数组也可以 `register`（会使用 embedded 布局）。 |
| `near` | 存储限定符：要求分配在“近”内存/同一内存块附近，避免跨块。它不改变值的宽度。 |
| `remote` | 变量/数组/指针位于**另一个处理器**，见 §9。位置很重要：`remote int *p` 与 `int *remote p` 含义不同。 |
| `byname` | 指针用“名字”表示，1 个寄存器，见 §8。 |
| `auto` | 不是类型推断；用于 `auto device`、`auto` 参数/结构体成员，见 §6。 |

`inline` 是 C99 关键字；它可以让函数内联。`#pragma noinline` 可以阻止自动内联，`inline` 关键字的优先级更高。

---

## 5. `extern`、`static`、`persistent` 和内存

- `extern int c = 10;` / `extern int c;` 在文件作用域声明一个“处理器变量”。同一程序里的其他代码可以按名字访问它，其他处理器可以通过 `remote(processor, c)` 访问它。
- 如果 `extern` 声明带有显式初始化器，初始化仍然在本侧执行，并且按普通文件的“每次运行重置”规则在每次运行开始时重新赋值；不带初始化器的 `extern` 由它的所有者维护，不在本侧重置。
- `extern` 变量会被保留下来，不因为“本程序没读”而被删除；它对跨处理器通信很重要。
- `static` 是**本次运行内持久**：同一运行里的多次函数调用共享一个对象；程序从头开始下一次运行时，初始化 tag 重置，带初始化器的 static 会重新初始化，未初始化的 static 会被显式置零（指针除外）。
- `persistent` 是**跨运行持久**：处理器/程序加载后初始化一次，后续运行继续使用同一个对象；它和 `static` 一样不能被内联复制。
- 文件作用域的**普通变量默认按运行重置**：有初始化器时每次运行执行初始化，没有初始化器时显式置零（指针除外）。需要跨运行状态时写 `persistent`，不要依赖未初始化全局变量的“碰巧保留”。
- **指针不置零**：未初始化的 `static`/`persistent` 变量会被置零，但指针（以及含指针的成员/数组）是例外。Mindustry 没有“运行时崩溃”这回事，也较难定义无歧义、零成本的绝对 0 地址；把 0 写进指针（尤其是 `block`/`pos` 两个字）并不是有意义的初始化。因此 `static`/`persistent` 指针必须在读取前显式赋值，不要依赖默认值。
- 结构体的置零/初始化会递归到嵌套结构体：非指针成员（含数组里的非指针元素）正常置零或按初始化列表赋值，只有指针成员被跳过。
- 含 `static`/`persistent` 局部变量的函数不会被内联；否则每个调用点会得到自己的副本，破坏“同一个 static 对象”的语义。`inline` 关键字也不能覆盖这个硬性限制。
- 普通局部变量优先放在寄存器；以下情况会落到内存：
  - `volatile`、`extern`；
  - 取地址后需要真实地址的普通指针；
  - 递归函数里的符号；
  - 嵌入数组/结构体的结构体；
  - 显式请求 `array("traditional", ...)` 的数组；
  - `near` 要求同块分配的对象。
- `static`/`persistent` 本身只决定生命周期；它们是否在寄存器或内存仍由类型、`volatile`、取地址、数组布局等决定。
- 内存来自链接到处理器的 memory cell/bank。没有链接内存块时，某些程序会直接报错（尤其是递归、显式内存数组、`volatile` 等）。

### 5.1 存储期速查

| 位置 | 生命周期 | 初始化 |
|---|---|---|
| 普通局部变量 | 一次函数调用 | 每次调用 |
| `static` 局部/全局 | 本次运行 | 第一次使用/运行开始；未初始化时置零（指针除外） |
| `persistent` 局部/全局 | 处理器/程序生命周期 | 加载后第一次使用；未初始化时置零（指针除外） |
| 文件作用域普通变量 | 本次运行 | 每次运行重新初始化或置零 |
| `extern` / `remote` | 由所有者/另一端决定 | 不在本程序重置 |

---

## 6. `auto`：设备、参数模板和结构体模板

### 6.1 `auto device`

```c
auto device message1;
auto device cell2;
```

这是**按链接名绑定设备**的声明，通常放在文件作用域。编译器会在启动时扫描链接的建筑（`getlink`/链接扫描），把名字解析成 `device` 句柄。`auto device` 不是 C 的 `auto` 存储类，也不是类型推断。

也可以用 `getlink(index)` 在运行时取设备。

### 6.2 `auto` 参数：按表示生成版本

`auto` 参数表示“这个参数可能有不同的底层表示”，编译器会为每种实际调用生成一个版本：

```c
#pragma overload(auto)
void fill(auto int s[4]) { s[0] = 1; }

int mem[4];                       // 内存数组：传 block/position
int reg[4] = array("embedded_divided", {0,0,0,0}); // 寄存器数组：传句柄
```

- 数组可以以内存指针、寄存器数组句柄、remote 数组句柄等形式传递；
- 指针可以以普通地址或 `byname` 名字指针传递；
- 结构体可以以内存地址或成员名字包传递；
- 普通标量没有“多种表示”，`auto int x` 等价于 `int x`，但仍然可以参与重载。

`auto` 版本只在需要时生成。`#pragma noinline` 常用于观察生成的多个版本；不加时函数可能被内联，版本就看不到了。

### 6.3 `auto` 结构体成员：结构体模板

```c
struct tmpl {
    auto int *p;   // 每个实例决定：名字指针还是普通地址
    int n;
};
```

`auto` 成员让结构体成为一个“模式”。每个实例根据实际赋值/使用，决定该成员存名字还是存内存地址；不同实例可以成为不同表示的类型。只有平坦结构体（没有嵌入数组/结构体）适合这种用法。

### 6.4 函数重载

同一名字可以声明多个函数，按参数个数和类型选择；这是 `#pragma overload(default)` 的默认行为。`#pragma overload(auto)` 额外启用 `auto` 参数/模板结构体的按表示特化；`#pragma overload(none)` 禁止重载和 `auto` 参数。

函数指针指向 `auto` 函数时，指针类型必须是具体版本；间接调用选中那个版本。

---

## 7. 数组

### 7.1 定长数组

```c
int a[4];
int b[2][3];
int c[4] = {1, 2, 3, 4};
int d[] = {1, 2, 3};       // 从初始化列表推导最后一维
```

- 维度必须是编译期常量；VLA 不支持。
- 多维数组是“数组的数组”；`lenof(c)` 给第一维，`lenof(c[0])` 给第二维。
- 内存数组的元素在链接的内存块里；如果编译器选择寄存器布局，元素会变成寄存器/选择链/编码表。

### 7.2 数组布局请求

```c
int mem[4] = array("traditional", {1, 2, 3, 4});
int reg[4] = array("embedded_divided", {1, 2, 3, 4});
int enc[4] = array("encoded", {1, 2, 3, 4});
```

`embedded_lookup_item`、`embedded_lookup_liquid`、`embedded_lookup_unit`、`embedded_lookup_block` 以及不带类别的 `embedded_lookup` 使用内容名/内容表；初始化内容应是内容句柄（如 `@copper`）而不是任意整数。

当前支持的布局名：

| 名称 | 说明 |
|---|---|
| `traditional` | 元素放在内存单元里（需要链接内存）。 |
| `embedded` | 寄存器布局；具体用 divided 还是 lookup 由编译器选。 |
| `embedded_divided` | 每个元素一个寄存器，读取用选择链；适合小数组。 |
| `embedded_lookup` | 用 `lookup` + `sensor` 的表；需要 v150 和内容表。 |
| `embedded_lookup_item` / `_liquid` / `_unit` / `_block` | 显式指定 lookup 表类别，跨处理器时尤其有用。 |
| `encoded` | 整个常量数组编码成 base-57 字符串表；只适合常量、不可写。 |

`array("...")` 必须给字符串字面量；`encoded` 必须同时给内容列表。具体布局也可能因为“内存不够/指令预算”回退或换用别的实现；`#pragma optimize(array)` 打开自动布局选择，显式 `array()` 请求优先。

### 7.3 开放数组与句柄

```c
int mem[4] = {1, 2, 3, 4};
int a[];          // 一个“句柄单元”，不是数组
a = mem;          // 绑定；之后 a[2] 访问 mem[2]
```

- 不带长度的 `int a[];` 是一个 1 寄存器单元，保存数组句柄（get/set 入口、长度、元素大小）。
- 使用前必须绑定；未绑定使用是编译错误。
- 可以重新绑定；`a = b;` 把句柄复制过去（当两边都是句柄时），不是复制元素。
- **数组到数组的赋值**（两边都是真实数组存储）是逐元素复制，等价于 `veccpy`；不是 C 的“数组退化为指针”。
- `vecalias(&a, b)` 是 `a = b;` 的绑定形式；`veccpy(a, b)` 是显式逐元素复制。
- 句柄不能跨处理器直接传递（它打包的 helper 行号是本处理器的），`a = @this;` 会被拒绝。

### 7.4 数组参数

```c
void f(int s[5]);   // 定长；可以按内存指针/句柄传递
void g(int s[]);    // 开放长度；参数是句柄，lenof(s) 可用
void h(auto int s[4]); // 每个表示一个版本
```

- 定长数组参数如果调用方是寄存器数组，会传句柄；如果是内存数组，会传指针。
- 开放长度参数一定是句柄，因为它需要在运行时携带长度。
- `widthof(&s)` 对开放参数是 1（句柄单元的地址是名字指针），不是 2。

---

### 7.5 `string_t`、`char` 和字符串拼接

Mindustry 的字符串是**值**，不是 C 的字符数组；本实现把两者分开：

```c
string_t s = "hello";   // 1 个 cell 的原生字符串
char c = 'A';           // 65，普通字符/数值
char a[] = "hello";     // 6 个 cell：5 个字符 + NUL，可写
char* p = a;            // 和 int* 相同的普通指针
const char* q = "hi";   // 只读字符数组；字面量被物化一次
```

- `char` 是 1-cell 数值类型；`'A'` 是 65，`char c = 65` 可用。没有 8 位宽度/回绕/有符号性。
- `char[]` 是 C 数值数组；`char a[] = "hi"` 展开为 `{'h','i',0}`，所以长度为 3。
- `char*` 是真正的块+偏移指针，支持取地址、指针算术、`p[i]`、`*p` 和写入。
- 字符串字面量默认是 `string_t`；在 `const char*` 上下文中会物化为只读 `const char[]`，因此 `const char* p = "hi"`、函数参数和 `return "hi"` 都可用。
- `char* p = "hi"` 被拒绝：字面量只读；需要可写副本时写 `char a[] = "hi"`。`string_t` 和 `char*` 不隐式互转；从字符串值取字符用 `s[i]`，从字符串值复制到 char 缓冲区用 `string_view`/`to_chars`（见 `include/string.h`）。
- `sizeof("hi")` 是 3（字符数组），`sizeof(string_t)` 是 1；`widthof` 对应表示宽度。
- 字符串拼接没有 `+` 之外的隐式构造：`string_t + string_t` 只允许两个字面量在编译期合并。运行时拼接必须显式指定目的地：`char` 缓冲区（`strcpy`/`strcat`，全版本）或 message 建筑（`concat_to_message`）。
- `concat_to_message(msg, a, b)` 把字符逐字写入 message 建筑并 flush，返回 `string_view`。message 的长度来自 `sensor msg @bufferSize`，**不是** `@size`；message 文本没有 NUL，视图是只读、带长度的，而且再次覆盖 message 后旧视图内容会改变。需要稳定副本时复制到 char 缓冲区。
- 字符串索引 `s[i]`、`@size`、`@bufferSize`、从字符串/message `read`、`printchar`、`format` 和 `string_view` 的字符级操作都要求 **v150+**；低版本会编译期拒绝，或只提供 `concat_print` 这种纯输出拼接。
- 过渡期可用 `#pragma legacy_char_string`：词法层把 `char` 读作 `string_t`，旧代码不必立刻改成 `string_t`。这是模式切换，不是让 `char` 同时有两种含义。

---

## 8. 指针、地址和 `byname`

### 8.1 两种指针表示

| 形式 | 宽度 | 说明 |
|---|---|---|
| `int *p` | 2 | 普通内存指针：块 + 偏移。 |
| `int *byname p` | 1 | 名字指针：保存变量/成员的名字，访问时用 `write ... @this <name>`。 |
| `int (*p)[4]`（数组指针） | 2 | 指向内存数组的块/偏移。 |
| `int *remote p` | 特殊 | 指针本身存储在另一个处理器，见 §9。 |

`byname` 可以写在声明、参数、结构体成员上：

```c
int w = 3;
int *byname p = &w;
(*p) = 5;          // 写回 w，不需要把 w 放进内存
```

`byname(&x)` 是显式请求名字表示；`#pragma optimize(pointer)` 让普通的 `&x` 在满足条件时自动选择名字指针（v150+）。名字指针**不做指针算术**，它指向一个变量/成员，而不是一块可加减的地址。

### 8.2 `&` 的几种结果

| 表达式 | 结果 |
|---|---|
| `&scalar`，普通情况 | 2 字内存指针（把标量放进内存） |
| `&scalar`，开启 `byname`/`#pragma optimize(pointer)` 且变量可命名 | 1 字名字指针 |
| `&array`，内存数组 | 2 字块/偏移 |
| `&handle`，开放句柄/remote 数组/embedded 数组 | 1 字名字指针（指向句柄单元） |
| `&remoteVar` | 1 字名字指针（处理器 + 变量名） |

`widthof(&x)` 和 `widthof(x)` 都可用于观察这些差异。

### 8.3 `#pragma optimize(pointer)` 与 `struct_pointer`

- `#pragma optimize(pointer)`：允许编译器把可命名的 `&x` 变成 1 字名字指针；需要 v150+；对受影响的指针不要做算术。
- `#pragma optimize(struct_pointer)`：允许指向“寄存器结构体”的指针携带成员名字；可带一个大小阈值，例如 `#pragma optimize(struct_pointer, 4)`；需要 v150+，只适合平坦结构体（成员不能是嵌入数组/结构体）。
- `byname` 是显式请求，不依赖上面的 pragma。

---

## 9. `remote`：访问另一个处理器

### 9.1 远程变量

```c
auto device processor1;
auto device message1;
extern int c;                                // 对端处理器上的变量
remote int rc = remote(processor1, c);       // 本程序里的代理
```

- `remote(processor, name)` 是**绑定形式**，不是普通值；它把一个本地名字绑定到另一个处理器上的变量/数组/指针。
- 读 `rc` 会从对端取当前值；写 `rc` 会写回对端。
- `remote(@this, c)` 表示“当前处理器上的 c”，可用于自测/自引用。
- 对端变量应当是 `extern`/稳定的，避免被优化删除。

### 9.2 远程数组和指针

```c
extern int u[4] = array("embedded_divided");
remote int ru[] = remote(@this, u);          // 长度从对端数组推导
print(ru[2]);

remote int *p = remote(processor1, qq);      // 指针本身在对端
(*p) = 33;
```

- `remote int ru[]` 是一个 1 字句柄，元素访问走 `read`/`write`。
- `remote int *p` 声明“指针本身存储在别的处理器”；`remote int *p` 与 `int *remote p` 的含义不同：前者指针本地、指向远程 int；后者指针本身在远程。
- `&remoteVar` 得到 1 字名字指针（处理器 + 名字），不是普通 block/offset。
- 远程数组的布局要与对端一致；跨处理器时用显式 `array("embedded_divided")` 等布局名最稳。

### 9.3 限制

- 本地数组句柄不能直接送到另一个处理器（打包的 helper 行号是本地的），`a = @this;` 会被拒绝。
- 远程变量/数组/指针需要真实存在的对端变量和处理器；不是所有内存布局都能跨处理器。
- 远程访问比本地寄存器慢，适合共享状态/握手，不适合热循环里的每个元素。

---

## 10. 结构体、递归和栈

- 结构体默认可以放在寄存器里；`register struct` 强制寄存器。结构体一旦嵌入数组或需要取地址，通常会落到内存。
- `near struct`/`near array` 要求分配在同一/近内存块，避免跨块；`near` 不改变宽度。
- 递归函数会被特殊处理：函数内所有符号（含临时量）放进内存，栈在 memory block 里走；栈溢出默认会写错误并停止，可用 `#pragma stackcheck(fn)` 接管。
- 函数调用、数组句柄、结构体返回值都可能生成 helper；`auto` 参数/结构体模板就是为了让这些表示在编译期确定。
- 没有动态分配；数组/结构体的存储是编译期确定的。
- 复合字面量在现有头文件中写作 `(type)({ ... })`，例如 `(mOpRet_t)({true, OP_BIND})`；不要假定 C99 的 `(type){ ... }` 写法一定可用。

---

## 11. 预处理器和 include

支持常见的 C 预处理器子集：

- `#define` / `#undef`，对象宏和函数宏；
- `#if` / `#elif` / `#else` / `#endif` / `#ifdef` / `#ifndef`；
- `#include "..."` / `#include <...>`；
- `#pragma`（见 §12）。

`__MINDUSTRY__` 在编译器模式下预定义为 `1`，`mindc_min.h` 用它区分“真正的 Mindustry-C 编译”和“给 linter 看的普通 C 声明”。`__LINE__` 是当前行号，`__FILE__` 当前展开为 `<source>`。

兼容头：`include/stdbool.h`（`bool`/`true`/`false` 本身是关键字）、`include/stdio.h`（`printf` 是内建）、`include/assert.h`（`assert` 是内建；`NDEBUG` 暂未生效）。

### 11.1 `#include "*.js"` 是编译器扩展

```c
#include "archon.js"     // 注册 archon 的内建函数
#include "sharelist.js"  // 注册 sdlist_t / sdcreate / sdread / sdwrite
```

`.js` include 不是 C 头文件，而是加载一个 `CompilerExtensionBase`，向编译器注册新类型、函数和代码生成器。`archon.h` 只是 `#include "archon.js"` 的包装；标准库文档会列出这些扩展函数。

---

## 12. 编译器 pragma

| Pragma | 作用 |
|---|---|
| `#pragma comment(name, json)` | 设置一个解析器/编译器属性；例如 `#pragma comment(maxInstructions, 2000)`。不是 C 标准 pragma。 |
| `#pragma legacy_char_string` | 过渡入口：让词法层把 `char` 读作 `string_t`，兼容旧代码；不是长期双语义。 |
| `#pragma optimize(array)` | 打开数组自动布局选择；`array("...")` 仍然优先。 |
| `#pragma optimize(array, ...)` | 给自动布局传可选的 JSON 配置；一般优先用显式 `array("...")`。 |
| `#pragma optimize(pointer)` | 允许可命名的 `&x` 使用名字指针（v150+）；不要对受影响指针做算术。 |
| `#pragma optimize(struct_pointer[, n])` | 允许寄存器结构体的指针携带成员名字；可选大小阈值；v150+。 |
| `#pragma optimize(switch_table[, off/auto/on/N])` | 控制 switch 的 encoded 跳转表：`off` 禁用，`auto` 用启发式（默认），`on` 强制，`N` 强制并限制 case 值范围（当前上限 4096）。 |
| `#pragma overload(auto/default/none)` | `default` 允许函数重载；`auto` 显式请求 `auto` 参数/结构体特化；`none` 禁止。 |
| `#pragma noinline` / `#pragma noinline(fn1, fn2)` | 禁止自动内联（全部或指定函数）；`inline` 关键字优先。 |
| `#pragma stackcheck(fn)` | 栈帧无法增长时调用 `fn`。 |
| `#pragma stackcheck()` | 关闭栈容量检查（危险，可能覆盖内存）。 |
| `#pragma stackunderflow(fn)` | 栈回溯越过第一个 block 时调用 `fn`。 |
| `#pragma stackunderflow()` | 关闭栈下溢检查。 |
| `#pragma id(category, @name[:id])` | 覆盖内容 id；`category` 如 `item`/`liquid`/`unit`/`block`；`:null` 表示无 id。 |
| `#pragma var(type, @name)` | 声明一个处理器变量 `@name`，类型为 `type`，可像 `@this` 一样使用。 |

`#pragma id` 的任何覆盖都会让 `lookup` 表不再保证和目标内容一致，因此编译器会关闭基于 lookup 的数组选择；跨处理器时尤其要注意。

`#pragma optimize(switch_table)` 的默认启发式：至少 8 个 case、v150+、`range <= 256` 且 `range <= 2*cases+8`；更多细节见 `docs/OPEN_WORK.md` §7.13/§7.14。

---

## 13. `asm`

```c
asm("print ${x}");
```

`asm()` 是逃逸到原始 Mindustry 指令的入口：

- 用 `${expr}` 把 C 表达式替换成寄存器/字面量；
- `asm.md` 还定义了几个伪指令：`:varStorage`、`:varRead`、`:label`、`:copyObject`；
- `asm` 的结果/类型由调用方负责，编译器不会像普通表达式那样检查；
- 适合编译器还没覆盖的 mlog 指令，不适合日常逻辑。

详见 [asm.md](asm.md)。

---

## 14. Mindustry 标识符、内容常量和 `@` 名字

- `@copper`、`@water`、`@duo`、`@dagger` 等是 Mindustry 的内容句柄，类型是 `content_t`/`item_t`/`liquid_t`/`block_t`/`unit_t`。
- `@this`、`@unit`、`@counter`、`@time` 等是运行时内置名；`sensor(device, @property)` 用它们查询属性。
- `mindc.h` 为常见内容名提供了不带 `@` 的别名（`copper`、`water`、……），并在编译器模式下映射到 `@...`；完整列表见 `include/mindc.h`。
- `#pragma id` 可以改写某个内容的 id；`#pragma var` 可以新增 `@name` 处理器变量。
- 内置名不是普通 C 标识符；不要用 `#define`/变量去覆盖它们。

---

## 15. 兼容性检查清单

写移植自 C99 的程序时，先检查：

- 有没有 `goto`、VLA、`scanf`/`malloc`/文件等宿主机功能？（`printf`/`assert` 已提供，但格式串需为字面量。）
- 字符串是否仍按 `char*` 处理？`string_t` 是原生字符串值；`char*` 只用于真正的字符数组/缓冲区，`const char*` 可以指向字面量。
- 数组长度是否编译期常量？数组是否需要在寄存器/内存/远程之间传递？
- 指针是否需要做算术？如果需要，不能用 `byname`/名字指针。
- 是否跨处理器访问？需要 `remote`、对端变量和一致的数组布局。
- 是否有递归/大数组/大结构体？确认链接了足够的 memory cell/bank。
- 是否需要 `auto` 参数/结构体模板？启用 `#pragma overload(auto)` 并考虑 `#pragma noinline` 检查版本。
- 是否用了 `union`/位域？当前不要依赖 C 的重叠/打包语义。
- 是否需要 `#pragma` 控制数组布局、指针表示、栈检查或 switch 跳转表？

标准库函数和头文件见 [STANDARD_LIBRARY.md](STANDARD_LIBRARY.md)。
