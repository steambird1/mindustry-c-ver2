/* MESSAGE: 'rc' is itself remote: remote\(\) cannot chain through two processors */
/* Must fail: remote() cannot chain -- a variable that is itself remote has no
   register of its own on this side to point the second binding at. */
auto device message1;
extern int c = 5;
remote int rc = remote(@this, c);
remote int rc2 = remote(@this, rc);
void main() { print(rc2); printflush(message1); }
