/* EXPECT: 1 0 */
/* A `bool` function called in a condition, with a parameter whose argument
   type differs (const-array element -> plain int): this used to build a
   nested instruction list and crash while printing the code. */
auto device message1;
const int thre[4] = {200, 200, 200, 200};
const int osize = 4;

bool proc(int thr, int sens) {
    if (sens > thr) {
        return true;
    } else {
        return false;
    }
}

void main() {
    int i;
    bool done = false;
    for (i = 0; i < osize; i = i + 1) {
        if (proc(thre[i], 500)) {
            done = true;
            break;
        }
    }
    if (done) { print(1); } else { print(0); }
    print(proc(thre[0], 1));
    printflush(message1);
    stop();
}
