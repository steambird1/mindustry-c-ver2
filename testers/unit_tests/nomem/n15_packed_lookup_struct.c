/*
With no memory, a one-register packed struct array can use lookup.
*/
/* EXPECT: 7 */
auto device message1;

typedef struct {
    int p1:5;
    int p2:5;
    int p3:5;
} packed_t;

extern packed_t a[2][2];

void main() {
    a[1][1].p2 = 7;
    print(a[1][1].p2);
    printflush(message1);
    stop();
}
