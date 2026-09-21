auto device message1;
#pragma optimize(array)
int arr[] = {3,4,5};
int arr2[] = array("embedded", {1,2,3,4});
int m[][2] = {{1,2},{3,4},{5,6}};
int m2[2][3] = {{1,2,3},{4,5,6}};
int i;
void main() {
    print(arr[1]); print(arr[2]);
    print(arr2[3]);
    print(m[2][1]);
    print(m2[1][2]);
    printflush(message1); stop();
}
