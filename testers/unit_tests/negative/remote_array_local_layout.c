/* MESSAGE: A remote array needs a remote */
/* CODE: E_REMOTE_ARRAY_LOCAL_LAYOUT */
/* STAGE: semantic */
/* LINE: 13 */
/* HINT: use remote\(device */
/*
array(...) describes local storage. A remote array must name its device and
target with remote(device, name[, layout]); otherwise code generation leaves
an uninitialised handle.
*/
auto device message1;

remote int a[2] = array("embedded_lookup");

void main() {
    a[1] = 7;
    print(a[1]);
    printflush(message1);
    stop();
}
