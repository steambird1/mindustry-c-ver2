/* EXPECT: 5 */
/* A typedef'd multi-dimensional array keeps every dimension: `typedef int
   m[2][3];` wraps an `int[3]` in an `int[2]`, exactly like the same spelling
   as a variable declaration would. */
auto device message1;
typedef int m[2][3];
void main() {
    m a;
    a[1][2] = 5;
    print(a[1][2]);
    printflush(message1); stop();
}