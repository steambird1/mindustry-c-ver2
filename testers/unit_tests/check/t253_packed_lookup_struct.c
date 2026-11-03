/*
A struct whose storage is one packed register can use lookup. The content
name addresses the packed value; bitfields are extracted from that register.
*/
/* EXPECT: 7 7 */
/* EMIT: lookup item */
/* EMIT: sensor .* @name */
/* EMIT-NOT: [a-z-]+\.__bits0 */
#pragma noinline
auto device message1;

typedef struct {
    int p1:5;
    int p2:5;
    int p3:5;
} packed_t;

extern packed_t a[2][2] = array("embedded_lookup");

void writeAt(int i, int j) {
    a[i][j].p2 = 7;
    print(a[i][j].p2);
}

void main() {
    writeAt(1, 1);
    print(a[1][1].p2);
    printflush(message1);
    stop();
}
