/*
`break` needs something to leave. Outside any loop or switch it used to
compile and emit `jump {loop_break}`, a placeholder no loop ever resolved --
the program then ran away (step limit). Nesting it inside an `if` did not
help: the context is the loop, not the block.

MESSAGE: 'break' can only be used inside a loop or switch
*/
void main() {
	if (1 == 1) break;
}
