auto device message1;
extern int flag;
void main() {
    char s;
    if (flag) { s = "a"; } else { s = "b"; }
    print(s + "c");
    printflush(message1); stop();
}
