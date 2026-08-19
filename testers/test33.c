// 简单的C程序示例

typedef void(*fptr)(int,int);
typedef void(*sptr)(int* p);
extern fptr fs[6];

void test1(int x, int y) {
    print(x+y);
}

void test2(int x, int y) {
    print(test2);
}

void test3(int *ptr) {
    *ptr = (*ptr) + 10;
}

void main() {
    int u = 0;

    fs[0] = test1;
    fs[1] = test2;

    fs[0](3,4);
    test3(&u);

    extern sptr tu = test3;
    tu(&u);
}