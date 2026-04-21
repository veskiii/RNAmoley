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


  const resolveChainId = (item: any): string | undefined =>
    item.auth_chain_id ?? item.label_chain_id ?? item.moley_chain_id;

  // create chain
  // get all chain ids from numeration (with fallbacks for mmCIF-only payloads)
  const chainIds = new Set<string>();
  Object.values(job.numeration).forEach((item) => {
    const resolvedChainId = resolveChainId(item);
    if (resolvedChainId) {
      chainIds.add(resolvedChainId);
    }
  });

  // for each chain id create chain
  chainIds.forEach((chainId) => {
    const annotationForChain = job.annotation.find(
      (ann) => ann.name === chainId
    );
    const chain: Chain = {
      name: chainId,
      original_name: chainId,
      sequence: annotationForChain ? annotationForChain.sequnece : "",
      dotBracket: annotationForChain ? annotationForChain.dotbracket : "",
      nucleotides: [],
    };

    // get all nucleotides from numeration with this chain id
    Object.keys(job.numeration).forEach((key) => {
      const item = job.numeration[Number(key)];
      if (resolveChainId(item) === chainId) {
        // for each nucleotide create nucleotide
        const nucleotide: Nucleotide = {
          index: item.annotator_residue_number,
          original_index:
            item.auth_residue_number ??
            item.label_residue_number ??
            item.annotator_residue_number,
          base: item.annotator_nucleotide_name,
          structure: item.annotator_dotbracket,
          selected: false,
          structuralElements: [],
        };

        // find structural elements for this nucleotide
        nucleotide.structuralElements = findStructuralElementsForNucleotide(
          job.motifs,
          nucleotide.index
        );

        chain.nucleotides.push(nucleotide);
      }
    });

    chains.push(chain);
  });

  return chains;
}