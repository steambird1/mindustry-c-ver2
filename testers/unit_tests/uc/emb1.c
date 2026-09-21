#pragma optimize(array)
auto device message1;
const int tbl[8] = array("embedded_divided", {10, 20, 30, 40, 50, 60, 70, 80});
int i;
void main() {
    int a = 0, s = 0;
    a = tbl[2];
    print(a);
    i = 5;
    a = tbl[i];
    print(a);
    for (i = 0; i < 8; i++) { s = s + tbl[i]; }
    print(s);
    a = tbl[7];
    print(a);
    printflush(message1);
    stop();
}
