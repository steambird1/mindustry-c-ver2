/*
math.h : Basic math support.

Mindustry provides the common `op` instructions. The functions below are only
the ones that are not already compiler builtins.
*/
#ifndef _MATH_H
#define _MATH_H

#include <float.h>

#define M_E 2.71828182845904523536
#define M_LOG2E 1.44269504088896340736
#define M_LOG10E 0.434294481903251827651
#define M_LN2 0.693147180559945309417
#define M_LN10 2.30258509299404568402
#define M_PI 3.14159265358979323846
#define M_PI_2 1.57079632679489661923
#define M_PI_4 0.785398163397448309616
#define M_1_PI 0.318309886183790671538
#define M_2_PI 0.636619772367581343076
#define M_SQRT2 1.41421356237309504880
#define M_SQRT1_2 0.707106781186547524401

#define fabs(x) abs(x)
#define fmin(a, b) ((a) < (b) ? (a) : (b))
#define fmax(a, b) ((a) > (b) ? (a) : (b))
#define round(x) ((x) < 0 ? ceil((x) - 0.5) : floor((x) + 0.5))
double __mc_trunc(double x) { return x < 0 ? ceil(x) : floor(x); }
#define trunc(x) ((x) < 0 ? ceil(x) : floor(x))
inline double fmod(double x, double y) { return x - __mc_trunc(x / y) * y; }

double log(double x) { asm("op log __return ${x}"); }
inline double exp(double x) { return pow(M_E, x); }
inline double log10(double x) { return log(x) / M_LN10; }

inline int isnan(double x) { return x != x; }
inline int isinf(double x) { return x == x && (x > DBL_MAX || x < -DBL_MAX); }
inline int isfinite(double x) { return x == x && x <= DBL_MAX && x >= -DBL_MAX; }

double distance(double x1, double y1, double x2, double y2) {
    return sqrt(pow(x2-x1,2)+pow(y2-y1,2));
}

#endif
