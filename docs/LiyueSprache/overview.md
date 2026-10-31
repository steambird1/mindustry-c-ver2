Mindustry-C 是一个基于 JavaScript 将 C 语言代码编译为 Mindustry Logic 即 Mindustry 逻辑处理器代码的编译器。



Mindustry-C 支持基本所有的 C 语法，只有少数特殊情况：



* 初始化列表不能为空。例如，下面代码将产生编译错误：

```c

int *a = {};

```

* 函数指针必须单独定义。例如，`typedef void(*fptr)(int,int)` 可以被正确解析，但嵌套的类型声明的解析方式未定义。

* 没有 #elifdef 和 #elifdef。

* for 循环的第一个语句不能是函数声明，且目前 i++ 会产生额外的指令（请改用 ++i）。

* 不支持函数声明。

* main 函数的返回类型和参数没有限制。main 函数的任意返回值都将被忽略；main 函数参数的值未定义。建议使用 `void main()`。

只要没有调用 stop()，main 函数就会反复运行。

* 没有不定参数宏。

* 结构体类型变量不需要额外的 struct 来声明（与 C++ 类似）。当然，写上 struct  也是可以的。

* `string_t` 表示 Mindustry 原生字符串值；`char` 是普通的字符/数值类型。`char*` 是真正的字符数组指针，`const char*` 可以指向字面量。

* 存在特殊的类型 content_t, item_t, unit_t, block_t, liquid_t, null_t 和 device，其用法见后文具体介绍。**null_t 和 device 类型不能被放入内存。**

* 部分存储说明符的含义与 C 不同。

 auto 的含义是：如果修饰 device，则对应的设备可直接访问。例如：

```c

auto device message1;

```

表示处理器直接连接到名为 message1 的信息板。

extern 的含义是：保证该变量一定不被优化（类似 C 的 volatile），但不保证该变量一定放在内存中。

volatile 的含义是：保证该变量一定放在内存中。

near 存储说明符**未被弃用**。其含义是，保证对应的数组或结构体完整地处于单个内存单元内。