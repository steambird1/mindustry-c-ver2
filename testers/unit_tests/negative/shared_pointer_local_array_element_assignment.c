/*
The same limitation reached through an assignment instead of a declaration:
`p = &data[1]` writes a shared pointer variable after the local array already
exists. It must report the local stack-frame target, not an internal compiler
error.
*/
/* MESSAGE: a shared pointer cannot refer to an element of the local array 'data' */
/* NOT-MESSAGE: Internal compiler error */
/* CODE: E_SHARED_POINTER_LOCAL_TARGET */
/* STAGE: codegen */
auto device message1;
struct Big { int x; };

void main() {
    Big data[2];
    shared Big *p;
    p = &data[1];
    p->x = 3;
    printflush(message1);
}
