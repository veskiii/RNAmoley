import { Chain } from "../utils/types";

export const hideTooltip = () => {
    const tooltip = document.getElementById("tooltip");
    if (tooltip) {
      tooltip.classList.add("hidden");
    }
  };

export const showTooltip = (event: React.MouseEvent, id: number, originalId: number) => {
      const tooltip = document.getElementById("tooltip");
      if (tooltip) {
        tooltip.innerHTML = `
          id: ${id} <br>
          original id: ${originalId}
        `;
        tooltip.classList.remove("hidden");
      }
    };

export const showGraphTooltip = (node_num: string, strand: string, chains: Chain[], hybridizedName: string[]) => {
    const tooltip = document.getElementById("tooltip");  
    if (tooltip) {
        let found_nucleotide;
        if (node_num) {
          console.log(node_num, strand, strand?.slice(-1))
          const numIndex = parseInt(node_num.slice(1), 10);
          console.log("STRAND:", strand)
          let found_chain = chains.find(chain => chain.name === strand);
          console.log("found_chain:", found_chain)
          if (found_chain) {

            found_nucleotide = found_chain.nucleotides[numIndex - 1];
          } else if (hybridizedName.includes(strand)) {
            found_chain = chains.find(chain => chain.name.slice(-1) === strand.slice(-3, -2));
            if (found_chain) {
              let found_nucleotide = found_chain.nucleotides[numIndex - 1];
              if (!found_nucleotide) {
                found_chain = chains.find(chain => chain.name.slice(-1) === strand.slice(-1));
                let prevChain = chains.find(chain => chain.name.slice(-1) === strand.slice(-3, -2));
                if (found_chain && prevChain)
                  found_nucleotide = found_chain.nucleotides[numIndex - (prevChain.sequence.length) - 1];
              }
            }
          }
        }
        tooltip.innerHTML = `
        ${node_num.slice(1)} node in strand ${strand.slice(-1)} <br>
        id: ${found_nucleotide?.index} original id: ${found_nucleotide?.original_index}
        `;
        tooltip.classList.remove("hidden");
      }
    };

 //Ustaw kolor nukleotydu na sekwencji i zmień parametr selected
 export const setColor = (index: number, setChains:React.Dispatch<React.SetStateAction<Chain[]>>, selectedChain:string) => {
    console.log("ustawianie na klik")
    setChains(prevChains =>
      prevChains.map(chain => {
        if (chain.name.slice(-1) === selectedChain) {

          return {
            ...chain,
            nucleotides: chain.nucleotides.map(nucleotide => ({
              ...nucleotide,
              selected: nucleotide.index === index ? !nucleotide.selected : nucleotide.selected,
            })),
          };
        }
        return chain;
      }));
  }

 export const updateFornacSelection = (chains: Chain[], hybridizedName: string[]) => {
    console.log("Aktualizacja klas w grafie");
    chains.forEach(chain => {
      let forna_id = 1;
      chain.nucleotides.forEach(nucleotide => {
        let gNode = document.querySelector(`g.gnode[num="n${forna_id}"][struct_name="${chain.name}"]`);
        if (!gNode) {
          if (hybridizedName.slice(-1).includes(chain.name.slice(-1))) {
            const prevChain = chains.find(chain => hybridizedName.slice(-3, -2).includes(chain.name.slice(-1)))
            const lengthPrevChain = prevChain?.sequence.length;
            if (lengthPrevChain)
              gNode = document.querySelector(`g.gnode[num="n${(forna_id + lengthPrevChain)}"][struct_name="${hybridizedName}"]`);
          }
          else
            gNode = document.querySelector(`g.gnode[num="n${(forna_id)}"][struct_name="${hybridizedName}"]`);
        }
        if (gNode) {
          gNode.setAttribute("class", nucleotide.selected ? "gnode fornac-selectedNode" : "gnode");
        }

        forna_id++;
      });
    });
  };
  