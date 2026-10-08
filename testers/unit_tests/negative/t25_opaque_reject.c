/* MESSAGE: Cannot initialize 'item_t' with 'content_t' */
/* opaque content: an implicit conversion is refused, an explicit cast is
   allowed but cannot be folded away */
auto device message1;
void main() {
    item_t bad = @unknownThing;
    printflush(message1);
    stop();
}
