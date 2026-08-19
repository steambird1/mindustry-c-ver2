#include "mindc.h"

const item_t *required = {@silicon, @graphite, @lead, @metaglass};
const int required_len = 4;

auto device container1, unloader1;
const device cvault = container1, cunloader = unloader1;
const int cont_max = 300;

void main() {
    int i;
    bool enabling = false;
    for (i = 0; i < required_len; i++) {
        const content_t ccontent = required[i];
        if ((int)sensor(cvault, ccontent) >= cont_max) {
            control("configure", cunloader, ccontent);
            enabling = true;
        }
    }
    control("enabled", cunloader, enabling);
}