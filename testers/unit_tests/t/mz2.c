#include "merui.h"
auto device message1;
void f(int flag){ if(true){ int r=flag; if(r) return; } print(1); }
void main(){ f(1); printflush(message1); stop(); }
