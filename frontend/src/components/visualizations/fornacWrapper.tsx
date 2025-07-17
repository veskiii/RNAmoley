import React, { useEffect, useRef, useState } from "react";
import Loading from "../common/loading";
import clsx from "clsx";
import { setColor, updateFornacSelection } from "../common/fornaMethods";
import {
  showGraphTooltip,
  hideTooltip,
  showTooltip,
} from "../common/fornaMethods";
import { Nucleotide, Chain } from "../utils/types";
import Fornac from "./fornac";

declare const fornac: any;

const FornacWrapper = ({
  chains,
  setChains,
  labelInterval,
  numbering,
  nodeOutline,
  nodeLabel,
  links,
  directionArrows,
  setAnimation,
  setIsViewInitialized,
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
  setIsViewInitialized: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const error = null;
  const [hoveredIndex, setHoveredIndex] = useState<number>();
  const [hybridizedName, setHybridizedName] = useState<string[]>([]);

  useEffect(() => {
    setIsViewInitialized(true);
  }, []);

  // Zapis do chains
  // Jeśli nastąpi zmiana na grafie zmieniany jest parametr selected w nucleotides
  const isDragging = useRef(false);
  const debounceTimeout = useRef(null);

  useEffect(() => {
    console.log("useEffect chains");
    let observer: MutationObserver | null = null;
    let globalObserver: MutationObserver | null = null;

    const updateSelectedNucleotides = () => {
      // Nie aktualizuj w trakcie przeciągania
      if (isDragging.current) return;

      const selectedNodes = document.querySelectorAll(
        "g.gnode.fornac-selectedNode"
      );
      const selectedIndices = new Set<number>();

      selectedNodes.forEach((node) => {
        const nodeNumAttr = node.getAttribute("num");
        const nodeNameAttr = node.getAttribute("struct_name");
        if (nodeNumAttr) {
          const numIndex = parseInt(nodeNumAttr.slice(1), 10);
          let found_chain = chains.find((chain) => chain.name === nodeNameAttr);
          if (found_chain) {
            const found_nucleotide = found_chain.nucleotides[numIndex - 1];

            if (found_nucleotide) {
              selectedIndices.add(found_nucleotide.index);
            }
          } else if (nodeNameAttr && hybridizedName.includes(nodeNameAttr)) {
            found_chain = chains.find(
              (chain) => chain.name.slice(-1) === nodeNameAttr.slice(-3, -2)
            );
            if (found_chain) {
              let found_nucleotide = found_chain.nucleotides[numIndex - 1];

              if (found_nucleotide) {
                selectedIndices.add(found_nucleotide.index);
              } else {
                found_chain = chains.find(
                  (chain) => chain.name.slice(-1) === nodeNameAttr.slice(-1)
                );
                let prevChain = chains.find(
                  (chain) => chain.name.slice(-1) === nodeNameAttr.slice(-3, -2)
                );
                if (found_chain && prevChain)
                  found_nucleotide =
                    found_chain.nucleotides[
                      numIndex - prevChain.sequence.length - 1
                    ];
                if (found_nucleotide) {
                  selectedIndices.add(found_nucleotide.index);
                }
              }
            }
          }
        }
      });

      //@ts-ignore
      clearTimeout(debounceTimeout.current);
      //@ts-ignore
      debounceTimeout.current = setTimeout(() => {
        setChains((prevChains) => {
          const newChains = prevChains.map((chain) => ({
            ...chain,
            nucleotides: chain.nucleotides.map((nucleotide) => ({
              ...nucleotide,
              selected: selectedIndices.has(nucleotide.index),
            })),
          }));

          // Porównaj stare i nowe chains, aby uniknąć zbędnych renderów
          const hasChanged =
            JSON.stringify(prevChains) !== JSON.stringify(newChains);
          return hasChanged ? newChains : prevChains;
        });
      }, 50);
    };

    const observeTargets = () => {
      if (observer) observer.disconnect();

      observer = new MutationObserver(updateSelectedNucleotides);
      const targetNodes = document.querySelectorAll("g.gnode");

      targetNodes.forEach((targetNode) => {
        if (observer)
          observer.observe(targetNode, {
            attributes: true,
            attributeFilter: ["class"],
          });
      });
    };

    const handleMouseDown = () => {
      isDragging.current = true;
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      updateSelectedNucleotides();
    };

    document
      .getElementById("rna_ss")
      ?.addEventListener("mousedown", handleMouseDown);
    document
      .getElementById("rna_ss")
      ?.addEventListener("mouseup", handleMouseUp);

    observeTargets();

    globalObserver = new MutationObserver(() => {
      if (observer) observer.disconnect();
      observeTargets();
    });

    globalObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (observer) observer.disconnect();
      //@ts-ignore
      if (globalObserver) globalObserver.disconnect();
      document
        .getElementById("rna_ss")
        ?.removeEventListener("mousedown", handleMouseDown);
      document
        .getElementById("rna_ss")
        ?.removeEventListener("mouseup", handleMouseUp);
      //@ts-ignore
      clearTimeout(debounceTimeout.current);
    };
  }, [setChains]);

  //Odczyt chains
  //Na podstawie parametru selected w nucleotides (zaznacz) zmień klasę wierzchołków na grafie
  //Kolorowanie grafu poprzez zmianę klasy na podstawie zmiany selected
  useEffect(() => {
    console.log("useEffect chains");
    // Wywołaj aktualizację przy zmianach w chains
    updateFornacSelection(chains, hybridizedName);

    // Obserwuj zmiany w grafie
    const observer = new MutationObserver(() => {
      updateFornacSelection(chains, hybridizedName);
    });

    const target = document.querySelector("#rna_ss");
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }

    return () => observer.disconnect();
  }, [chains]);

  useEffect(() => {
    //@ts-ignore
    d3.selectAll("g.gnode")
      .on("mouseover", function () {
        //@ts-ignore
        const node_num = d3.select(this).attr("num");
        //@ts-ignore
        const strand = d3.select(this).attr("struct_name");
        showGraphTooltip(node_num, strand, chains, hybridizedName);
      })
      .on("mousemove", function () {})
      .on("mouseout", hideTooltip);
  }, [setAnimation, numbering, labelInterval, links, nodeOutline, nodeLabel]);

  return (
    // <div className="bottom-0 h-[85%] flex-grow w-full bg-transparent">
    <div className="h-full bg-transparent">
      {/* <div className="text-xl font-semibold pt-4 break-words shadow-sm">
        {chains
          .filter((chain) => chain.name.slice(-1) === selectedChain)
          .map((chain) => (
            <div
              className="whitespace-nowrap overflow-x-auto cursor-pointer ml-2"
              key={chain.name}
            >
              <div>
                <span className="text-teal-600">{chain.name}: </span>
                {chain.nucleotides.map((nucleotide) => (
                  <span
                    className={clsx("relative", {
                      "text-teal-500": hoveredIndex === nucleotide.index,
                      "text-red-500":
                        nucleotide.selected &&
                        hoveredIndex !== nucleotide.index,
                    })}
                    key={nucleotide.index}
                    onClick={() =>
                      setColor(nucleotide.index, setChains, selectedChain)
                    }
                    onMouseOver={(event) => {
                      setHoveredIndex(nucleotide.index);
                      showTooltip(
                        event,
                        nucleotide.index,
                        nucleotide.original_index
                      );
                    }}
                    onMouseOut={(event) => {
                      setHoveredIndex(0);
                      hideTooltip();
                    }}
                  >
                    {nucleotide.base}
                  </span>
                ))}
              </div>
            </div>
          ))}
      </div> */}
      <Fornac
        key={JSON.stringify(chains)}
        chains={chains}
        setChains={setChains}
        labelInterval={labelInterval}
        numbering={numbering}
        nodeOutline={nodeOutline}
        nodeLabel={nodeLabel}
        links={links}
        directionArrows={directionArrows}
        setAnimation={setAnimation}
        setHybridizedName={setHybridizedName}
      />
    </div>
  );
};

export default FornacWrapper;
