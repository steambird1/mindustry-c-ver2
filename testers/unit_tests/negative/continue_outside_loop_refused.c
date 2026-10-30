/*
`continue` needs a loop to continue. Outside one it used to emit
`jump {loop_continue}` with nothing to resolve it, and the program ran away
(step limit) instead of being refused.

MESSAGE: 'continue' can only be used inside a loop
*/
void main() {
	continue;
}
