/* Must fail: a function POINTER type writes an `auto` parameter.
   What travels through such a pointer is a line number, so nothing at run time
   can choose which version of the function is meant -- the choice would have to
   be made when the POINTER is written down, and `auto` is exactly the request to
   defer it to the argument. Write the concrete type instead; t113 is what that
   looks like when it works.

   MESSAGE: cannot have an 'auto' parameter
   MESSAGE: line number
   The message has to name the reason, not just the syntax: a case that only
   asked "did it fail" would still pass after the check that produces this
   message is deleted, because the program is refused by something else. */
/* VERSION note: `auto` in a function pointer is a type-level mistake, so it does
   not depend on the target version -- no VERSION is asked for on purpose. */
#pragma overload(auto)
auto device message1;
typedef void (*cb)(auto int *p);
void setp(auto int *p) { (*p) = 7; }
void main() {
    cb f = setp;
    int x = 0;
    f(&x);
    print(x);
    printflush(message1); stop();
}
