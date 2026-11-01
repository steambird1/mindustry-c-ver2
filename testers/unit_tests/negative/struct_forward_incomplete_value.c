/* MESSAGE: has incomplete type */
/* A forward-declared struct may be pointed at, but not instantiated by value. */
auto device message1;
struct P;
void main() {
    struct P p;
    printflush(message1);
    stop();
}
