/* EXPECT: 4 */
/* A typedef'd array keeps its dimensions: `typedef int arr[4]; arr a;` used
   to build a variable whose arraySize was lost, leaving an array of unknown
   size that any `a[0]` walked into a crash. */
auto device message1;
typedef int arr[4];
void main() {
    arr a;
    a[0] = 1;
    a[2] = 3;
    print(a[0] + a[2]);
    printflush(message1); stop();
}