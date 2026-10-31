/* MESSAGE: printf format must be a string literal */
/* The builtin parses the format at compile time; a runtime format is not
   supported because mlog has no printf-style formatter. */
auto device message1;
string_t fmt = "%d";
void main() {
    printf(fmt, 1);
    printflush(message1);
    stop();
}
