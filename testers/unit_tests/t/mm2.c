/* memsp() turns a BUILDING into a pointer; the building has to be really
   linked (that is what the link index it returns refers to). */
// LINKS: cell1=memory
auto device message1;
auto device cell1;
int *p;
void main() {
    p = (int*)memsp(cell1, 4);
    (*p) = 77;
    print(*p);
    printflush(message1); stop();
}
