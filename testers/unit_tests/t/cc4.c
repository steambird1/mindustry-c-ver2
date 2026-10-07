/* KNOWN-GAP: never compiles: `s + "c"` joins a variable to a literal, and the target
   language has no run time concatenation. The refusal is what
   negative/n07_runtime_string_concat and n08_string_concat_runtime assert;
   this directory has no refusal runner.
*/
auto device message1;
extern int flag;
void main() {
    char s;
    if (flag) { s = "a"; } else { s = "b"; }
    print(s + "c");
    printflush(message1); stop();
}
