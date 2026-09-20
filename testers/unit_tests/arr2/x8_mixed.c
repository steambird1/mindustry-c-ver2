/* extern must never be folded even when everything looks constant. */
auto device message1;
extern int ext[3];
void main() {
    int local[3] = {1, 2, 3};
    ext[0] = local[1];      /* read of local folds, write to ext stays */
    print(local[0] + local[2]);
    print(ext[0]);
    printflush(message1);
    stop();
}
