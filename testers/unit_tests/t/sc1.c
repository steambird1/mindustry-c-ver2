auto device message1;
int g;
int side() { g = g + 1; return 1; }
void main() {
    if (side() && side()) { print(1); } else { print(0); }
    print(g);
    printflush(message1); stop();
}
