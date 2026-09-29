/* Must fail: a handle read before the function binds it.
   The binding exists -- it is the line below the read -- but the read comes
   first, and "bound somewhere in this function" is not "bound by now": a read
   before it would take the helpers out of a register that holds no handle.

   The rule is textual within one function, which is the only thing that can be
   decided without running the program. A function that never binds the name at
   all is a different case (it is allowed: another function may have bound it),
   and a handle that is never bound anywhere is refused on its own.

   The RHS of a binding is read too, so `a = a;` is refused by the same rule --
   which is why the array used as the source here is a different name. */
/* MESSAGE: Array 'a' is an unbound handle: it is read before anything bound it here */
auto device message1;
int mem[4] = {1, 2, 3, 4};
int a[];
void main() {
    print(a[1]);
    a = mem;
    printflush(message1);
    stop();
}
