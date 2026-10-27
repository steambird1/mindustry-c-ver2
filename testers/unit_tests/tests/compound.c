/* EXPECT: 7 6 3 21 */
auto device message1;
int arr[4];
volatile int vv;
struct P { int x; int y; };
int f(int x) { return x * 2; }
void main() {
    arr[0] = 1;
    arr[0] += f(3);
    arr[1] = arr[0] * 3;
    vv = 3;
    vv *= 2;
    struct P a;
    struct P b;
    a.x = 1;
    a.y = 2;
    b = a;
    int t = 0;
    t += arr[1];
    print(arr[0]);
    print(vv);
    print(b.x + b.y);
    print(t);
    printflush(message1);
    stop();
}
