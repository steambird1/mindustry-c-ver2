/*
Simple aliases for merui. Must be included AFTER merui.h
*/

#ifdef _MERUI_H

#ifndef _MERUI_SIMP_H
#define _MERUI_SIMP_H

#define sync(x) wait_for_succ(x)
#define async(x) exit_or_succ_with(x)

#endif

#endif