auto device message1;
int u[4] = array("embedded_divided", {10,20,30,40});
remote int ru[] = remote(@this, u);
void main(){ int i=2; print(ru[3]); print(ru[i]); printflush(message1); }
