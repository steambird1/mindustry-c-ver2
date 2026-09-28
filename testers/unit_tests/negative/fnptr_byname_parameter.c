/* Must fail: a `byname` parameter given to a function POINTER.
   A function pointer's parameters reach the compiler as plain type NAMES, and
   no type name carries a pointer qualifier -- `void (*)(int *byname)` reads
   back as `int*`. So the pointer's type cannot state that the argument is a
   name, and the only representation left to compile the callee for is the
   address one. The call site would then hand over an address and the callee
   would read a name: the value written would land in the wrong place, and
   nothing would say so.

   So this is refused rather than compiled. Passing the NAME through a function
   pointer is a real thing the language ought to be able to do; it is not
   something the type-name channel can carry yet.

   MESSAGE: cannot say 'byname' or 'remote'
   MESSAGE: plain type names
   Without a reason check this case would pass on any error at all -- and
   `typedef void (*cb)(int *byname);` is itself refused, for a different
   reason, so the refusal here is easy to get by accident. */
/* VERSION note: the limitation is in the type-name channel, not the target. */
#pragma optimize(pointer)
auto device message1;
typedef void (*cb)(int *p);
void setp(int *byname p) { (*p) = 7; }
void main() {
    cb f = setp;
    int x = 0;
    f(&x);
    print(x);
    printflush(message1); stop();
}
