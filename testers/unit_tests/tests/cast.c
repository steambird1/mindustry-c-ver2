auto device message1;
int arr[4];
void main() {
    arr[0] = 7;
    int* p = arr;
    int addr = (int)p;
    int* q = (int*)addr;
    print(*q);
    float f = 3.7;
    int i = (int)f;
    print(i);
    item_t it = @copper;
    content_t c = (content_t)it;
    int id = (int)c;
    print(id);
    bool b = (bool)i;
    print(b);
    int arr2[3] = {1,2,3};
    print(arr2[1]);
    printflush(message1);
    stop();
}
