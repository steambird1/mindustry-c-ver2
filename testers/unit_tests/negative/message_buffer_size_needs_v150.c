/* MESSAGE: @bufferSize requires v150 */
/* VERSION: 149 */
/* A message board's text length is read with `sensor msg @bufferSize`, which
   arrived with the v150 string/message instructions. */
auto device message1;
void main() {
    print(sensor(message1, @bufferSize));
    printflush(message1);
    stop();
}
