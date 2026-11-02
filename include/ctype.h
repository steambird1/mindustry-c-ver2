#ifndef _MINDC_CTYPE_H
#define _MINDC_CTYPE_H

/*
The classification functions are ordinary numeric range checks. They accept
the same integer character values as C; EOF (-1) is not a character.
*/
inline int isdigit(int c) { return c >= 48 && c <= 57; }
inline int isxdigit(int c) {
	return (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
}
inline int islower(int c) { return c >= 97 && c <= 122; }
inline int isupper(int c) { return c >= 65 && c <= 90; }
inline int isalpha(int c) { return islower(c) || isupper(c); }
inline int isalnum(int c) { return isalpha(c) || isdigit(c); }
inline int isspace(int c) {
	return c == 32 || (c >= 9 && c <= 13);
}
inline int isblank(int c) { return c == 32 || c == 9; }
inline int iscntrl(int c) { return (c >= 0 && c < 32) || c == 127; }
inline int isprint(int c) { return c >= 32 && c <= 126; }
inline int isgraph(int c) { return c > 32 && c <= 126; }
inline int ispunct(int c) { return isgraph(c) && !isalnum(c); }
inline int tolower(int c) { return isupper(c) ? c + 32 : c; }
inline int toupper(int c) { return islower(c) ? c - 32 : c; }

#endif
