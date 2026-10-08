/* Must fail: `vecalias` cannot bind into an array that owns its storage.

   A memory array is a block and an offset -- it HAS an address, which is why
   `&mem` is even well formed -- but there is nothing in it that a handle can
   be packed into: a handle is a name, and a name is not a length plus two
   element addresses. Writing the packed value into `mem[0]` would be storing a
   description of an array inside another array, where nothing would read it.

   The advice matters as much as the refusal: the elements CAN be copied, and
   `veccpy` is the call that does it. An array in registers has no address at
   all, so it is refused for the other reason and gets the other message -- one
   check, two answers, because which one you hit tells you which you have.

   A remote array is refused on a third account: its elements are registers of
   another processor, while a handle packs helper entry points of THIS one. */
/* MESSAGE: Cannot vecalias into 'mem': it is an array in memory, and a handle is  */
/* MESSAGE: Cannot vecalias into 'div': it is an array in registers, which has no address to take */
/* MESSAGE: Cannot vecalias into 'ra': a remote array is an element of ANOTHER processor, and a handle here */
extern int r[4] = {1, 2, 3, 4};
remote int ra[4] = remote(@this, r);
int mem[4];
int div[4] = array("embedded_divided");
int a[];
void main() {
    a = mem;
    vecalias(&mem, mem);
    vecalias(&div, mem);
    vecalias(&ra, mem);
}
