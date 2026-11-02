/*
No memory block: a compound-literal array initializer still becomes the
ordinary register-array initializer of the declared array.
*/
/* EXPECT: 7 8 9 1 2 3 7 3 */
auto device message1;

void main() {
    int fixed[3] = (int[]){7, 8, 9};
    int open[] = (int[]){1, 2, 3};
    int designated[] = (int[]){[2] = 7};

    print(fixed[0]);
    print(fixed[1]);
    print(fixed[2]);
    print(open[0]);
    print(open[1]);
    print(open[2]);
    print(designated[2]);
    print(sizeof(designated));

    printflush(message1);
    stop();
}
