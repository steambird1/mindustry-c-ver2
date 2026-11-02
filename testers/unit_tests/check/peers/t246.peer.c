/* The processor the main program reaches into. It publishes struct S[2]. */
auto device message1;

struct S {
    int x;
    int y;
    int a:3;
    int b:4;
    int *byname p;
};

int gx = 7;

extern struct S u[2] = array("embedded_divided", {
    {1, 2, 3, 5, byname(&gx)},
    {4, 5, 1, 2, byname(&gx)}
});

void main() {
    print(u[0].x);
    printflush(message1);
}
