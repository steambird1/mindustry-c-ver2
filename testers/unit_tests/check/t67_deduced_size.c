/* EXPECT: 4 5 4 6 6 */
/* `int a[] = {...}` takes its size from the initializer, including through array("embedded", {...}) and for a multi-dimensional array. */
#pragma optimize(array)
auto device message1;
int arr[] = {3,4,5};
int arr2[] = array("embedded", {1,2,3,4});
int m[][2] = {{1,2},{3,4},{5,6}};
int m2[2][3] = {{1,2,3},{4,5,6}};
void main() {
    print(arr[1]); print(arr[2]);
    print(arr2[3]);
    print(m[2][1]);
    print(m2[1][2]);
    printflush(message1); stop();
}
