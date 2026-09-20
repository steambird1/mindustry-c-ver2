auto device message1;
void main() {
    int a[4] = {10, 20, 30, 40};
    int x = a[2];          /* folds to 30 */
    if (a[0] > 5) {        /* folds to true  */
        x = x + a[1];      /* folds to 50    */
    }
    print(x);
    print(a[3]);
    printflush(message1);
    stop();
}
