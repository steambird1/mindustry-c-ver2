/* EXPECT: 7 13 14 1 6 */
auto device message1;
volatile int v;

int gcd(int a, int b) {
    while (b != 0) {
        int t = b;
        b = a - (a / b) * b;
        a = t;
    }
    return a;
}

int sumarr(int* p, int n) {
    int s = 0;
    int i = 0;
    while (i < n) {
        s = s + p[i];
        i = i + 1;
    }
    return s;
}

void main() {
    print(gcd(28, 35));
    int arr[4] = {1, 2, 3};
    arr[3] = 7;
    print(sumarr(arr, 4));
    int t = 0;
    int i;
    for (i = 0; i < 4; i++) {
        if (i == 2) {
            t = t + 10;
        } else {
            t = t + i;
        }
    }
    print(t);
    print(v == 0);
    int f = 1;
    i = 3;
    while (i > 0) {
        f = f * i;
        i = i - 1;
    }
    print(f);
    printflush(message1);
    stop();
}
