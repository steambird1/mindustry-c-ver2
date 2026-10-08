/* MESSAGE: Cannot concatenate these strings: only string literals can be joined,  */
/* Only literals can be joined: the target language has no run time
   concatenation. The value of `s` is not known here. */
auto device message1;
extern int flag;
void main() {
    char s;
    if (flag) { s = "a"; } else { s = "b"; }
    print(s + "c");
    printflush(message1); stop();
}
