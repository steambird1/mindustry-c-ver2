/*
button.h : Button support for Mindustry switch.
*/

#include "mindc_min.h"

#ifndef _BUTTON_H
#define _BUTTON_H

struct button {
    device buttonDevice;
    bool buttonReset;
};

typedef struct button button_t;

button_t createButton(const device buttonDevice, const bool buttonReset) {
    button_t tmp;
    tmp.buttonDevice = buttonDevice; tmp.buttonReset = buttonReset;
    return tmp;
}

bool hasPressedDev(device buttonDevice, const bool buttonReset) {
    bool result = (bool)sensor(buttonDevice, @enabled);
    if (buttonReset) {
        control("enabled", buttonDevice, false);
    }
    return result;
}

bool hasPressed(button buttonObject) {
    return hasPressedDev(buttonObject.buttonDevice, buttonObject.buttonReset));
}

#endif