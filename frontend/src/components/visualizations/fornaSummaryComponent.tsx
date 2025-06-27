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
        directionArrows: directionArrows,
      });
    };

    // Initialize and store the container
    const container = initializeContainer();
    try {
      const hybridizedChains = handleHybridChains(chains);

      // Dodaj standardowe łańcuchy (nie-hybrydowe)
      chains.forEach((chain) => {
        if (!hybridizedChains || chain.sequence !== hybridizedChains.sequence) {
          addRNAtoContainer(container, chain);
        }
      });

      // Dodaj RNA połączony z hybrydyzowanych łańcuchów, jeśli istnieje
      if (hybridizedChains !== null) {
        addRNAtoContainer(container, {
          name: "hybrid",
          sequence: hybridizedChains.sequence,
          dotBracket: hybridizedChains.dotBracket,
          nucleotides: [], // Domyślne wartości
        });
      }
    } catch (error) {
      console.error("Błąd przy dodawaniu RNA:", error);
    }
    setContainer(container);
  }, [chains, labelInterval]); // Emp

  const addRNAtoContainer = (container: any, chain: Chain) => {
    const options = {
      structure: chain.dotBracket,
      sequence: chain.sequence,
      extraLinks: showClashes ? clashMap : [],
    };

    container.addRNA(options.structure, options);

    d3.selectAll('line.link[link_type="external"]').style("stroke", "purple");

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
  const handleHybridChains = (
    chains: Chain[]
  ): { sequence: string; dotBracket: string } | null => {
    const isHybridized = (structure: string): boolean => {
      const countOpeners = Array.from(structure).filter((x) =>
        ["(", "["].includes(x)
      ).length;
      const countClosers = Array.from(structure).filter((x) =>
        [")", "]"].includes(x)
      ).length;
      return countOpeners !== countClosers;
    };

    const hybridizedChains = chains.filter((chain) =>
      isHybridized(chain.dotBracket)
    );

    if (hybridizedChains.length > 2) {
      console.log("Możesz połączyć maksymalnie 2 łańcuchy hybrydowe");
      return null;
    }

    if (hybridizedChains.length === 2) {
      return {
        sequence: hybridizedChains[0].sequence + hybridizedChains[1].sequence,
        dotBracket:
          hybridizedChains[0].dotBracket + hybridizedChains[1].dotBracket,
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
      container.displayDirectionArrows(directionArrows);
      d3.selectAll('line.link[link_type="external"]').style(
        "visibility",
        showClashes ? "visible" : "hidden"
      );
      // @ts-ignore
      setAnimation ? container.startAnimation() : container.stopAnimation();
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
