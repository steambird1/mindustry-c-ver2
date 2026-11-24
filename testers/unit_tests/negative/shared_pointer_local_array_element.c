/*
A shared pointer is stored as a (building, offset) pair, and another processor
resolves the building through a program-level stable id. A local aggregate
array element has no fixed building: its address comes from the run-time stack
frame. The refusal must be an ordinary codegen diagnostic, not an internal
compiler error.
*/
/* MESSAGE: a shared pointer cannot refer to an element of the local array 'data' */
/* NOT-MESSAGE: Internal compiler error */
/* CODE: E_SHARED_POINTER_LOCAL_TARGET */
/* STAGE: codegen */
auto device message1;
struct Big { int x; };

void main() {
    Big data[2];
    data[1].x = 3;
    shared Big *p = &data[1];
    print(p->x);
    printflush(message1);
}
