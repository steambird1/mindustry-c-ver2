/*
 * Remote service support by Seabird Gunnhildr
 * as a part of standard library of MindC, 2025 - 2026.
*/

#define begin_atomic
#define end_atomic wait(0);

/*
 * Algorithms of preventing conflicting resource access.
 *
 * 1: Filter algorithm / Extended Peterson algorithm
 * 2: Token algorithm
*/

#ifndef NO_FILTER_ALGO

#ifndef FILTER_LEN
#define FILTER_LEN 16
#endif

int level[FILTER_LEN], turn[FILTER_LEN];



#endif