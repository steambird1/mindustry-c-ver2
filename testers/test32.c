// 简单的C程序示例
#define TEST 0
#define TEST2 15
#define TEST3 -12

inline int add(int x, int y) {
    int z = 0;
#if TEST
#if TEST3
    z = x*y;
#else
    print("No test3");
#endif
    return x+y+z-400;
#elif TEST2 > 10
#if TEST3 > 10
    z = TEST3*TEST2;
#elif TEST3 < -10
    z = -TEST3;
#else
    print("No test3 in test2");
#endif
    return x*y+z;
#elif TEST2
    return x-y;
#else
    return x+y;
#endif
}

void main() {
    int a = 10;
    int b = 20;
    int sum = add(a,b), i;

    // 条件语句示例
    if (sum > 100) {
        print("和大于100\n");
    } else if (sum > 25) {
        print("和大于25\n");
    } else {
        print("和小于等于25\n");
    }
    print(sum);
    
    // 循环示例
    for (i = 0; i < 5; i++) {
        print("循环计数:", i);
    }
    
}