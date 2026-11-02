/* MESSAGE: Unknown initializer member 'z' */
/* A compound literal designator must name a member of the target struct. */
struct P { int x; };

auto device message1;

void main() {
    print((struct P){ .z = 1 }.x);
    printflush(message1);
    stop();
}
