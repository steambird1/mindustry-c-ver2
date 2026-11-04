/* MESSAGE: cannot target the declaration being defined */
/*
remote(@this, x) needs a separate local owner variable. The declaration being
defined only creates the remote binding, so using its own name as the target
would retry forever.
*/
auto device message1;

remote int safety_data[2] = remote(@this, safety_data, "embedded_divided");

void main() {
    print(safety_data[0]);
    printflush(message1);
    stop();
}
