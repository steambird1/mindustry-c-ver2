/*
Packed accessors work with a lookup array: one content name addresses a whole
group of six 8-bit values.
*/
/* EXPECT: 200 -56 */
#include "packed.h"

auto device message1;

int cells[2] = array("embedded_lookup_item");

void main() {
    mc_pack8_set(cells, 7, 200);
    print(mc_pack8_get(cells, 7));
    print(mc_pack8_get_signed(cells, 7));
    printflush(message1);
    stop();
}
