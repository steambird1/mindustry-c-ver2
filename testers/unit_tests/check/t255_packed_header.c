/*
Packed 4/8/16-bit arrays in one header:
    4-bit: 13 values per cell
    8-bit:  6 values per cell
   16-bit:  3 values per cell
Also checks signed extraction and the single-cell helpers.
*/
/* EXPECT: 0 9 1 19 2 109 4 -3 -5 -1000 200 */
#include "packed.h"

auto device message1;

MC_PACK4_DECL(a4, 10);
MC_PACK8_DECL(a8, 10);
MC_PACK16_DECL(a16, 10);

void main() {
    for (int i = 0; i < 10; i++) {
        mc_pack4_set(a4, i, i);
        mc_pack8_set(a8, i, i + 10);
        mc_pack16_set(a16, i, i + 100);
    }

    print(mc_pack4_get(a4, 0));
    print(mc_pack4_get(a4, 9));
    print(MC_PACK4_WORDS(10));

    print(mc_pack8_get(a8, 9));
    print(MC_PACK8_WORDS(10));

    print(mc_pack16_get(a16, 9));
    print(MC_PACK16_WORDS(10));

    mc_pack4_set(a4, 4, -3);
    print(mc_pack4_get_signed(a4, 4));

    mc_pack8_set(a8, 3, -5);
    print(mc_pack8_get_signed(a8, 3));

    mc_pack16_set(a16, 4, -1000);
    print(mc_pack16_get_signed(a16, 4));

    int cell = 0;
    cell = mc_pack8_cell_set(cell, 2, 200);
    print(mc_pack8_cell_get(cell, 2));

    printflush(message1);
    stop();
}
