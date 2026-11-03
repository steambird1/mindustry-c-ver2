#ifndef _MINDC_PACKED_H
#define _MINDC_PACKED_H

/*
Packed integer arrays for Mindustry-C.

A processor cell holds integers exactly up to 52 bits, so several small
integers can share one cell:

    4-bit  : 13 values per cell
    8-bit  :  6 values per cell
    16-bit :  3 values per cell

These are ordinary C arrays of cells plus accessor functions; they are not
native packed array types. There is therefore no `a[i]` lvalue, no `&a[i]`
and no pointer arithmetic over packed elements. Use the get/set functions.

The accessors take `int w[]`, so they work with register arrays, memory arrays,
remote arrays and lookup arrays. A whole cells array can be declared with
MC_PACK*_DECL. A single cell can be read/written with the MC_PACK*_CELL
helpers, which is useful inside a lookup-packed struct member.
*/

#define MC_PACK_CELL_MASK 4503599627370495

#define MC_PACK4_BITS 4
#define MC_PACK4_PER_CELL 13
#define MC_PACK4_MASK 15
#define MC_PACK4_WORDS(n) (((n) + 12) / 13)
#define MC_PACK4_DECL(name, n) enum { __mc_pack4_words_##name = (((n) + 12) / 13) }; int name[__mc_pack4_words_##name]

#define MC_PACK8_BITS 8
#define MC_PACK8_PER_CELL 6
#define MC_PACK8_MASK 255
#define MC_PACK8_WORDS(n) (((n) + 5) / 6)
#define MC_PACK8_DECL(name, n) enum { __mc_pack8_words_##name = (((n) + 5) / 6) }; int name[__mc_pack8_words_##name]

#define MC_PACK16_BITS 16
#define MC_PACK16_PER_CELL 3
#define MC_PACK16_MASK 65535
#define MC_PACK16_WORDS(n) (((n) + 2) / 3)
#define MC_PACK16_DECL(name, n) enum { __mc_pack16_words_##name = (((n) + 2) / 3) }; int name[__mc_pack16_words_##name]

/* ---- 4-bit ---- */

inline int mc_pack4_cell_get(int cell, int i) {
	int shift = (i % MC_PACK4_PER_CELL) * MC_PACK4_BITS;
	return (cell >> shift) & MC_PACK4_MASK;
}

inline int mc_pack4_cell_get_signed(int cell, int i) {
	int v = mc_pack4_cell_get(cell, i);
	return (v & 8) ? v - 16 : v;
}

inline int mc_pack4_cell_set(int cell, int i, int v) {
	int shift = (i % MC_PACK4_PER_CELL) * MC_PACK4_BITS;
	int mask = MC_PACK4_MASK << shift;
	return (cell & (MC_PACK_CELL_MASK ^ mask)) | ((v & MC_PACK4_MASK) << shift);
}

inline int mc_pack4_get(int w[], int i) {
	int shift = (i % MC_PACK4_PER_CELL) * MC_PACK4_BITS;
	return (w[i / MC_PACK4_PER_CELL] >> shift) & MC_PACK4_MASK;
}

inline int mc_pack4_get_signed(int w[], int i) {
	int v = mc_pack4_get(w, i);
	return (v & 8) ? v - 16 : v;
}

inline void mc_pack4_set(int w[], int i, int v) {
	int word = i / MC_PACK4_PER_CELL;
	int shift = (i % MC_PACK4_PER_CELL) * MC_PACK4_BITS;
	int mask = MC_PACK4_MASK << shift;
	w[word] = (w[word] & (MC_PACK_CELL_MASK ^ mask)) | ((v & MC_PACK4_MASK) << shift);
}

/* ---- 8-bit ---- */

inline int mc_pack8_cell_get(int cell, int i) {
	int shift = (i % MC_PACK8_PER_CELL) * MC_PACK8_BITS;
	return (cell >> shift) & MC_PACK8_MASK;
}

inline int mc_pack8_cell_get_signed(int cell, int i) {
	int v = mc_pack8_cell_get(cell, i);
	return (v & 128) ? v - 256 : v;
}

inline int mc_pack8_cell_set(int cell, int i, int v) {
	int shift = (i % MC_PACK8_PER_CELL) * MC_PACK8_BITS;
	int mask = MC_PACK8_MASK << shift;
	return (cell & (MC_PACK_CELL_MASK ^ mask)) | ((v & MC_PACK8_MASK) << shift);
}

inline int mc_pack8_get(int w[], int i) {
	int shift = (i % MC_PACK8_PER_CELL) * MC_PACK8_BITS;
	return (w[i / MC_PACK8_PER_CELL] >> shift) & MC_PACK8_MASK;
}

inline int mc_pack8_get_signed(int w[], int i) {
	int v = mc_pack8_get(w, i);
	return (v & 128) ? v - 256 : v;
}

inline void mc_pack8_set(int w[], int i, int v) {
	int word = i / MC_PACK8_PER_CELL;
	int shift = (i % MC_PACK8_PER_CELL) * MC_PACK8_BITS;
	int mask = MC_PACK8_MASK << shift;
	w[word] = (w[word] & (MC_PACK_CELL_MASK ^ mask)) | ((v & MC_PACK8_MASK) << shift);
}

/* ---- 16-bit ---- */

inline int mc_pack16_cell_get(int cell, int i) {
	int shift = (i % MC_PACK16_PER_CELL) * MC_PACK16_BITS;
	return (cell >> shift) & MC_PACK16_MASK;
}

inline int mc_pack16_cell_get_signed(int cell, int i) {
	int v = mc_pack16_cell_get(cell, i);
	return (v & 32768) ? v - 65536 : v;
}

inline int mc_pack16_cell_set(int cell, int i, int v) {
	int shift = (i % MC_PACK16_PER_CELL) * MC_PACK16_BITS;
	int mask = MC_PACK16_MASK << shift;
	return (cell & (MC_PACK_CELL_MASK ^ mask)) | ((v & MC_PACK16_MASK) << shift);
}

inline int mc_pack16_get(int w[], int i) {
	int shift = (i % MC_PACK16_PER_CELL) * MC_PACK16_BITS;
	return (w[i / MC_PACK16_PER_CELL] >> shift) & MC_PACK16_MASK;
}

inline int mc_pack16_get_signed(int w[], int i) {
	int v = mc_pack16_get(w, i);
	return (v & 32768) ? v - 65536 : v;
}

inline void mc_pack16_set(int w[], int i, int v) {
	int word = i / MC_PACK16_PER_CELL;
	int shift = (i % MC_PACK16_PER_CELL) * MC_PACK16_BITS;
	int mask = MC_PACK16_MASK << shift;
	w[word] = (w[word] & (MC_PACK_CELL_MASK ^ mask)) | ((v & MC_PACK16_MASK) << shift);
}

#endif
