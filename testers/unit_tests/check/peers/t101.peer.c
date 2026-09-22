/* The processor the main program reaches into. It owns an array whose elements
   are named after contents (`copper`, `lead`, ...) and publishes it. */
auto device message1;
extern int u[4] = array("embedded_lookup_item", {1, 2, 3, 4});
void main() {
    print(u[0]);
    printflush(message1);
}
