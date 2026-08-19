// 简单的C程序示例
auto device message1;

int callcnt() {
   static int counter = 0;
   volatile int heap1 = 114, heap2 = 514;
   volatile int heap3 = heap1 + heap2;
   return ++counter;
}

void main() {
    int a = 10;
    int b = 20;
    int sum = a + b, i;

    // 条件语句示例
    if (sum > 0) {
        print("和大于25\n");
    } else {
        print("和小于等于25\n");
    }
    
    // 循环示例
    for (i = 0; i < 10; i++) {
        print("循环计数:", i);
        print("调用计数:", callcnt());
        print("是否为 3 的倍数:", (i % 3 == 0) ? "是" : "否");
    }
    printflush(message1);
}