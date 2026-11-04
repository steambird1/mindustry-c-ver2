/* MESSAGE: Variable 'x' is already declared */
/* CODE: E_SEMANTIC_DUPLICATE_VARIABLE */
/* STAGE: semantic */
/* RELATED: first declared here */
/*
A duplicate declaration reports both the second declaration and the first one.
*/
auto device message1;
void main() {
    int x = 1;
    int x = 2;
    print(x);
}
