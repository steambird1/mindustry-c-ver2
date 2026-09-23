/* Must fail: which of two string literals `s` holds is only known at run
   time, and Mindustry has no instruction that concatenates two strings
   held in registers -- so `s + "c"` cannot be compiled. */
auto device message1;
extern int flag;
void main() {
    char s;
    if (flag) { s = "a"; } else { s = "b"; }
    print(s + "c");
    printflush(message1); stop();
}
