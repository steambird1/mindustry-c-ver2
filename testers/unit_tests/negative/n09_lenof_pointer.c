/* MESSAGE: lenof\(\) needs an array, but 'p' is not one */
auto device message1;
int *p;
void main() { print(lenof(p)); printflush(message1); stop(); }
