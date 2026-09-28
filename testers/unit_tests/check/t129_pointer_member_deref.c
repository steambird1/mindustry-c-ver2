/* EXPECT: 1 2 */
/* A pointer member inside a struct, dereferenced with `->`.
   `h.p->x` must not be folded into "walk from h": `h.p` is a pointer that has to
   be dereferenced first. Folding past the arrow made the base `h` itself, and
   the member was then read through `h_block` / `h_pos` -- which do not exist for
   a struct held in registers. */
auto device message1;
struct pt { int x; };
struct holder { int v; struct pt *p; };
struct holder h; struct pt b;
void main() {
    h.v = 1; b.x = 2;
    h.p = &b;
    print(h.v);
    print(h.p->x);
    printflush(message1); stop();
}
