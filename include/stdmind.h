/*
stdmind.h : Providing C-style dynamic operations for radar, uradar and ulocate.
The programming of this library is suspended as it has proved useless
*/
#include "mindc_min.h"
#include "error.h"

#ifndef _STDMIND_H
#define _STDMIND_H

typedef unsigned radarflag_t, radarsort_t;
// Radar flags
const radarflag_t r_any = 0;
const radarflag_t r_enemy = 1;
const radarflag_t r_ally = 2;

const radarflag_t r_player = 4;
const radarflag_t r_boss = 32;

const radarflag_t r_flying = 16;
const radarflag_t r_ground = 64;

const radarflag_t r_attacker = 8;

const radarsort_t rs_distance = 0, rs_shield = 1, rs_health = 2, rs_armor = 3, rs_maxhealth = 4;

// The first parameter is for enemy/ally, then player/boss, then flying/ground.
// If there's still room for attacker, then it will be added; otherwise the behavior is undefined

void _throwArgErr() {
    _errId = -1001;
    _errInfo = "Incorrect number of parameters in radar() or uradar() call";
}

device sradar(radarflag_t operation, radarsort_t sort, device source, int order) {
#define __sort_principle(key1,key2,key3) if (sort == rs_distance) return radar(key1, key2, key3, "distance", source, order); if (sort == rs_health) return radar(key1, key2, key3, "health", source, order); if (sort == rs_maxhealth) return radar(key1, key2, key3, "maxHealth", source, order); if (sort == rs_shield) return radar(key1, key2, key3, "shield", source, order); if (sort == rs_armor) return radar(key1, key2, key3, "armor", source, order)

    if (operation & r_enemy) {
        if (operation & r_player) {
            __sort_principle("enemy", "player", "any"); // player must be flying
        } else if (operation & r_boss) {
            if (operation & r_flying) {
                __sort_principle("enemy", "boss", "flying");
            } else if (operation & r_ground) {
                __sort_principle("enemy", "boss", "ground");
            } else if (operation & r_attacker) {
                __sort_principle("enemy", "boss", "attacker");
            } else {
                __sort_principle("enemy", "boss", "any");
            }
        } else {
            if (operation & r_flying) {
                if (operation & r_attacker) {
                    __sort_principle("enemy", "attacker", "flying");
                } else {
                    __sort_principle("enemy", "any", "flying");
                }
            } else if (operation & r_ground) {
                if (operation & r_attacker) {
                    __sort_principle("enemy", "attacker", "ground");
                } else {
                    __sort_principle("enemy", "any", "ground");
                }
            } else if (operation & r_attacker) {
                __sort_principle("enemy", "any", "attacker");
            } else {
                __sort_principle("enemy", "any", "any");
            }
        }
    } else if (operation & r_ally) {
        if (operation & r_player) {
            __sort_principle("ally", "player", "any"); // player must be flying
        } else if (operation & r_boss) {
            if (operation & r_flying) {
                __sort_principle("ally", "boss", "flying");
            } else if (operation & r_ground) {
                __sort_principle("ally", "boss", "ground");
            } else if (operation & r_attacker) {
                __sort_principle("ally", "boss", "attacker");
            } else {
                __sort_principle("ally", "boss", "any");
            }
        } else {
            if (operation & r_flying) {
                if (operation & r_attacker) {
                    __sort_principle("ally", "attacker", "flying");
                } else {
                    __sort_principle("ally", "any", "flying");
                }
            } else if (operation & r_ground) {
                if (operation & r_attacker) {
                    __sort_principle("ally", "attacker", "ground");
                } else {
                    __sort_principle("ally", "any", "ground");
                }
            } else if (operation & r_attacker) {
                __sort_principle("ally", "any", "attacker");
            } else {
                __sort_principle("ally", "any", "any");
            }
        }
    } else {
        if (operation & r_flying) {
            if (operation & r_attacker) {
                __sort_principle("any", "attacker", "flying");
            } else {
                __sort_principle("any", "any", "flying");
            }
        } else if (operation & r_ground) {
            if (operation & r_attacker) {
                __sort_principle("any", "attacker", "ground");
            } else {
                __sort_principle("any", "any", "ground");
            }
        } else if (operation & r_attacker) {
            __sort_principle("any", "any", "attacker");
        } else {
            __sort_principle("any", "any", "any");
        }
    }
}

#endif