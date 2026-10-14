/**
 * Exercise 1: Find Duplicate Numbers
 * Given an array of integers, return all numbers that appear more than once.
 * Each duplicate should appear only once in the result.
 */
export function findDuplicates(nums: number[]): number[] {
  const seen = new Set<number>();
  const duplicates = new Set<number>();

  for (const num of nums) {
    if (seen.has(num)) {
      duplicates.add(num); // Found a duplicate!
    } else {
      seen.add(num); // First time seeing this number
    }
  }

  return Array.from(duplicates);
}

/**
 * Exercise 2: Longest Substring Without Repeating Characters
 * Given a string, find the length of the longest substring without repeated characters.
 */
export function lengthOfLongestSubstring(s: string): number {
  let maxLength = 0;
  let start = 0;
  const charMap = new Map<string, number>();

  for (let end = 0; end < s.length; end++) {
    const char = s[end];

    // If we see a character inside our current window again, slide the start forward
    if (charMap.has(char) && charMap.get(char)! >= start) {
      start = charMap.get(char)! + 1;
    }

    charMap.set(char, end);
    maxLength = Math.max(maxLength, end - start + 1);
  }

  return maxLength;
}

/**
 * Exercise 3: Group Anagrams
 * Given an array of strings, group words that are anagrams of one another.
 */
export function groupAnagrams(strs: string[]): string[][] {
  const groups = new Map<string, string[]>();

  for (const str of strs) {
    // Sort letters alphabetically (e.g., "eat" becomes "aet")
    const sortedKey = str.split('').sort().join('');

    if (!groups.has(sortedKey)) {
      groups.set(sortedKey, []);
    }

    groups.get(sortedKey)!.push(str);
  }

  return Array.from(groups.values());
}
