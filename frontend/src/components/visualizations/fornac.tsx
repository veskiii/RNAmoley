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
    const handleResize = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const container = new fornac.FornaContainer("#rna_ss", {
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

    const isHybridized = (structure: string): boolean => {
      const count_openers = Array.from(structure).filter(
        (x) => x === "(" || x === "[" || x === "{" || x === "<"
      ).length;
      const count_closers = Array.from(structure).filter(
        (x) => x === ")" || x === "]" || x === "}" || x === ">"
      ).length;
      if (count_openers !== count_closers) return true;
      return false;
    };

    const handleHybridChains = (
      sourceChains: Chain[]
    ):
      | {
          sequence: string;
          dotBracket: string;
          sourceChains: Chain[];
          sourceChainNames: string[];
        }
      | null => {
      const hybridizedChains = sourceChains.filter((chain) =>
        isHybridized(chain.dotBracket)
      );

      if (hybridizedChains.length >= 2) {
        return {
          sequence: hybridizedChains.map((chain) => chain.sequence).join(""),
          dotBracket: hybridizedChains.map((chain) => chain.dotBracket).join(""),
          sourceChains: hybridizedChains,
          sourceChainNames: hybridizedChains.map((chain) => chain.name),
        };
      }

      return null;
    };

    try {
      const hybridizedChains = handleHybridChains(chains);

      chains.forEach((chain) => {
        const isHybridSourceChain =
          hybridizedChains?.sourceChainNames.includes(chain.name) ?? false;

        if (!isHybridSourceChain) {
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
            name: chain.name,
          };
          container.addRNA(options.structure, options);
        }
      });

      setHybridizedName([]);

      if (hybridizedChains !== null) {
        const merged_structure = normalizeDotBracket(hybridizedChains.dotBracket);
        const options = {
          structure: merged_structure,
          sequence: hybridizedChains.sequence,
          name: "hybrydized_" + hybridizedChains.sourceChainNames.join("-"),
        };
        container.addRNA(options.structure, options);
        setHybridizedName((prev) => [...prev, options.name]);

        let chainOffset = 0;
        hybridizedChains.sourceChains.forEach((chain) => {
          chain.nucleotides.forEach((nucleotide, nucleotideIdx) => {
            const localNodeNum = nucleotideIdx + 1;
            const mergedNodeNum = chainOffset + localNodeNum;

            const gNode = document.querySelector(
              `g.gnode[num="n${mergedNodeNum}"][struct_name="${options.name}"]`
            );

            if (gNode) {
              const circle = gNode.querySelector(
                `circle.fornac-node[node_num="${mergedNodeNum}"]`
              );

              if (circle) {
                const title = circle.querySelector("title");

                if (title) {
                  title.textContent = `${chain.name} ${nucleotide.index}`;
                }
              }
              gNode.setAttribute("struct_name", `${chain.name}`);

              gNode.setAttribute("num", `n${localNodeNum}`);
              if (circle) {
                circle.setAttribute(
                  "node_num",
                  `${localNodeNum}`
                );
              }
            }
          });

          chainOffset += chain.sequence.length;
        });
      }
      // const rnaValues = Object.values(container.rnas)[0].nodes;
      // if (!rnaValues.length) {
      //   throw new Error("No valid RNA nodes found in container.");
      // }
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

    return () => {};
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
    <div className="h-full">
      {error ? (
        <div className="text-red-500 p-4 bg-red-100 border border-red-300 rounded">
          <p>${error}</p>
        </div>
      ) : (
        <>
          <div id="rna_ss" className="h-full">
            <div
              id="tooltip"
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
