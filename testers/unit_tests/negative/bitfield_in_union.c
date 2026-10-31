/* MESSAGE: Bitfields in a union are not supported yet */
/* Union storage is shared; bitfield layout inside it is deferred. */
auto device message1;
union U {
    unsigned a : 3;
    int b;
};
void main() {
    union U u;
    printflush(message1);
    stop();
}
