/* EXPECT: 300 */
/* A `#pragma id` entry that is not in the built-in table at all: the declared
   id is used verbatim. (Declaring ids also makes @itemCount & friends unknown
   to the compiler, but that changes only the generated code, not the output,
   so it is checked separately -- see the note in the test overview.) */
#pragma id(item, @myitem:300)
auto device message1;
void main() {
    print((int)@myitem);
    printflush(message1);
    stop();
}
