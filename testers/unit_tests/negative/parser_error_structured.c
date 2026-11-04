/* MESSAGE: Expected ';' */
/* CODE: E_PARSE_EXPECTED_TOKEN */
/* STAGE: parser */
/* LINE: 12 */
/* FIX: ; */
/*
A parser diagnostic is a structured object: the code identifies the reason and
the line/column place it even though the displayed message is only one line.
*/
auto device message1;
void main() {
    int x = 1 print(x);
}
