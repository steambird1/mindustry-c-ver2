/* EXPECT: 7 */
/* `#pragma optimize(pointer)` asks for EVERY pointer that fits to be a name
   pointer, so with no memory block linked this needs no pragma per pointer. */
#pragma optimize(pointer)
auto device message1;
void main() {
    int w = 3;
    int *q;
    q = &w;
    (*q) = 7;
    print(w);
    printflush(message1);
}
