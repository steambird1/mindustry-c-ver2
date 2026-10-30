/*
A switch has at most one `default`.

MESSAGE: Duplicate 'default' in switch
*/
void main() {
	int x = 1;
	switch (x) {
		default: break;
		default: break;
	}
}
