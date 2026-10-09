/* MESSAGE: is a binding form, not a value */
/* NOT-MESSAGE: expects 0 arguments */

/* docs/OPEN_WORK.md 7.3: `remote()` names another processor's variable and is
   only meaningful as the initializer of a `remote`-qualified declaration
   (`remote int x = remote(...)`, covered by t98 / t99 / t107 and friends).
   It is not a value: the machine language has no instruction that yields one.

   The two shapes below are the ones that used to be wrong. The first is the
   form the record names: it reached the ordinary function-call walk, which
   read the expected type of an argument against a parameter list that does
   not exist (`remote` is a vararg builtin with none), and threw with an
   EMPTY error list -- so `errors` looked exactly like a clean refusal. The
   second is looser: it would have been accepted outright if the call were
   typed `void*` (the declared return), because `void*` -> `void*` needs no
   conversion, and it then reached the generator as `{not_implemented}`.

   That is why the refusal is here, at the call, and not left to the
   assignment's conversion check: the conversion check cannot see the void*
   case, and an array or a struct pointer target behaves the same way. The
   call is refused whatever it is being assigned to. */

int r[3];

void main() {
    int m;
    void *vm;
    m = remote(@this, r);
    vm = remote(@this, r);
    print(m);
}