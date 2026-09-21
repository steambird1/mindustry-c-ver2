#pragma optimize(array)
auto device message1;
const int tbl[12] = array("embedded_divided", {1,2,3,4,5,6,7,8,9,10,11,12});
int i;
int f(int k) { return tbl[k] + tbl[k+0]; }
void main() {
    int a = 0, s = 0;
    i = 3; a = tbl[i]; print(a);
    i = 7; a = tbl[i]; print(a);
    i = 11; a = tbl[i]; print(a);
    for (i = 0; i < 12; i++) { s = s + tbl[i]; }
    print(s);
    print(f(2));
    printflush(message1);
    stop();
}
