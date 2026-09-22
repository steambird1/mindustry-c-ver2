/* EXPECT: 2094 2094 */
/* Newton's method on p(x) = x^3 - 2x - 5, whose root is 2.09455...
   It puts several things under load at once: an array handed to a function
   (kept as a call, so it travels as a handle), a smaller one that gets
   inlined, a loop with compile-time bounds, and the same computation once
   fully constant (folded) and once fed a volatile value (run at runtime) --
   both have to agree. */
#pragma optimize(array)
auto device message1;
volatile float v0;
int pc[4] = array("embedded_divided", {1, 0, -2, -5});
int dc[3] = array("embedded_divided", {3, 0, -2});

float quad(int a[], float x) {
    return (float)a[0] * x * x + (float)a[1] * x + (float)a[2];
}

float horner(int a[], int n, float x) {
    float r = 0.0;
    int i;
    for (i = 0; i < n; i++) r = r * x + (float)a[i];
    return r;
}

float newton(float x) {
    int k;
    for (k = 0; k < 4; k++) {
        x = x - horner(pc, 4, x) / quad(dc, x);
    }
    return x;
}

void main() {
    float a;
    float b;
    a = newton(2.0);
    v0 = 2.0;
    b = newton(v0);
    print((int)(a * 1000.0));
    print((int)(b * 1000.0));
    printflush(message1); stop();
}
