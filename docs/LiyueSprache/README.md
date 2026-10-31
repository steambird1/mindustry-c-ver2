# Mindustry-C：将 C 代码编译为 Mindustry 逻辑处理器指令

## 什么是 Mindustry-C？

请注意：Mindustry-C 含有一定量 AI 生成的代码。

Mindustry-C 将 C 代码编译为 Mindustry 逻辑——因为后者太烧脑。

它不是宿主机上的 C 实现：没有操作系统、文件 I/O 或动态内存分配；值存放在处理器寄存器或链接的内存块里。完整的语言差异见
[DIFFERENCES_FROM_C99.md](../DIFFERENCES_FROM_C99.md)；标准库与内建函数见
[STANDARD_LIBRARY.md](../STANDARD_LIBRARY.md)。

## 安装

Mindustry-C 不需要安装。你只需要下载 `main.html` 和所有 JavaScript 文件，然后在同一目录下启动一个 HTTP 服务器（这一步是必要的，否则脚本会被 CORS 策略阻止）。

用较新的浏览器（至少支持 ES6）访问 `main.html` 即可。

建议保持网络连接，因为 `main.html` 中使用了来自 CDN 的 Bootstrap 以实现界面。

## Mindustry-C 特性

- C 核心：函数、结构体、指针、数组、`typedef`、
  `for`/`while`/`do-while`/`switch`、`break`/`continue`/`return`。
- C99 便利：`//` 注释、`bool`/`true`/`false`、`inline`、`for` 初始化声明。
- 存储期：自动局部变量按调用；`static` 在本次运行内；`persistent` 跨处理器重启；普通文件作用域变量每次运行重置。
- 预处理器：对象宏和函数宏、`#undef`、`#if`/`#elif`/`#else`/`#endif`、
  `#ifdef`/`#ifndef`、`#include`、`#pragma`。
  不支持可变参数宏；`goto` 和 VLA 会被拒绝。
- Mindustry 类型：`device`、`content_t`、`null_t`、`item_t`、`liquid_t`、
  `unit_t`、`block_t`，以及 `remote` 绑定。
- `auto device` 启动时按链接名绑定设备；也可以用 `getlink` 在运行时取。
- 数组：定长数组、推导最后一维、开放数组句柄，以及
  `traditional` / `embedded` / `encoded` / lookup 布局。
- 指针：普通两字地址指针，以及一字 `byname` 名字指针；
  `#pragma optimize(pointer)` / `struct_pointer`。
- `auto` 参数、`auto` 结构体成员和函数重载。
- `remote`：访问另一个处理器的变量、数组和指针。
- 内存块、函数栈、递归（开销较大）、`asm` 和原始 Mindustry 指令。
- 优化：常量折叠、循环模拟、常量 switch 折叠、encoded switch 派发、
  死代码删除、内联；不进行循环展开。

## 注意

1. 需要内存的情况：

- `volatile` 变量；
- 递归函数（其所有符号都会进入内存）；
- `array("traditional", ...)` 数组；
- 无法使用名字表示的普通 `&x` 指针；
- 太大或不适合放进寄存器的对象。

数组也可以放在寄存器、encoded 字符串或一个字的句柄里，所以“数组”不再自动等于“占用内存块”。

2. 非递归函数的局部量可以留在寄存器，但数组、`volatile` 变量和取地址的局部量仍可能需要内存。

3. 普通指针占两个字（block + position）；`byname` 名字指针或数组句柄占一个字。可以用 `widthof` 观察差异。

4. `union` 和位域可以解析，但目前不是稳定的 C99 兼容子集：不要依赖成员重叠或位打包。

递归受支持但昂贵且更难预测；优先使用全局变量和迭代写法。避免在非 `main` 函数里声明需要内存的变量。内存布局可能还会预留 block 元数据；小数组通常可以用寄存器或 encoded 布局。

## 特殊语法

### Mindustry 相关

- `device` 描述建筑/单位句柄，`content_t` 描述内容句柄；`item_t`、
  `liquid_t`、`unit_t`、`block_t` 是更具体的内容类型，`null_t` 可以容纳任意值。
  当前不建议把 `device`/`content_t` 放进数组或结构体成员；需要动态存储时用伪列表。
- 用 `auto device conveyor1;` 绑定连接到处理器的建筑（`auto` 是必须的）。
- 文件作用域的 `extern` 让处理器变量按名字对其他处理器可见；
  `remote(processor, name)` 绑定另一侧的变量/数组/指针。这不是 C 的外部链接。
- `remote int *p` 和 `int *remote p` 含义不同：`remote` 写在哪一侧，决定哪一侧存储指针。
- `int *byname p` / `byname(&x)` 用名字表示变量，只占一个寄存器；这种指针不能做指针算术。
- `(volatile type*)(object)` 把寄存器原样传给内置函数，尤其是 `ulocate`。
- 函数指针需要具体的 `typedef`；指向 `auto` 函数时需要一个具体版本。
- `array("...", {...})` 请求数组布局；可用布局见语言文档。

### 与 C/C++ 不同

- 空初始化列表不是可靠写法。`int a[] = {1, 2, 3};` 是支持的：最后一维由初始化列表推导。
- 字符串字面量是 `char` 值，不是 `char *`；没有 C 字符串函数。
- 完整差异见 [DIFFERENCES_FROM_C99.md](../DIFFERENCES_FROM_C99.md)。

## 旧文档

[TYPES_AND_FUNCTIONS.md](../TYPES_AND_FUNCTIONS.md) 是较早的简短参考；当前完整说明以
[DIFFERENCES_FROM_C99.md](../DIFFERENCES_FROM_C99.md) 和
[STANDARD_LIBRARY.md](../STANDARD_LIBRARY.md) 为准。
