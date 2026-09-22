/* EXPECT: 1 4 1 4 1 4 */
/* One `auto` function, three different arrays:
     - `a` is held in registers (array("embedded_divided")), so it has no
       address and travels as a HANDLE;
     - `b` is an ordinary in-memory array, so it travels as a POINTER;
     - `rs` is a remote array, whose elements are registers of another
       processor.
   All three are written through the same `fill(auto int s[4])`, which is why
   that parameter is `auto`: one version per representation. */
#pragma overload(auto)
auto device message1;
void fill(auto int s[4]) { s[0] = 1; s[1] = 2; s[2] = 3; s[3] = 4; }
extern int r[4] = array("embedded_divided");
remote int rs[4] = remote(@this, "g:.r", "embedded_divided");
void main() {
    int a[4] = array("embedded_divided", {0, 0, 0, 0});
    int b[4];
    b[0] = 0; b[1] = 0; b[2] = 0; b[3] = 0;
    fill(a);
    fill(b);
    fill(rs);
    print(a[0]); print(a[3]);
    print(b[0]); print(b[3]);
    print(rs[0]); print(rs[3]);
    printflush(message1); stop();
}
