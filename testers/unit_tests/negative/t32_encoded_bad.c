/* MESSAGE: An encoded array can only hold numbers; element 1 \('"two"'\) is not one */
/* encoded can only hold numbers: a string is refused with an error */
auto device message1;
const int a[2] = array("encoded", {1, "two"});
void main() {
    print(a[0]);
    printflush(message1);
    stop();
}
