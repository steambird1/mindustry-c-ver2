/*
C requires an integer controlling expression; `float` is not one.

MESSAGE: A switch needs an integer value, but 'float' is not one
*/
void main() {
	float x = 1.0;
	switch (x) {
		case 1: break;
	}
}
