import {
  findDuplicates,
  lengthOfLongestSubstring,
  groupAnagrams,
} from './exercises';

describe('Part 1: Algorithmic Problems', () => {
  describe('Exercise 1: Find Duplicate Numbers', () => {
    it('should return numbers appearing more than once', () => {
      expect(findDuplicates([1, 2, 3, 2, 4, 5, 1])).toEqual([2, 1]);
    });

    it('should return an empty array when there are no duplicates', () => {
      expect(findDuplicates([1, 2, 3, 4])).toEqual([]);
    });

    it('should return each duplicate only once even if repeated multiple times', () => {
      expect(findDuplicates([5, 5, 5, 5, 2, 2, 1])).toEqual([5, 2]);
    });

    it('should handle an empty array', () => {
      expect(findDuplicates([])).toEqual([]);
    });

    it('should handle negative numbers and zero', () => {
      expect(findDuplicates([-1, 0, -1, 0, 3])).toEqual([-1, 0]);
    });
  });

  describe('Exercise 2: Longest Substring Without Repeating Characters', () => {
    it('should return 3 for "abcabcbb"', () => {
      expect(lengthOfLongestSubstring('abcabcbb')).toBe(3);
    });

    it('should return 1 for "bbbbb"', () => {
      expect(lengthOfLongestSubstring('bbbbb')).toBe(1);
    });

    it('should return 3 for "pwwkew"', () => {
      expect(lengthOfLongestSubstring('pwwkew')).toBe(3);
    });

    it('should return 0 for an empty string', () => {
      expect(lengthOfLongestSubstring('')).toBe(0);
    });

    it('should return length of the string when all characters are unique', () => {
      expect(lengthOfLongestSubstring('abcdef')).toBe(6);
    });

    it('should handle strings with spaces and special characters', () => {
      expect(lengthOfLongestSubstring('a b c a')).toBe(3);
    });
  });

  describe('Exercise 3: Group Anagrams', () => {
    it('should group anagrams properly', () => {
      const result = groupAnagrams(['eat', 'tea', 'tan', 'ate', 'nat', 'bat']);
      const sortedResult = result
        .map((group) => [...group].sort())
        .sort((a, b) => a[0].localeCompare(b[0]));

      const expected = [
        ['ate', 'eat', 'tea'].sort(),
        ['bat'].sort(),
        ['nat', 'tan'].sort(),
      ].sort((a, b) => a[0].localeCompare(b[0]));

      expect(sortedResult).toEqual(expected);
    });

    it('should handle empty input array', () => {
      expect(groupAnagrams([])).toEqual([]);
    });

    it('should handle single empty string or single word', () => {
      expect(groupAnagrams([''])).toEqual([['']]);
      expect(groupAnagrams(['a'])).toEqual([['a']]);
    });

    it('should group words with no common anagrams separately', () => {
      const result = groupAnagrams(['cat', 'dog', 'bird']);
      expect(result.length).toBe(3);
    });
  });
});
