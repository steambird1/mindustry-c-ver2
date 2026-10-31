/* MESSAGE: Cannot initialize 'char\*' with a string literal */
/* `char` is a number now, so `char*` is an ordinary writable pointer. A
   string literal is read-only text: a mutable pointer would invite writes to
   it. The clean refusal names both supported forms -- `const char*` for a
   view, or `char a[] = "..."` for a mutable copy. */
auto device message1;
void main() {
    char* p = "hi";
    printflush(message1);
    stop();
}
