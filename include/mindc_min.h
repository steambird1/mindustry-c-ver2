/*
Also used for linter; this assume that you have already ignored any error.
*/

#ifndef _MINDC_MIN_H
#define _MINDC_MIN_H

#ifndef __MINDUSTRY__

#include <stdbool.h>
#define auto
#define persistent

typedef unsigned int content_t;
typedef unsigned int device;
typedef unsigned int pdlist_t, sdlist_t;
typedef volatile void* null_t;

extern const null_t null = 0;

typedef content_t item_t, liquid_t, unit_t, block_t;

void draw(char arg0,...);
void print(...);
void printchar(...);
void format(...);
void drawflush(device arg0);
void printflush(device arg0);
device getlink(int arg0);
void control(char arg0,device arg1,...);
device radar(char arg0,char arg1,char arg2,char arg3,device arg4,int arg5);
null_t sensor(device arg0,content_t arg1);
void set(...);
void op(...);
content_t lookup(char arg0,int arg1);
void wait(float arg0);
void stop();
void end();
void jump(...);
null_t read(device source, null_t reference);
void write(null_t value, device source, null_t reference);
void ubind(content_t arg0);
void ucontrol(...);
device uradar(char arg0,char arg1,char arg2,char arg3,int arg4,int arg5);
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
content_t argetblock(char arg0,int arg1,int arg2);
void arsetblock(char arg0,content_t arg1,int arg2,int arg3,content_t arg4,float arg5);
device arspawn(content_t arg0,int arg1,int arg2,float arg3,content_t arg4);
void arstatus(char type,...);
bool arweathersense(content_t arg0);
void arweatherset(content_t arg0,bool arg1);
void arspawnwave(int arg0,int arg1,bool arg2);
void arsetrule(char name,...);
void armessage(char type,...);
void arcutscene(char type,...);
void areffect(char arg0,...);
void arexplosion(content_t team,int x,int y,float radius,float damage,bool air,bool gnd,bool pierce,bool effect);
null_t arfetch(char type,content_t team,null_t id,content_t category);
void arsetprop(content_t prop,device target,null_t value);
bool argetflag(char name);
void arsetflag(char name,bool value);
void arplaysound(char arg0,...);
void armakemarker(char arg0,int arg1,int arg2,int arg3,bool arg4);
void arsetmarker(char arg0,...);

#endif
#endif