// 简单的C程序示例
int fib(int x) {
   if (x < 3) return 1;
   return fib(x-1)+fib(x-2);
}

void main() {

    print(fib(5));
    
}