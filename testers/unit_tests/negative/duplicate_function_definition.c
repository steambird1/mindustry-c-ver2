/* MESSAGE: is already defined */
/* Two bodies for the same signature are a redefinition. */
auto device message1;
int f(int x) { return x; }
int f(int x) { return x + 1; }
void main() {
    print(f(1));
    printflush(message1);
    stop();
}
