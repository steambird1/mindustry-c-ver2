/*
memory.h : Basic memory access support.
*/

#include "mindc.h"

#ifndef _MEMORY_H
#define _MEMORY_H

#ifndef __MINDUSTRY__
#include <string.h>
#endif

void memset(void *target, null_t data, unsigned size) {
    unsigned i;
    for (i = 0; i < size; i++) {
        target[i] = data;
    }
}

void memset_near(near void *target, null_t data, unsigned size) {
    unsigned i;
    for (i = 0; i < size; i++) {
        target[i] = data;
    }
}

#endif