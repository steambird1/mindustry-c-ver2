// 简单的C程序示例
int fib(int x) {
   if (x < 3) return 1;
   return fib(x-1)+fib(x-2);
}

void main() {
    int a = 10;
    int b = 20;
    int sum = a + b, i;

    // 条件语句示例
    if (sum > 25) {
        print("和大于25\n");
    } else {
        print("和小于等于25\n");
    }
    
    // 循环示例
    for (i = 0; i < 5; i++) {
        print("循环计数:", i);
    }

    print(fib(5));
    
}