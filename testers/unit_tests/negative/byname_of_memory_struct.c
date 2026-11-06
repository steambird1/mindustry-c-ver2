/* MESSAGE: byname\(&big\) needs a register struct whose members are single-register leaves */
/*
Must fail: a struct with an array member is a memory aggregate, so it has no
one-register-per-leaf name packet. Use an ordinary or shared pointer instead.
*/
struct Big { int a[8]; int x; };
Big big;

void main() {
    Big *byname p = byname(&big);
    p->x = 1;
}
