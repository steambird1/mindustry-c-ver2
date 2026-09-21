/* EXPECT: 7 3 */
/* `{(int)(@thorium), (int)(@graphite)}` -- a content constant written with an explicit cast still has to keep its id, otherwise the whole array collapses to 0. */
#pragma optimize(array)
auto device message1;
const int deploy[2] = {(int)(@thorium), (int)(@graphite)};
int i;
void main() {
    i = 0; print(deploy[i]);
    i = 1; print(deploy[i]);
    printflush(message1); stop();
}
