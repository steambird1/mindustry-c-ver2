#pragma optimize(array)
auto device message1;
int tbl[12] = array("embedded_divided", {0,0,0,0,0,0,0,0,0,0,0,0});
int i;
void main() {
    i = 3; tbl[i] = 7;
    i = 9; tbl[i] = 5;
    i = 3; print(tbl[i]);
    i = 9; print(tbl[i]);
    i = 0; print(tbl[i]);
    printflush(message1);
    stop();
}
