/* MESSAGE: is declared but never defined */
/* A prototype may exist, but calling it needs a definition. */
auto device message1;
int f(int x);
void main() {
    print(f(1));
    printflush(message1);
    stop();
}
