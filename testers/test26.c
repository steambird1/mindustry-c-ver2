auto device node1;

double getPower() {
    return (double)sensor(node1, @powerNetIn) - (double)sensor(node1, @powerNetOut);
}

void main() {
    while (getPower() < 0) {
        print("Warning!");
        wait(0.2);
    }
}