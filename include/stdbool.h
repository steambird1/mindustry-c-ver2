#ifndef _STDBOOL_H
#define _STDBOOL_H

/*
Mindustry-C already has `bool`, `true` and `false` as keywords, so this file
exists mainly so that portable C sources can keep `#include <stdbool.h>`.
The linter path (when `__MINDUSTRY__` is not defined) gets ordinary C macros.
*/
#ifndef __MINDUSTRY__
#ifndef __bool_true_false_are_defined
#define bool _Bool
#define true 1
#define false 0
#endif
#endif

#define __bool_true_false_are_defined 1

#endif
