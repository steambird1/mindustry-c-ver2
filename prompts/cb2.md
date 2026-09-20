现在 findRecursiveFunctions 只在 mindcBase.js 中，不在 mindcGeneratorBase.js 中，无需额外考虑。

请你先注意：

- 原先代码中的 registryStruct 相关代码指**结构体成员通过寄存器的方式保存**，可能需要单独创建一个类描述此类结构体。

请你继续重构 mindcGenerator.js 中的：

- 用目前的面向对象方法替换掉 generateSymbolWrite
- resolveMemberExpression 和 visitMemberExpression
- visitFunctionCall

同时做好以下方面的准备（即仅在 mindcInfrastructure.js 和 mindcOptimizer.js 中添加/修改所需代码，但 mindcGenerator.js 不实际引用它）：

- 引入某种特定情况下指针的表示方式，使其数据结构与目前的不同，且仅支持存地址 / 解引用（即不支持形如 `p[2]` 或 `p+2` 的指针运算）。

    **注意**：其仅仅能够指向简单类型（存储在寄存器中，仅仅占用一个寄存器变量的类型）或指向简单类型的**此种特殊指针**。

- 引入某几种特定情况下数组的表示方式（可参照 mindc.js 中的 pseudoList），其支持数组的下标访问，但不支持与指针相互转换（可参考 mindcOptimizer.js 中的 ArrayStateReferrer 对其类型的归类）。

注意：

有一轮对话被我中断，所以可能产生一些临时文件/未完成修改的文件。