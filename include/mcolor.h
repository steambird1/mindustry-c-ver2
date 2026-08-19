/*
 mcolor.h : Pack and unpack color support.
 This is not provided as a standard part of Mindustry-C becaue when I write this,
 we don't have unpack color, and thus it seems useless.
*/

#ifndef _MCOLOR_H
#define _MCOLOR_H

struct colorinfo_t {
    float r;
    float g;
    float b;
    float alpha;
};

typedef double color_t;

colorinfo_t rgba(float r, float g, float b, float a) {
    return {r, g, b, a};
}

color_t packcolorw(float r, float g, float b, float a) {
    asm("packcolor __return ${r} ${g} ${b} ${a}");
}

color_t packcolor(colorinfo_t colinfo) {
    return packcolorw(colinfo.r, colinfo.g, colinfo.b, colinfo.alpha);
}

colorinfo_t unpackcolor(color_t col) {
   asm("unpackcolor __return.r __return.g __return.b __return.a ${col}");
}

#endif