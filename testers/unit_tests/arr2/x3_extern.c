/* extern means another processor may change it: nothing may be folded. */
auto device message1;
extern int e[4];
void main() {
    e[0] = 5;
    print(e[0]);
    printflush(message1);
    stop();
}
