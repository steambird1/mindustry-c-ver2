/* MESSAGE: 'u' is not declared here, so remote\(\) cannot know how long the array o */
/* `remote(processor1, u)` names the variable u on the other processor. Nothing
   here declares it, so the length is unknown -- and an array cannot be reached
   element by element without one. */
auto device processor1;
remote int ru[] = remote(processor1, u);
void main() { print(ru[0]); }
