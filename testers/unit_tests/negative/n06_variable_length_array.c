/* MESSAGE: Variable length arrays are not supported: the size of 'a' must be a co */
/* Only a function-scope VLA is supported for now. A VLA inside a nested block
   or loop needs block lifetime and stack-mark handling, which is a later
   stage; this used to be a warning and then silently behave as if the size
   were 1. */
auto device message1;
void f(int n) {
    for (int i = 0; i < 1; i++) {
        int a[n];
        a[0] = 1;
        print(a[0]);
    }
}
void main() { f(4); printflush(message1); stop(); }
