给出的代码整体（**除了 `mindcInfrastructure.js`**）组成一个用 JavaScript 实现的 C 编译器，将 C 语言编译成某种特定的机器语言。该机器语言的语法可以参照 `https://mdtwiki.top/index.php?title=Learn-mindustry-logic-A4`。

现在需要继续维护该编译器，但该编译器的最终代码生成部分（`mindcGenerator.js`）虽能大概实现功能，但总是存在不少漏洞，维护难度大，因此计划重构部分逻辑。

重构的方法是：将其**对值的处理**改编成面向对象的，如 `mindcInfrastructure.js` 中已经编写的代码（正确性不保证）所示，以改善 `mindcGenerator.js` 中大量复杂的分支判断、将返回情况包装在 `Instruction` 属性中等混乱情况。

注意：由于可能的递归函数的存在，对于包含多个操作数的运算（如 `a+b`）应和目前的代码一样，采用临时符号（`getTempSymbol`）而不是临时的寄存器（变量）。临时的符号会被正确地保存在栈上，但寄存器不会，一个名称只对应唯一的寄存器。

你可以对 `mindcGenerator.js` 中**包括但不限于** `processLValGetter`、`processAssignment`、`visitFunctionCall` 等函数进行较大的改动；但是：

- 尽量不要修改除 `mindcGenerator.js` 和 `mindcInfrastructure.js` 以外的文件，除非其它文件的代码中有**影响你进行本次重构的**漏洞。例如，你可能需要适应 ASTNode 的许多子节点并不放在 children 而是放在特定的属性下的设计，又例如 `mindcOptimizer.js` 中同样存在较混乱的代码；
- 尽量不要改变内存布局的约定（前 3 个字节中存放元数据）和指针表示的约定（`_block` 用于存放内存块**编号**，`_pos` 用于存放偏移量）。
- 尽量保证符合原有的最终机器语言生成逻辑，除非原有逻辑是错误的。

你可以合理地划分任务，并在每轮对话中先完成一部分代码的编写，并完成合理的**简单**测试（**不需要进行足够完整的测试**），防止对话轮次超过限制。

该 C 编译器的特殊语法见下。

---------------

Mindustry-C 是一个基于 JavaScript 将 C 语言代码编译为 Mindustry Logic 即 Mindustry 逻辑处理器代码的编译器。

## 语法

Mindustry-C 支持基本所有的 C89 语法，并支持部分 C99 和极少部分 C++ 特性，但有少数特殊情况：

* 函数指针必须单独定义。例如，`typedef void(*fptr)(int,int)` 可以被正确解析，但嵌套的类型声明的解析方式未定义。

* 没有 #elifdef 和 #elifdef。

* 没有 do-while 循环。

* for 循环的第一个语句不能是声明。

* 不支持函数声明。

* main 函数的返回类型和参数没有限制。main 函数的任意返回值都将被忽略；main 函数参数的值未定义。建议使用 `void main()`。

只要没有调用 stop()，main 函数就会反复运行。和 Arduino 有些类似。

* 没有不定参数宏。

* 结构体类型变量不需要额外的 struct 来声明（与 C++ 类似）。当然，写上 struct 有些时候也是可以的。

* char 表示**字符串而不是字符类型**。**char 类型不能被放入内存。**

* 存在特殊的类型 content_t, item_t, unit_t, block_t, liquid_t, null_t 和 device，其用法见后文具体介绍。**null_t 和 device 类型不能被放入内存。**

* 部分存储说明符的含义与 C 不同。

 auto 的含义是：如果修饰 device，则对应的设备可直接访问。例如：

```c

auto device message1;

```

表示处理器直接连接到名为 message1 的信息板。

extern 的含义是：保证该变量一定不被优化（类似 C 的 volatile），但不保证该变量一定放在内存中。

volatile 的含义是：保证该变量一定放在内存中。

near 存储说明符**未被弃用**。其含义是，保证对应的数组或结构体完整地处于单个内存单元内。**无法进行对应分配时会报错。**

* 游戏内的物品类型（如 @copper）为 content_t 类型。**该类型不能被放入内存；若需要放入内存，请改用 block_t, unit_t, liquid_t 和 item_t 表示对应类型。这些类型可以与 content_t 发生隐式类型转换。**

* 不能被放入内存的类型的指针与数组行为未定义（目前的行为是，读取结果一定为 null，写入无效）

* 结构体/联合体定义接近 C89 风格并有特殊限制：

1. 不能同时定义多个成员，例如以下的代码会产生编译错误：

```

struct a {

   //int a,b; //错误

   int a;

   int b; // 正确

};

```

2. 尽管声明结尾的冒号是必须的，不能由此定义变量。

3. struct/union 不能嵌套定义或匿名定义。

* 指针占用 **2 个单位空间，分别表示其所处的内存页和偏移量**。

* 尽管支持，**不建议**使用函数递归，会产生很多额外代码。

## 标准库函数

print(不定参数...)：向输出缓冲区写入内容（类似 C 的 printf）。

printflush(信息板)：向信息板输出文字缓冲区的内容。

draw(操作类型, 操作参数...)：绘图（参考 Mindustry 的命令参数格式，下同）

drawflush(显示器)：向显示器输出绘图缓冲区的内容。



其余函数可以参考 mlog 本身的用法，注意固定参数（如 draw 的 clear）用字符串字面量，如

```

draw("clear", 0, 0, 0);

```