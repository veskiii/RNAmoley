import { Chain, Job, Nucleotide } from "./types";

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
      if ((annotation.sequnece.length !== annotation.dotbracket.length) || annotation.sequnece.length === 0 || annotation.dotbracket.length === 0) {
        throw new Error("Sequence length and dotBracket length are not equal or 0.");
      }
  
      const chain: Chain = {
        name: annotation.name,
        sequence: annotation.sequnece,
        dotBracket: annotation.dotbracket,
        nucleotides: []
      };
  
      for (let i = 0; i < annotation.sequnece.length; i++) {
  
        const numerationKey = Object.keys(job.numeration).find(key => parseInt(key, 10) === id && job.numeration[key][1] === annotation.name.slice(-1));
        if (numerationKey) {
          const nucleotide: Nucleotide = {
            index: parseInt(numerationKey, 10),
            original_index: job.numeration[numerationKey][0],
            base: annotation.sequnece[i],
            structure: annotation.dotbracket[i],
            selected: false,
          };
          chain.nucleotides.push(nucleotide);
          // console.log("Dodano nukleotyd: ", nucleotide);
        }
        // console.log("id:", id);
        // console.log("Dlugość sekwencji: ", annotation.sequnece.length);
        id++;
  
      }
      if (chain.nucleotides.length !== chain.sequence.length) {
        throw new Error("Number of nucleotides do not match length of the sequence.");
      }
      chains.push(chain);
      // console.log("Dodano łańcuch:", chain.name, chain.sequence, chain.dotBracket, chain.nucleotides);
    });
  
    return chains;
  }
  