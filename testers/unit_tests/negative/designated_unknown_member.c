/* MESSAGE: Unknown initializer member 'z' */
/* A designator must name a member of the target struct. */
struct P { int x; };

struct P p = { .z = 1 };

auto device message1;

void main() {
    printflush(message1);
    stop();
}
