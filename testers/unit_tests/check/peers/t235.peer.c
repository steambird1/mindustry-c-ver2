/* The processor the main program reaches into. It publishes int[2][3]. */
auto device message1;

extern int u[2][3] =
    array("embedded_divided", {1, 2, 3, 4, 5, 6});

void main() {
    print(u[0][0]);
    printflush(message1);
}
