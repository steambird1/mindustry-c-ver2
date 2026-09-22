/* EXPECT: 1 */
auto device message1;
auto device cell1;
void main(){ write(42, cell1, 0); read(cell1, 0); print(1); printflush(message1); stop(); }
