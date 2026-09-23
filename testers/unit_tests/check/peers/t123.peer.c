/* The other side of `t123`: it owns `pong`, and reaches the main program's
   `ping` remotely (the main processor is named by `// SELF: processorA`). */
auto device processorA;
auto device message1;

int pong = 0;
remote int rping = remote(processorA, "g:.ping");

void main() {
    pong = 100;
    while (rping == 0) { }
    pong = rping * 2;
    printflush(message1);
}
