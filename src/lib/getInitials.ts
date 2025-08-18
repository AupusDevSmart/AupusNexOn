/**
 * Returns the initials of a given name.
 * If the name consists of a single word, it returns the first two letters of that word.
 * If the name consists of multiple words, it returns the first letter of the first two words.
 * The result is always in uppercase.
 *
 * @param {string} name - The full name to extract initials from.
 * @return {string | undefined} The initials of the name or undefined if the name is not provided.
 */
export const getInitials = (name: string): string | undefined => {
  if (!name) return;

  const names = name.split(' ');
  if (names.length === 1) {
    return names[0].substring(0, 2).toUpperCase();
  } else {
    return names
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }
};