/* Drawing: fixed operation names are given as string literals. */
auto device display1;
auto device message1;

void main() {
    draw("clear", 0, 0, 0);
    draw("color", 255, 0, 0, 255);
    draw("line", 0, 0, 40, 40);
    drawflush(display1);
    printflush(message1);
    stop();
}
