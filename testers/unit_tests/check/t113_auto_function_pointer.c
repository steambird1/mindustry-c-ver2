/* EXPECT: 7 */
/* An `auto` function reached through a FUNCTION POINTER: the pointer is the
   line number of one version, so the call is really a call of that version --
   no representation has to be discovered at run time. The pointer's own type
   is what picks the version, and it has to be a concrete one: `int *` is an
   address, so this is the `memory` version. */
#pragma overload(auto)
auto device message1;
typedef void (*cb)(int *p);
void setp(auto int *p) { (*p) = 7; }
void main() {
    cb f = setp;
    int x = 0;
    f(&x);
    print(x);
    printflush(message1); stop();
}
