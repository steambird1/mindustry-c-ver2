const re = /No version of 'add' accepts these arguments \(int, int, int, int\)/;
const err = "No version of 'add' accepts these arguments (int, int, int, int)";
console.log(re.test(err));
