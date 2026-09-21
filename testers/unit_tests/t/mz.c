#include "merui.h"
auto device message1;
void nn(){} void f(){ if(true){ int r=1; if(r) return; } nn(); print(1); } void g(){ f(); }
void main() { print(1); printflush(message1); stop(); }
