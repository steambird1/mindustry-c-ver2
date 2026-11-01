/* MESSAGE: Function definitions are not allowed inside a block */
/* C permits block-scope declarations, not nested function definitions. */
auto device message1;
void main() {
    int g(int) { return 2; }
    print(g(1));
    printflush(message1);
    stop();
}
