/*
Also used for linter; this assume that you have already ignored any error.
*/

#ifndef _MINDC_MIN_H
#define _MINDC_MIN_H

#ifndef __MINDUSTRY__

#include <stdbool.h>
#define auto
#define persistent

typedef const char* string_t;
typedef unsigned int content_t;
typedef unsigned int device;
typedef unsigned int pdlist_t, sdlist_t;
typedef volatile void* null_t;

extern const null_t null = 0;

typedef content_t item_t, liquid_t, unit_t, block_t;

void draw(string_t arg0,...);
void print(...);
void printchar(...);
void format(...);
void drawflush(device arg0);
void printflush(device arg0);
device getlink(int arg0);
void control(string_t arg0,device arg1,...);
device radar(string_t arg0,string_t arg1,string_t arg2,string_t arg3,device arg4,int arg5);
null_t sensor(device arg0,content_t arg1);
void set(...);
void op(...);
content_t lookup(string_t arg0,int arg1);
void wait(float arg0);
void stop();
void end();
void jump(...);
null_t read(device source, null_t reference);
void write(null_t value, device source, null_t reference);
void ubind(content_t arg0);
void ucontrol(...);
device uradar(string_t arg0,string_t arg1,string_t arg2,string_t arg3,int arg4,int arg5);
int ulocate(...);
float sin(float arg0);
float cos(float arg0);
float tan(float arg0);
float asin(float arg0);
float acos(float arg0);
float atan(float arg0);
float adiff(float arg0,float arg1);
float min(float arg0,float arg1);
float max(float arg0,float arg1);
float ceil(long arg0);
float floor(long arg0);
float sqrt(float arg0);
float pow(float arg0,float arg1);
float abs(float arg0);
float rand(float arg0);
void memcpy(void* arg0,void* arg1,unsigned arg2);
void* memsp(device arg0,int arg1);

pdlist_t pdcreate(int size);
null_t pdread(pdlist_t pdlist, int pos);
void pdwrite(pdlist_t pdlist, int pos, null_t data);

// sharelist.h
sdlist_t sdcreate(int id, int size);
null_t sdread(device at, sdlist_t pdlist, int pos);
void sdwrite(device at, sdlist_t pdlist, int pos, null_t data);

// archon.h components
content_t argetblock(string_t arg0,int arg1,int arg2);
void arsetblock(string_t arg0,content_t arg1,int arg2,int arg3,content_t arg4,float arg5);
device arspawn(content_t arg0,int arg1,int arg2,float arg3,content_t arg4);
void arstatus(string_t type,...);
bool arweathersense(content_t arg0);
void arweatherset(content_t arg0,bool arg1);
void arspawnwave(int arg0,int arg1,bool arg2);
void arsetrule(string_t name,...);
void armessage(string_t type,...);
void arcutscene(string_t type,...);
void areffect(string_t arg0,...);
void arexplosion(content_t team,int x,int y,float radius,float damage,bool air,bool gnd,bool pierce,bool effect);
null_t arfetch(string_t type,content_t team,null_t id,content_t category);
void arsetprop(content_t prop,device target,null_t value);
bool argetflag(string_t name);
void arsetflag(string_t name,bool value);
void arplaysound(string_t arg0,...);
void armakemarker(string_t arg0,int arg1,int arg2,int arg3,bool arg4);
void arsetmarker(string_t arg0,...);

#endif
#endif