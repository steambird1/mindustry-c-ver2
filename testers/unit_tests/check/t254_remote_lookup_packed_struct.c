/*
A remote lookup array with a one-register packed struct element: lookup/sensor
resolve the content name, then read/write go to the other processor.
*/
/* EXPECT: 7 7 */
/* EMIT: lookup item */
/* EMIT: sensor .* @name */
/* EMIT: read .*r__rdev */
/* EMIT: write .*r__rdev */
#pragma noinline
auto device message1;

typedef struct {
    int p1:5;
    int p2:5;
    int p3:5;
} packed_t;

extern packed_t a[2] = array("embedded_lookup_item");
remote packed_t r[2] = remote(@this, a, "embedded_lookup_item");

void writeAt(int i) {
    r[i].p2 = 7;
    print(r[i].p2);
}

void main() {
    writeAt(1);
    print(a[1].p2);
    printflush(message1);
    stop();
}
