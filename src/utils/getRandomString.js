/** Generates a random string which can be used for scoped variable names */
export const getRandomString = () => Math.random().toString(36).slice(2);
