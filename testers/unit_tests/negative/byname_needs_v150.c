/* MESSAGE: 's' holds a register NAME \('int \*byname' / 'byname\(&x\)'\), which needs target version 150 or newer */
/* Must fail: `read` / `write @this <name>` arrived in v150, so a name pointer
   cannot exist below that. Compiling it anyway used to emit a `block` / `pos`
   pair into a register the program reads as a name. */
/* VERSION: 140 */
auto device message1;
int c = 5;
void main() {
    int *s = byname(&c);
    (*s) = 9;
    print(*s);
    printflush(message1);
}
