import React, { useEffect, useState } from "react";
import * as d3 from "d3";
import { SummaryJob, Nucleotide, Chain } from "../utils/types";

declare const fornac: any;

// interface Nucleotide {
//   index: number;
//   original_index: number;
//   base: string;
//   structure: string;
//   selected: boolean;
// }

// interface Chain {
//   name: string;
//   nucleotides: Nucleotide[];
//   sequence: string;
//   dotBracket: string;
// }

const FornacSummaryComponent = ({
  sequences,
  structures,
  clashMap,
  chains,
  setChains,
  labelInterval,
  numbering,
  nodeOutline,
  nodeLabel,
  links,
  showClashes,
  directionArrows,
  setAnimation,
  job,
  colorGnodes,
}: {
  sequences: string[];
  structures: string[];
  clashMap: any;
  chains: Chain[];
  setChains: React.Dispatch<React.SetStateAction<Chain[]>>;
  labelInterval: number;
  numbering: boolean;
  nodeOutline: boolean;
  nodeLabel: boolean;
  links: boolean;
  showClashes: boolean;
  directionArrows: boolean;
  setAnimation: boolean;
  job: SummaryJob;
  colorGnodes: () => void;
}) => {
  const [container, setContainer] = useState(null);

  useEffect(() => {
    const initializeContainer = () => {
      return new fornac.FornaContainer("#rna_ss", {
        animation: setAnimation,
        zoomable: true,
        labelInterval: labelInterval,
        initialSize: [100, 40],
        numbering: numbering,
        nodeOutline: nodeOutline,
        nodeLabel: nodeLabel,
        links: links,
        directionArrows: false,
      });
    };

    d3.select("#rna_ss").selectAll("*").remove();

    // Initialize and store the container
    const container = initializeContainer();
    try {
      const hybridizedChains = handleHybridChains(chains);

      // Dodaj standardowe łańcuchy (nie-hybrydowe)
      chains.forEach((chain) => {
        const isHybridSourceChain =
          hybridizedChains?.sourceChainNames.includes(chain.name) ?? false;

        if (!isHybridSourceChain) {
          addRNAtoContainer(container, chain);
        }
      });

      // Dodaj RNA połączony z hybrydyzowanych łańcuchów, jeśli istnieje
      if (hybridizedChains !== null) {
        addRNAtoContainer(container, {
          name: "hybrid",
          original_name: "hybrid",
          sequence: hybridizedChains.sequence,
          dotBracket: hybridizedChains.dotBracket,
          nucleotides: [], // Domyślne wartości
        });
      }
    } catch (error) {
      console.error("Błąd przy dodawaniu RNA:", error);
    }
    setContainer(container);

    colorGnodes();
  }, [chains, labelInterval, showClashes]); // Emp

  const addRNAtoContainer = (container: any, chain: Chain) => {
    const normalizedStructure = normalizeDotBracket(chain.dotBracket);

    if (normalizedStructure !== chain.dotBracket) {
      console.warn(
        `Chain ${chain.name} had invalid/unbalanced dot-bracket structure; sanitized before rendering`,
        chain.dotBracket
      );
    }

    const options = {
      structure: normalizedStructure,
      sequence: chain.sequence,
      extraLinks: showClashes ? clashMap : [],
    };

    container.addRNA(options.structure, options);

    const createZigzagPath = (x1: number, y1: number, x2: number, y2: number) => {
      const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const segments = Math.max(4, Math.floor(length / 8));
      const amplitude = 1;
      
      let path = `M${x1},${y1}`;
      
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const x = x1 + t * (x2 - x1);
        const y = y1 + t * (y2 - y1);
        
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lineLength = Math.sqrt(dx * dx + dy * dy);
        const perpX = (-dy / lineLength) * amplitude;
        const perpY = (dx / lineLength) * amplitude;
        
        const offset = (i % 2 === 0) ? 1 : -1;
        path += ` L${x + offset * perpX},${y + offset * perpY}`;
      }
      
      path += ` L${x2},${y2}`;
      return path;
    };

    d3.selectAll('line.link[link_type="external"]')
      .each(function() {
        const line = d3.select(this);
        const x1 = parseFloat(line.attr("x1"));
        const y1 = parseFloat(line.attr("y1"));
        const x2 = parseFloat(line.attr("x2"));
        const y2 = parseFloat(line.attr("y2"));
        
        if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
          const zigzagPath = createZigzagPath(x1, y1, x2, y2);
          
          const parentElement = (this as Element).parentNode as Element;
          if (parentElement) {
            d3.select(parentElement)
              .append("path")
              .attr("d", zigzagPath)
              .attr("class", "clash-zigzag")
              .style("stroke", "purple")
              .style("stroke-width", "1.5px")
              .style("fill", "none")
              .style("stroke-linecap", "round");
          }
          
          line.remove();
        }
      });

    var nodes = d3.selectAll("circle.fornac-node");
    nodes.select("title").text("No data");
    // Aktualizacja węzłów D3 na podstawie `nucleotide` w `chain`
    chain.nucleotides.forEach((nucleotide, index) => {
      if (index <= job.results.data.length - 1) {
        d3.select(`circle.fornac-node[node_num="${index + 1}"]`)
          .select("title")
          .text(
            `Residue number: ${nucleotide.index}\n${ job.results.data[index].metrics ? (`Clash score: ${job.results.data[index].metrics.clashscore}\nBad angles: ${job.results.data[index].metrics.pct_badangles}\nBad bonds: ${job.results.data[index].metrics.pct_badbonds}`) : '' }`
          );

        d3.selectAll("text.fornac-nodeLabel")
          .filter(function () {
            return d3.select(this).text() === `${index + 1}`;
          })
          .text(`${nucleotide.original_index}`);
      }
    });
  };

  /**
   * **Identyfikacja i łączenie łańcuchów hybrydowych**
   */
  const normalizeDotBracket = (structure: string): string => {
    const openerToCloser: Record<string, string> = {
      "(": ")",
      "[": "]",
      "{": "}",
      "<": ">",
    };
    const closerToOpener: Record<string, string> = {
      ")": "(",
      "]": "[",
      "}": "{",
      ">": "<",
    };

    const chars = Array.from(structure);
    const stack: Array<{ char: string; idx: number }> = [];

    chars.forEach((ch, idx) => {
      if (openerToCloser[ch]) {
        stack.push({ char: ch, idx });
        return;
      }

      if (!closerToOpener[ch]) {
        return;
      }

      const top = stack[stack.length - 1];
      if (!top || top.char !== closerToOpener[ch]) {
        chars[idx] = ".";
        return;
      }

      stack.pop();
    });

    while (stack.length > 0) {
      const unmatched = stack.pop();
      if (unmatched) {
        chars[unmatched.idx] = ".";
      }
    }

    return chars.join("");
  };


  const handleHybridChains = (
    chains: Chain[]
  ):
    | {
        sequence: string;
        dotBracket: string;
        sourceChainNames: string[];
      }
    | null => {
    const isHybridized = (structure: string): boolean => {
      const countOpeners = Array.from(structure).filter((x) =>
        ["(", "[", "{", "<"].includes(x)
      ).length;
      const countClosers = Array.from(structure).filter((x) =>
        [")", "]", "}", ">"].includes(x)
      ).length;
      return countOpeners !== countClosers;
    };

    const hybridizedChains = chains.filter((chain) =>
      isHybridized(chain.dotBracket)
    );

    if (hybridizedChains.length >= 2) {
      return {
        sequence: hybridizedChains.map((chain) => chain.sequence).join(""),
        dotBracket: hybridizedChains.map((chain) => chain.dotBracket).join(""),
        sourceChainNames: hybridizedChains.map((chain) => chain.name),
      };
    }

    return null;
  };

  useEffect(() => {
    if (container) {
      // Wyświetl parametry kontenera
      // @ts-ignore
      container.displayNumbering(numbering);
      // @ts-ignore
      container.displayNodeOutline(nodeOutline);
      // @ts-ignore
      container.displayNodeLabel(nodeLabel);
      // @ts-ignore
      //   container.displayLinks(links);
      d3.selectAll('line.link:not([link_type="external"])').style(
        "visibility",
        links ? "visible" : "hidden"
      );
      // @ts-ignore
      container.displayDirectionArrows(false);
      d3.selectAll('line.link[link_type="external"]').style(
        "visibility",
        showClashes ? "visible" : "hidden"
      );
      d3.selectAll("path.clash-zigzag").style(
        "visibility",
        showClashes ? "visible" : "hidden"
      );
      // @ts-ignore
      setAnimation ? container.startAnimation() : container.stopAnimation();

      colorGnodes();
    }
  }, [
    labelInterval,
    numbering,
    nodeOutline,
    nodeLabel,
    links,
    showClashes,
    directionArrows,
    setAnimation,
  ]);

  return <div className="w-full h-full" id="rna_ss"></div>;
};
export default FornacSummaryComponent;
