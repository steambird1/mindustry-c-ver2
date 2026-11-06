/*
The other side of t278: wait for the main processor, put 42 into the shared
array, and publish its address through a shared pointer member of the shared
struct. The member is written as a stable id, not this processor's link index.
*/
auto device message1;
volatile int main_ready = 0;
volatile int peer_done = 0;
int shared_data[4];
struct S { shared int *p; int x; };
volatile struct S shared_state;
shared struct S *q = &shared_state;

void main() {
    while (!main_ready) wait(0);
    shared_data[1] = 42;
    q->p = &shared_data[1];
    q->x = 7;
    peer_done = 1;
    printflush(message1);
    stop();
}
