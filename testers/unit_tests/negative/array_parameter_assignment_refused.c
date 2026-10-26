/*
An array parameter with an OPEN dimension (`int s[]`) arrives as a packed
handle BY VALUE -- a copy of the caller's handle, with its length inside the
packed value. Assigning the parameter itself (`s = b;`) could therefore only
rebind this function's private copy, and the caller's array would keep the
handle it passed: the spelling promises "s is b now" and delivers nothing.
It is refused for the same reason `vecalias(&s, b)` is refused, and the two
shapes below cover both spellings (one parameter, and two).

This is also what keeps the optimizer honest: before the refusal, inlining
`rebind` replaced `s` with the caller's array and turned the line into a real
element copy, while `#pragma noinline` left it a no-op -- a pragma changing
program output.

Writing the ELEMENTS (`s[i] = b[i];`) is the supported way to reach the
caller's array; `check/t167_handle_param_element_write.c` pins that in every
compile mode.

MESSAGE: Cannot assign to array parameter 's': it arrives as a handle BY VALUE
MESSAGE: Cannot assign to array parameter 'a': it arrives as a handle BY VALUE
MESSAGE: leave the caller's array as it was
MESSAGE: Write the elements instead
NOT-MESSAGE: because they are not stored the same way
*/
int other[3] = {1, 2, 3};

void rebind(int s[]) {
    s = other;
}

void swapView(int a[], int b[]) {
    a = b;
}

void main() {
    int m[3] = {5, 6, 7};
    rebind(m);
    swapView(m, other);
}
