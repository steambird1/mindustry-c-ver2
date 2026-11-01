/* MESSAGE: redeclared with return type */
/* A prototype and its definition must agree on the return type. */
auto device message1;
int f(int x);
void main() {
    printflush(message1);
    stop();
}
float f(int x) { return x; }
