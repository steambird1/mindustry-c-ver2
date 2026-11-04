/*
A remote binding may use its own name as the target when the device is a real
other processor. The target name is synthesised as g:.safety_data; no local
safety_data_0 element symbols are created.
*/
/* EXPECT: 0 */
/* EMIT: set g:\.safety_data__rnm "g:\.safety_data" */
/* EMIT-NOT: g:\.safety_data_0 */
auto device processor1;
auto device message1;

remote int safety_data[2][2] =
    remote(processor1, safety_data, "embedded_divided");

void main() {
    print(safety_data[1][1]);
    printflush(message1);
    stop();
}
