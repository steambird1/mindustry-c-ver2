/* MESSAGE: cannot be the target of remote */
/*
A runtime handle can be rebound and packs helper entry points of this
processor. It has no stable element names for another processor to read.
*/
auto device message1;

extern int a[];
int concrete[3] = {1, 2, 3};
remote int r[] = remote(@this, a);

void main() {
    a = concrete;
    print(r[1]);
    printflush(message1);
    stop();
}
