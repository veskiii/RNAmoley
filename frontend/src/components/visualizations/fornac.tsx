import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import Loading from "../common/loading";
import { Chain } from "../utils/types";

declare const fornac: any;

const FornaComponent = ({
  chains,
  setChains,
  labelInterval,
  numbering,
  nodeOutline,
  nodeLabel,
  links,
  directionArrows,
  setAnimation,
  setHybridizedName,
}: {
  chains: Chain[];
  setChains: React.Dispatch<React.SetStateAction<Chain[]>>;
  labelInterval: number;
  numbering: boolean;
  nodeOutline: boolean;
  nodeLabel: boolean;
  links: boolean;
  directionArrows: boolean;
  setAnimation: boolean;
  setHybridizedName: Dispatch<SetStateAction<string[]>>;
}) => {
  const error = null;
  const [width, setWidth] = useState(window.innerWidth);
  const [height, setHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => { setWidth(window.innerWidth); setHeight(window.innerHeight) };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);

  }, []);
  
  useEffect(() => {
    const container = new fornac.FornaContainer("#rna_ss", {
      animation: setAnimation,
      zoomable: true,
      labelInterval: labelInterval,
      initialSize: [width, (height + 150)],
      numbering: numbering,
      nodeOutline: nodeOutline,
      nodeLabel: nodeLabel,
      links: links,
      directionArrows: directionArrows,
    });

    const isHybridized = (structure: string): boolean => {
      const count_openers = Array.from(structure).filter(x => (x === "(" || x === "[")).length
      const count_closers = Array.from(structure).filter(x => (x === ")" || x === "]")).length
      if (count_openers !== count_closers)
        return true;
      return false;
    };

    const hybridized_chains: Chain[] = [];

    chains.forEach((chain) => {
      if (isHybridized(chain.dotBracket)) {
        hybridized_chains.push(chain);
      }
    });

    try {
      const uniqueStructures = new Set(hybridized_chains.map(chain => chain.dotBracket));
      if (uniqueStructures.size !== hybridized_chains.length) {
        throw new Error("Duplicate hybridized structures detected. All hybridized structures must be unique.");
      }

      const hybridizedPairs: [Chain, Chain][] = [];
      for (let i = 0; i < hybridized_chains.length; i++) {
        for (let j = i + 1; j < hybridized_chains.length; j++) {
          const chainA = hybridized_chains[i];
          const chainB = hybridized_chains[j];

          const combinedStructure = chainA.dotBracket + chainB.dotBracket;
          const combinedOpeners = Array.from(combinedStructure).filter(x => x === "(" || x === "[").length;
          const combinedClosers = Array.from(combinedStructure).filter(x => x === ")" || x === "]").length;

          if (combinedOpeners === combinedClosers) {
            hybridizedPairs.push([chainA, chainB]);
          }
        }
      }

      chains.forEach((chain) => {
        if (!hybridizedPairs.some(([chainA, chainB]) => chain === chainA || chain === chainB)) {
          const options = {
            structure: chain.dotBracket,
            sequence: chain.sequence,
            name: chain.name,
          }
          container.addRNA(options.structure, options);
        }
      });
      hybridizedPairs.forEach(([chainA, chainB]) => {
        const merged_sequence = chainA.sequence + chainB.sequence;
        const merged_structure = chainA.dotBracket + chainB.dotBracket;
        const options = {
          structure: merged_structure,
          sequence: merged_sequence,
          name: "hybrydized_" + hybridized_chains[0].name.slice(-1) + "-" + hybridized_chains[1].name.slice(-1)
        }
        container.addRNA(options.structure, options);
        setHybridizedName([options.name]);

        [chainA, chainB].forEach((chain, index) => {
          chain.nucleotides.forEach((nucleotide) => {
            const gNode = document.querySelector(`g.gnode[num="n${nucleotide.index}"][struct_name="${options.name}"]`);

            if (gNode) {
              const circle = gNode.querySelector(`circle.fornac-node[node_num="${nucleotide.index}"]`);

              if (circle) {
                const title = circle.querySelector("title");

                if (title) {
                  title.textContent = `${chain.name} ${nucleotide.index}`;
                }
              }
              gNode.setAttribute("struct_name", `${chain.name}`);
              if (chain === chainB && circle) {
                gNode.setAttribute("num", `n${(nucleotide.index - chainA.sequence.length)}`);
                circle.setAttribute("node_num", `${(nucleotide.index - chainA.sequence.length)}`);
              }

            }
          });
        });
      });
      // @ts-expect-error
      const rnaValues = Object.values(container.rnas)[0].nodes;
      if (!rnaValues.length) {
        throw new Error("No valid RNA nodes found in container.");
      }

    } catch (error) {
      console.error("Failed to add RNA:", error);
      let rnaContainer = document.getElementById("rna_ss") as HTMLElement;
      rnaContainer.setAttribute("style", "color:red; padding:10px;");
      rnaContainer.innerHTML = `<div><p>Failed to visualize RNA</p><p>${error}</p></div>`;
    }
    let loadingElement = document.getElementById(
      "containerLoadingText"
    ) as HTMLElement;
    loadingElement.style.display = "none";

    container.displayNumbering(numbering);

    container.displayNodeOutline(nodeOutline);

    container.displayNodeLabel(nodeLabel);

    container.displayLinks(links);

    container.displayDirectionArrows(directionArrows);

    setAnimation ? container.startAnimation() : container.stopAnimation();

    return () => {

    };
  }, [
    labelInterval,
    numbering,
    nodeOutline,
    nodeLabel,
    links,
    directionArrows,
    setAnimation,
  ]);

  return (
    <div >
      {error ? (
        <div className="text-red-500 p-4 bg-red-100 border border-red-300 rounded">
          <p>${error}</p>
        </div>
      ) : (
        <>
          <div
            id="rna_ss"
          >
            <div id="tooltip"
              className="hidden absolute mt-2 right-2 bg-teal-500 text-white text-xs rounded px-2 py-1 z-50"
            ></div>
          </div>

          <div id="containerLoadingText" className="p-2">
            <Loading />
          </div>
        </>
      )}
    </div>
  );
};

export default FornaComponent;
