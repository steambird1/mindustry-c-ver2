/*
The other side of t269: wait until the main processor has finished booting,
put 42 into the shared array, and publish its address through the shared
pointer slot as a stable id + offset.
*/
auto device message1;
volatile int main_ready = 0;
volatile int peer_done = 0;
int shared_data[4];
shared int *volatile shared_slot;

void main() {
    while (!main_ready) wait(0);
    shared_data[1] = 42;
    shared_slot = &shared_data[1];
    peer_done = 1;
    printflush(message1);
    stop();
}
