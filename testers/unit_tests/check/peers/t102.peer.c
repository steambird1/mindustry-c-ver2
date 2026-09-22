/* The processor the main program reaches into: a scalar, an array and a struct,
   all published so the other side can name them. */
auto device message1;
struct pt { int x; int y; };
extern int c;
extern int u[5] = array("embedded_divided", {10, 20, 30, 40, 50});
extern struct pt st;
void main() {
    printflush(message1);
}
