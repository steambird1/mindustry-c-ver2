/* EXPECT: 1 101 */
/* `#pragma overload(...)` is accepted, and two functions may share a name when
   their parameters differ (that is what `default` -- the mode in force when
   nothing is written -- allows). */
#pragma overload(auto)
auto device message1;
void show(int a) { print(a); }
void show(int *a) { print((*a) + 100); }
void main() {
    int x = 1;
    show(x);
    show(&x);
    printflush(message1); stop();
}
