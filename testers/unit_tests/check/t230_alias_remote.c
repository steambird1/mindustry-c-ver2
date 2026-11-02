/*
An alias is a name for the root array, both locally and through remote().
The remote binding resolves to the root and uses the root's element names,
instead of inventing `<alias>_i` registers that do not exist.
*/
/* EXPECT: 2 2 5 5 */
auto device message1;

int base[3] = {1, 2, 3};
int alias[] = base;
remote int localPeer[3] = remote(@this, alias);

extern int ebase[3] = {4, 5, 6};
extern int ealias[] = ebase;
remote int externPeer[3] = remote(@this, ealias);

void main() {
	print(alias[1]);
	print(localPeer[1]);
	print(ealias[1]);
	print(externPeer[1]);
	printflush(message1);
	stop();
}
