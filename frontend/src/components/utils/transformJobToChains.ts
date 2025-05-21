import { Chain, Job, Nucleotide, StructuralElement } from "./types";

export function findStructuralElementsForNucleotide(
  elements: StructuralElement[],
  nucleotideIndex: number
): StructuralElement[] {
  if (!elements || elements.length === 0) {
    return [];
  }
  return elements.filter((element) =>
    element.residues?.some(
      (range) =>
        range.start !== undefined &&
        range.end !== undefined &&
        nucleotideIndex >= range.start &&
        nucleotideIndex <= range.end
    )
  );
}

export function transformJobToChains(job: Job): Chain[] {
  const chains: Chain[] = [];

  if (!job.annotation || job.annotation.length === 0) {
    throw new Error("Annotation is undefined or empty.");
  }

  if (!job.numeration || Object.keys(job.numeration).length === 0) {
    throw new Error("Numeration is undefined or empty.");
  }

  let id = 1;
  job.annotation.forEach((annotation) => {
    if (
      annotation.sequnece.length !== annotation.dotbracket.length ||
      annotation.sequnece.length === 0 ||
      annotation.dotbracket.length === 0
    ) {
      throw new Error(
        "Sequence length and dotBracket length are not equal or 0."
      );
    }

    const chain: Chain = {
      name: annotation.name,
      sequence: annotation.sequnece,
      dotBracket: annotation.dotbracket,
      nucleotides: [],
    };

    console.log(job);

    for (let i = 0; i < annotation.sequnece.length; i++) {
      const numerationKey = Object.keys(job.numeration).find(
        (key) =>
          parseInt(key, 10) === id &&
          job.numeration[key][1] === annotation.name.slice(-1)
      );
      // console.log("numeration key: " + numerationKey);
      if (numerationKey) {
        const index = parseInt(numerationKey, 10);
        // TODO: does index continue on different chains
        const structuralElements = findStructuralElementsForNucleotide(
          job.motifs,
          index
        );

        const nucleotide: Nucleotide = {
          index: index,
          original_index: job.numeration[numerationKey][0],
          base: annotation.sequnece[i],
          structure: annotation.dotbracket[i],
          selected: false,
          structuralElements: structuralElements,
        };
        chain.nucleotides.push(nucleotide);
      }
      id++;
    }
    if (chain.nucleotides.length !== chain.sequence.length) {
      throw new Error(
        "Number of nucleotides do not match length of the sequence."
      );
    }
    chains.push(chain);
  });

  return chains;
}
