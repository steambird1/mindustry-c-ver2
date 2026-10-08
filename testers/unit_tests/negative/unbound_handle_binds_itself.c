/* Must fail: the right-hand side of a binding is a READ, and a read is a read.
   `a = a;` is the one statement that looks like it both binds and uses the
   handle, and the walk has to visit the operands BEFORE it counts the binding
   -- otherwise the right side is "already bound" by the very statement being
   checked, and the rule quietly stops applying to it.

   The source is written as `a` on purpose: any other name would make this the
   same case as reading `a[1]` first, and the two would then test one rule. */
/* MESSAGE: Array 'a' is an unbound handle: it is read before anything bound it he */
auto device message1;
int mem[4] = {1, 2, 3, 4};
int a[];
void main() {
    a = a;
    printflush(message1);
    stop();
}
