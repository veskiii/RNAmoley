import { isInputValid } from "../../../components/utils/inputValidation";
import { describe, test, expect } from 'vitest';

// describe.concurrent("returns true if only one condition is met", () => {
//     test.each([
//         [null, '', '7KUC', true],
//         [new File([], 'test.pdb'), '', 'None', true],
//         [null, '7KUC', 'None', true],
//     ])("conditions(%i, %s, %s) -> %s", async (a, b, c, expected) => {
//         expect(isInputValid(a, b, c)).toBe(expected);
//     });
// });

      test('returns true if only one condition is met', () => {
        expect(isInputValid(null, '', '7KUC')).toBe(true);
        expect(isInputValid(new File([], 'test.pdb'), '', 'None')).toBe(true);
        expect(isInputValid(null, '7KUC', 'None')).toBe(true);
      });

    test('returns false if no or multiple conditions are met', () => {
        expect(isInputValid(null, '', 'None')).toBe(false);
        expect(isInputValid(new File([], 'test.pdb'), '7KUC', '7KUC')).toBe(false);
        expect(isInputValid(new File([], 'test.pdb'), '', '7KUC')).toBe(false);
        expect(isInputValid(new File([], 'test.pdb'), '7KUC', '')).toBe(false);
        expect(isInputValid(null, '7KUC', '7KUC')).toBe(false);
    });

    test('returns true if pdbCode has exactly 4 characters', () => {
        expect(isInputValid(null, 'ABCD', 'None')).toBe(true);
    });

    test('returns false if pdbCode has more than 4 characters', () => {
        expect(isInputValid(null, 'ABCDE', 'None')).toBe(false);
    });

    test('returns false if pdbCode has less than 4 characters', () => {
        expect(isInputValid(null, 'ABC', 'None')).toBe(false);
    });
