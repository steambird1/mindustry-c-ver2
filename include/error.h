/*
error.h : C-style error handler.
*/
#include "mindc_min.h"

#ifndef _ERROR_H
#define _ERROR_H

// Public interfaces
extern int _errId = 0;
extern string_t _errInfo;

void perror() {
    if (_errId) {
        print("<ERROR>: (", _errId, "): ", _errInfo);
    }
}

#define errno _errId

#endif