/* EXPECT: null */
/* an explicit cast of an unknown content is allowed, but it is not folded:
   the id is read at run time (and there is no such content, so it is null) */
auto device message1;
void main() {
    print((int)@unknownThing);
    printflush(message1);
    stop();
}
