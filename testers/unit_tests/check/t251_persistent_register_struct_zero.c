/*
A persistent/static register-layout struct array is zeroed leaf by leaf.
It must not treat the literal `0` as a struct base (`0.__bits0` / `0.in.x`).
The remote binding forces the array into the register layout.
*/
/* EXPECT: 0 0 0 */
/* EMIT-NOT: [ ]0\.[A-Za-z_] */
/* EMIT: set g:\._a_0\.__bits0 0 */
/* EMIT: set g:\._a_0\.z 0 */
/* EMIT: set g:\._a_0\.in\.x 0 */
/* EMIT: set g:\._a_1\.__bits0 0 */
auto device message1;

struct I { int x; int y; };
struct S { int a:3; int b:4; int z; struct I in; };

extern persistent struct S _a[2][2];

remote struct S r[2][2] = remote(@this, _a);

void main() {
    print(r[1][1].a);
    print(r[1][1].z);
    print(r[1][1].in.x);
    printflush(message1);
    stop();
}
