/* MESSAGE: is declared but never defined */
/* A block-scope prototype still needs a real definition if called. */
auto device message1;
void main() {
    int f(int);
    print(f(1));
    printflush(message1);
    stop();
}
