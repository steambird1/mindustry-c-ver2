auto device message1;
int g;
int early(int n) { if (n > 0) { return 10; } return 20; }
int mid(int n) { if (n > 0) { return 1; } if (n > 5) { return 2; } return 3; }
int noneed(int n) { g = n; return 0; }
void main() {
    print(early(1)); print(early(-1));
    print(mid(1)); print(mid(7)); print(mid(-3));
    printflush(message1); stop();
}
