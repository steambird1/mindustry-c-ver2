/*
memory.h : Basic memory access support.
*/

#include "mindc.h"

#ifndef _MEMORY_H
#define _MEMORY_H

#ifndef __MINDUSTRY__
#include <string.h>
#endif

#ifndef _MINDC_MEMSET_DEFINED
#define _MINDC_MEMSET_DEFINED 1
void memset(void *target, null_t data, unsigned size) {
    unsigned i;
    for (i = 0; i < size; i++) {
        target[i] = data;
    }
}
#endif

void memset_near(near void *target, null_t data, unsigned size) {
    unsigned i;
    for (i = 0; i < size; i++) {
        target[i] = data;
    }
}

#endif