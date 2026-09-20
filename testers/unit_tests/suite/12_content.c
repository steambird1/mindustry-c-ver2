/* content_t / item_t and the standard library functions. */
auto device message1;

void main() {
    content_t c = @copper;
    item_t it = @copper;
    print(c);
    print(it);
    printflush(message1);
    stop();
}
