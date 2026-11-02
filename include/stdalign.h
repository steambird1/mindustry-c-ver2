#ifndef _MINDC_STDALIGN_H
#define _MINDC_STDALIGN_H

/*
Mindustry-C has one-cell alignment. The macros exist for portable sources;
alignas(n) is accepted and ignored, alignof(type) is always 1.
*/
#define alignas(n)
#define alignof(type) 1
#define __alignas_is_defined 1
#define __alignof_is_defined 1

#endif
