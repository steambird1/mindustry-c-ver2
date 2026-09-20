/* Element written with a known value: the array contents should be UPDATED,
   not thrown away, so a[1] folds to 99 while a[2] still folds to 3. */
auto device message1;
void main() {
    int a[4] = {1, 2, 3, 4};
    a[1] = 99;
    print(a[1]);   /* 99 */
    print(a[2]);   /* 3  */
    printflush(message1);
    stop();
}
