/*
Two `case 2:` labels would make the dispatch ambiguous; C requires distinct
integer constant case values.

MESSAGE: Duplicate case value 2 in switch
*/
void main() {
	int x = 1;
	switch (x) {
		case 2: break;
		case 2: break;
	}
}
