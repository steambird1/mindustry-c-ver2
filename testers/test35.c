// 简单的C程序示例
void main() {
    int a = 10;
    int b = 20;
    int sum = a + b, i;
    int *const j = &a, *k = &b;
    (*j) = 30;
    k = &a;

    print(a,b,*k);
    
    // 循环示例
    for (i = 0; i < 5; i++) {
        print("循环计数:", i);
    }
    
}