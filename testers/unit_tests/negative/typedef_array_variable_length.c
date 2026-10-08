/* MESSAGE: Variable length arrays are not supported: the size of 'arr' must be a  */
/* Must fail: a typedef dimension has to be a compile time constant, exactly
   like a variable declaration's -- `arr a;` made from it would otherwise be a
   variable length array by surprise. */
typedef int arr[k];
void main() { print(1); }