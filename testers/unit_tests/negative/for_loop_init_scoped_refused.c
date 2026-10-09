/* MESSAGE: Undeclared identifier 'i' */
/* docs/OPEN_WORK.md 7.2: the declaration in `for (int i = 0; ...)` lives in
   the LOOP's own scope, so a use after the loop is refused -- `i` never
   leaks. (An enclosing scope may still declare its own `i`: the loop's
   scope shadows it, exactly like a nested block. See t163_for_clauses.c.) */
auto device message1;
void main() {
    for (int i = 0; i < 3; i++) print(i);
    print(i);
    printflush(message1);
    stop();
}