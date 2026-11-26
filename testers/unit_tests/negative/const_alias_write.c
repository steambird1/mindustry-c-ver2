/* `const int s[] = b;` makes the VIEW read-only. It is not storage of its own,
   so writing `s[0]` would reach `b` through a name that promised not to. */
/* MESSAGE: it is a read-only alias of 'b' */
int b[3] = {1, 2, 3};

void main() {
    const int s[] = b;
    s[0] = 9;
    print(s[0]);
}
