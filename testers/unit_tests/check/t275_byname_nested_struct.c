/*
A nested flat register struct expands into one name per scalar leaf:
in.x, in.d, z. The packet still has no address arithmetic.
*/
/* EXPECT: 3 3 4 4 5 5 */
/* EMIT: set [^ ]*p\.in\.x "g:\.o\.in\.x" */
/* EMIT: set [^ ]*p\.in\.d "g:\.o\.in\.d" */
/* EMIT: set [^ ]*p\.z "g:\.o\.z" */
auto device message1;
struct Inner { int x; device d; };
struct Outer { Inner in; int z; };
Outer o;

void main() {
    Outer *byname p = byname(&o);
    p->in.x = 3;
    p->in.d = @this;
    p->z = 4;
    print(p->in.x);
    print(o.in.x);
    print(p->z);
    print(o.z);
    p->in.x = 5;
    print(p->in.x);
    print(o.in.x);
    printflush(message1);
    stop();
}
