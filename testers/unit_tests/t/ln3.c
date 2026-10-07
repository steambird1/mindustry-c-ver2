/* KNOWN-GAP: never compiles: lenof() on a pointer, not an array. The refusal is what
   negative/n09_lenof_pointer asserts; this directory has no refusal runner.
*/
auto device message1;
int *p;
void main() { print(lenof(p)); printflush(message1); stop(); }
