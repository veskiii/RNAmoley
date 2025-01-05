import { describe, it, expect } from 'vitest';
import { transformJobToChains } from '../../../components/panels/analysisPanel';

describe('transformJobToChains', () => {
  it('poprawne łańcuchy na podstawie danych wejściowych', () => {
    const mockJob = {
      annotation: [
        { name: 'Chain A', sequnece: 'ACGU', dotbracket: '....' },
      ],
      numeration: {
        "1": [501, "A"],
        "2": [502, "A"],
        "3": [503, "A"],
        "4": [504, "A"],
      },
    } as any;

    const chains = transformJobToChains(mockJob);

    expect(chains).toHaveLength(1);
    expect(chains[0].name).toBe('Chain A');
    expect(chains[0].nucleotides).toHaveLength(4);
    expect(chains[0].nucleotides[0]).toEqual({
      index: 1,
      original_index: 501,
      base: 'A',
      structure: '.',
      selected: false,
    });
  });

  it('brakuje annotacji', () => {
    const mockJob = {
      annotation: [],
      numeration: {},
    } as any;

    expect(() => transformJobToChains(mockJob)).toThrow(
      "Annotation is undefined or empty."
    );
  });

  it('sekwencja i struktura są puste', () => {
    const mockJob = {
      annotation: [
        { name: 'Chain A', sequnece: '', dotbracket: '' },
      ],
      numeration: {
        "1": [501, "A"],
        "2": [502, "A"],
        "3": [503, "A"],
        "4": [504, "A"],
      },
    } as any;

    expect(() => transformJobToChains(mockJob)).toThrow(
      "Sequence length and dotBracket length are not equal or 0."
    );
  });

  it('numeracja jest pusta', () => {
    const mockJob = {
      annotation: [
        { name: 'Chain A', sequnece: 'AAA', dotbracket: '...' },
      ],
      numeration: {},
    } as any;

    expect(() => transformJobToChains(mockJob)).toThrow(
      "Numeration is undefined or empty."
    );
  });

  it('długość sekwencji i struktury nie jest zgodna', () => {
    const mockJob = {
      annotation: [
        { name: 'Chain A', sequnece: 'AGCT', dotbracket: '...' },
      ],
      numeration: {
        "1": [501, "A"],
        "2": [502, "A"],
        "3": [503, "A"],
        "4": [504, "A"],
      },
    } as any;

    expect(() => transformJobToChains(mockJob)).toThrow(
      "Sequence length and dotBracket length are not equal or 0."
    );
  });
  it('długość sekwencji i struktury są zgodne, ale numeracja jest niezgodna', () => {
    const mockJob = {
      annotation: [
        { name: 'Chain A', sequnece: 'AGCT', dotbracket: '....' },
      ],
      numeration: {
        "1": [501, "A"],
        "2": [502, "A"],
      },
    } as any;

    expect(() => transformJobToChains(mockJob)).toThrow(
      "Number of nucleotides do not match length of the sequence."
    );
  });
  it('Numeracja jest nie pokolei', () => {
    const mockJob = {
      annotation: [
        { name: 'Chain A', sequnece: 'AGCT', dotbracket: '....' },
      ],
      numeration: {
        "1": [501, "A"],
        "2": [502, "A"],
        "5": [503, "A"],
        "8": [504, "A"],
      },
    } as any;

    expect(() => transformJobToChains(mockJob)).toThrow(
      "Number of nucleotides do not match length of the sequence."
    );
  });

  it('Różne łańcuchy', () => {
    const mockJob = {
      annotation: [
        { name: 'Chain A', sequnece: 'ACG', dotbracket: '...' },
        { name: 'Chain B', sequnece: 'AUGCGU', dotbracket: '.()...' },
        { name: 'Chain C', sequnece: 'A', dotbracket: '.' },
      ],
      numeration: {
        "1": [501, "A"],
        "2": [502, "A"],
        "3": [503, "A"],
        "4": [602, "B"],
        "5": [603, "B"],
        "6": [604, "B"],
        "7": [605, "B"],
        "8": [606, "B"],
        "9": [607, "B"],
        "10": [608, "C"],
      },
    } as any;

    const chains = transformJobToChains(mockJob);
    expect(chains).toHaveLength(3);
  });

  it('duże zestawy danych', () => {
    const mockJob = {
      annotation: [
        { name: 'Chain A', sequnece: 'A'.repeat(10000), dotbracket: '.'.repeat(10000) },
      ],
      numeration: Object.fromEntries(
        Array.from({ length: 10000 }, (_, i) => [`${i + 1}`, [500 + i, "A"]])
      ),
    } as any;

    const chains = transformJobToChains(mockJob);

    expect(chains).toHaveLength(1);
    expect(chains[0].nucleotides).toHaveLength(10000);
  });

});
