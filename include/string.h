#ifndef _MINDC_STRING_H
#define _MINDC_STRING_H

/*
Native Mindustry strings and C character data are different things:

  string_t    one cell, an immutable machine string value;
  char        one cell, an ordinary character/number;
  char*       an ordinary pointer to char cells (a C buffer).

A string_view is a read-only, length-bounded view over either a string_t or a
message building. It is the safe result of "concatenating" text into a message
board: the board is the destination, and the view keeps its length because a
message has no NUL terminator.

Character-level operations need v150 or newer (string indexing, @size /
@bufferSize, read from a string/message, printchar). On older targets only the
output-only concat_print() is available.
*/

struct string_view {
	null_t source;		// string_t value, message building, or memory block
	int base;			// first character index
	int length;			// number of characters
};
typedef struct string_view string_view;

/*
C character-buffer helpers. These are ordinary loops over NUL-terminated
`char` arrays and work on every target version. They take `char*`, not
`string_t`; a native string is not addressable.
*/
inline int strlen(const char* s) {
	int i = 0;
	while (s[i] != 0) i++;
	return i;
}

inline void strcpy(char* dst, const char* src) {
	int i = 0;
	while ((dst[i] = src[i]) != 0) i++;
}

inline void strcat(char* dst, const char* src) {
	int i = 0;
	int j = 0;
	while (dst[i] != 0) i++;
	while ((dst[i] = src[j]) != 0) {
		i++;
		j++;
	}
}

inline int strcmp(const char* a, const char* b) {
	int i = 0;
	while (a[i] == b[i] && a[i] != 0) i++;
	return a[i] - b[i];
}

inline char* strncpy(char* dst, const char* src, unsigned n) {
	unsigned i = 0;
	while (i < n && src[i] != 0) {
		dst[i] = src[i];
		i++;
	}
	while (i < n) {
		dst[i] = 0;
		i++;
	}
	return dst;
}

inline char* strncat(char* dst, const char* src, unsigned n) {
	unsigned i = 0, j = 0;
	while (dst[i] != 0) i++;
	while (j < n && src[j] != 0) {
		dst[i] = src[j];
		i++;
		j++;
	}
	dst[i] = 0;
	return dst;
}

inline int strncmp(const char* a, const char* b, unsigned n) {
	unsigned i = 0;
	while (i < n && a[i] == b[i] && a[i] != 0) i++;
	if (i >= n) return 0;
	return a[i] - b[i];
}

inline char* strchr(const char* s, int c) {
	while (*s != 0) {
		if (*s == c) return (char*)s;
		s++;
	}
	return c == 0 ? (char*)s : null;
}

inline char* strrchr(const char* s, int c) {
	const char* found = null;
	while (*s != 0) {
		if (*s == c) found = s;
		s++;
	}
	if (c == 0) found = s;
	return (char*)found;
}

inline char* strstr(const char* haystack, const char* needle) {
	if (*needle == 0) return (char*)haystack;
	while (*haystack != 0) {
		const char* h = haystack;
		const char* n = needle;
		while (*n != 0 && *h == *n) {
			h++;
			n++;
		}
		if (*n == 0) return (char*)haystack;
		haystack++;
	}
	return null;
}

inline int memcmp(const void* a, const void* b, unsigned n) {
	const char* x = (const char*)a;
	const char* y = (const char*)b;
	unsigned i = 0;
	while (i < n && x[i] == y[i]) i++;
	return i >= n ? 0 : x[i] - y[i];
}

inline void* memmove(void* dst, const void* src, unsigned n) {
	char* d = (char*)dst;
	const char* s = (const char*)src;
	if (d < s) {
		unsigned i = 0;
		while (i < n) {
			d[i] = s[i];
			i++;
		}
	} else if (d > s) {
		while (n > 0) {
			n--;
			d[n] = s[n];
		}
	}
	return dst;
}

#ifndef _MINDC_MEMSET_DEFINED
#define _MINDC_MEMSET_DEFINED 1
inline void* memset(void* dst, int c, unsigned n) {
	char* d = (char*)dst;
	unsigned i = 0;
	while (i < n) {
		d[i] = (char)c;
		i++;
	}
	return dst;
}
#endif

#if __MINDC_TARGET_VERSION__ >= 150

string_view sv_of_string(string_t s) {
	string_view v;
	v.source = s;
	v.base = 0;
	v.length = sensor(s, @size);
	return v;
}

string_view sv_of_message(device m) {
	string_view v;
	v.source = m;
	v.base = 0;
	v.length = sensor(m, @bufferSize);
	return v;
}

char sv_at(string_view v, int i) {
	return read(v.source, v.base + i);
}

int sv_len(string_view v) {
	return v.length;
}

void sv_print(string_view v) {
	int i;
	for (i = 0; i < v.length; i++) {
		printchar(sv_at(v, i));
	}
}

/*
Copy a and b into the message board `msg`, flush it, and return a live view of
its text. One message building is the destination; there is no hidden
allocation, and the view is invalidated when the board is overwritten.
*/
string_view concat_to_message(device msg, string_t a, string_t b) {
	string_view va = sv_of_string(a);
	string_view vb = sv_of_string(b);
	int i;
	/* Flush first, so text already buffered for other output is not glued on. */
	printflush(msg);
	for (i = 0; i < va.length; i++) printchar(sv_at(va, i));
	for (i = 0; i < vb.length; i++) printchar(sv_at(vb, i));
	printflush(msg);
	return sv_of_message(msg);
}

string_view concat_to_message(device msg, string_view a, string_view b) {
	int i;
	printflush(msg);
	for (i = 0; i < a.length; i++) printchar(sv_at(a, i));
	for (i = 0; i < b.length; i++) printchar(sv_at(b, i));
	printflush(msg);
	return sv_of_message(msg);
}

#else

/*
Before v150 there is no character-level read/print. The two native strings can
still be emitted in order; the result is only the message board, with no view.
*/
void concat_print(device msg, string_t a, string_t b) {
	print(a);
	print(b);
	printflush(msg);
}

#endif

#endif
