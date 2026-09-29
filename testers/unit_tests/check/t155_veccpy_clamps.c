/*
A handle's length is only known at run time, so `veccpy` cannot refuse a
source that is longer than the destination -- it copies the SMALLER of the two
counts instead.

The handle here names 8 elements. Copied into a 6-element destination, 6 are
written; copied into a 3-element one, 3 are. Each destination starts filled
with a marker, so an untouched element is visible as the marker.
*/
/* EXPECT: 1 2 3 4 5 6 7 1 2 3 1 2 */
auto device message1;
int wide[6] = {-1, -1, -1, -1, -1, -1};
int narrow[3] = {-1, -1, -1};
int src[8] = {1, 2, 3, 4, 5, 6, 7, 8};
int h[];
void main() {
    vecalias(&h, src);
    veccpy(wide, h);
    print(wide[0]);
    print(wide[1]);
    print(wide[2]);
    print(wide[3]);
    print(wide[4]);
    print(wide[5]);
    print(src[6]);
    veccpy(narrow, h);
    print(narrow[0]);
    print(narrow[1]);
    print(narrow[2]);
    print(wide[0]);
    print(wide[1]);
    printflush(message1);
    stop();
}
