/* Must fail: an `int a[];` that is never bound.
   A handle cell with nothing behind it is a name for nothing, so every use of it
   would read the register nobody has written. There is no runtime value that
   could be mistaken for "not an array yet": the cell starts as whatever the
   register held, which is why this is caught here rather than left to trap --
   the same treatment a `null` block/position gets, one step earlier.

   The message says what to write, because the fix is a single statement. */
/* MESSAGE: Array 'a' is an unbound handle that is never bound */
auto device message1;
int a[];
void main() {
    print(lenof(a));
    printflush(message1);
    stop();
}
