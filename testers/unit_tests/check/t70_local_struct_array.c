/* EXPECT: 5 6 7 1 4 */
/* A struct array local to a function, plus one with a deduced size. */
#pragma optimize(array)
auto device message1;
struct pt { int x; int y; };
void main() {
    struct pt local[3];
    struct pt la[] = {{1,2},{3,4}};
    local[0].x = 5; local[1].y = 6; local[2].x = 7;
    print(local[0].x); print(local[1].y); print(local[2].x);
    print(la[0].x); print(la[1].y);
    printflush(message1); stop();
}
