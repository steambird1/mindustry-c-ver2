/* MESSAGE: A 'remote' pointer to a struct reaches its members by name, which need */
/* Must fail: a remote pointer to a struct reaches members by NAME, which needs
   `#pragma optimize(struct_pointer)`. Without it there is no way to step a
   member that lives in another processor. */
auto device message1;
struct pt { int x; int y; };
register struct pt st;
void main() {
    remote struct pt *p = remote(@this, &st);
    p->y = 3;
    print(st.y);
    printflush(message1);
}
