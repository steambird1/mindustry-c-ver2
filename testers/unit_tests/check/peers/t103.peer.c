/* The processor the main program reaches into. It owns `c`, and publishes it. */
auto device message1;
int c = 0;
void main() {
    printflush(message1);
}
