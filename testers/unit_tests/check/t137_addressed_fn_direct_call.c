/* EXPECT: 5 7 5 7 */
/* A function assigned to a function pointer copies its parameters out of
   `__param_N` in the prologue. A DIRECT call to it therefore has to deliver
   into those slots too -- writing straight into the parameter's own register
   was then overwritten by that copy, and the value arrived as 0. */
auto device message1;
typedef void(*fptr)(int, int);
void take(int a, int b) { print(a); print(b); }
void main() {
    fptr z = take;
    take(5, 7);
    z(5, 7);
    printflush(message1); stop();
}
