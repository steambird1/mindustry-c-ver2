/* EXPECT: 0 1 5 9 3 93 95 137 0 17 */
/* ids are the v152..v159 logicids.dat positions */
auto device message1;
void main() {
    print((int)@copper);
    print((int)@lead);
    print((int)@coal);
    print((int)@silicon);
    print((int)@graphite);
    print((int)@vault);
    print((int)@unloader);
    print((int)@message);
    print((int)@dagger);
    print((int)@zenith);
    printflush(message1);
    stop();
}
