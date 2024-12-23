import React, { useEffect, useRef, useState } from "react";
import Loading from "../common/loading";
import clsx from "clsx";
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';

declare const fornac: any;

interface Nucleotide {
  index: number;
  original_index: number;
  base: string;
  structure: string;
  selected: boolean;
}

interface Chain {
  name: string;
  nucleotides: Nucleotide[];
  sequence: string;
  dotBracket: string;
}

const FornaComponent = ({
  sequences,
  structures,
  chains,
  setChains,
  labelInterval,
  numbering,
  nodeOutline,
  nodeLabel,
  links,
  directionArrows,
  setAnimation,
}: {
  sequences: string[];
  structures: string[];
  chains: Chain[];
  setChains: React.Dispatch<React.SetStateAction<Chain[]>>;
  labelInterval: number;
  numbering: boolean;
  nodeOutline: boolean;
  nodeLabel: boolean;
  links: boolean;
  directionArrows: boolean;
  setAnimation: boolean;
}) => {
  const [selectedChain, setSelectedChain] = useState<string>(chains[0]?.name.slice(-1) || "");
  const [inputValueStart, setInputValueStart] = useState('');
  const [inputValueEnd, setInputValueEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [minId, setMinId] = useState<string>();
  const [maxId, setMaxId] = useState<string>();

  const handleInputChangeStart = (event: SelectChangeEvent) => {
    setInputValueStart(event.target.value);
  };

  const handleInputChangeEnd = (event: SelectChangeEvent) => {
    setInputValueEnd(event.target.value);
  };


  const handleChange = (event: SelectChangeEvent) => {
    setSelectedChain(event.target.value);
  };

  useEffect(() => {

    const container = new fornac.FornaContainer("#rna_ss", {
      animation: setAnimation,
      zoomable: true,
      labelInterval: labelInterval,
      // initialSize: [41, 26],
      initialSize: [51, 24],
      numbering: numbering,
      nodeOutline: nodeOutline,
      nodeLabel: nodeLabel,
      links: links,
      directionArrows: directionArrows,
    });


    //TODO: check for safety if chains are matching 
    const isHybridized = (structure: string): boolean => {
      const count_openers = Array.from(structure).filter(x => (x === "(" || x === "[")).length
      const count_closers = Array.from(structure).filter(x => (x === ")" || x === "]")).length
      if (count_openers !== count_closers)
        return true;
      return false;
    };

    const hybridized_chains: Chain[] = [];

    chains.forEach((chain, index) => {
      if (isHybridized(chain.dotBracket) && hybridized_chains.length < 3) {
        hybridized_chains.push(chain);
      } else if (hybridized_chains.length > 2) {
        console.log("Mogą być tylko 2 łańcuchy zhybrydyzowane");
      }
    });

    try {
      chains.forEach((chain) => {
        if (!(chain === hybridized_chains[0] || chain === hybridized_chains[1])) {
          const options = {
            structure: chain.dotBracket,
            sequence: chain.sequence
          }
          container.addRNA(options.structure, options);

          chain.nucleotides.forEach((nucleotide, index) => {
            //@ts-ignore
            d3.select(`circle.fornac-node[node_num="${index + 1}"]`).select("title").text(`${chain.name} ${nucleotide.index}`);

            //@ts-ignore
            d3.selectAll("text.fornac-nodeLabel").filter(function () {
              //@ts-ignore
              return d3.select(this).text() === `${index + 1}`;
            }).text(`${nucleotide.original_index}`);

          });
        }
      });
      if (hybridized_chains.length > 1) {
        const merged_sequence = hybridized_chains[0].sequence + hybridized_chains[1].sequence;
        const merged_structure = hybridized_chains[0].dotBracket + hybridized_chains[1].dotBracket;
        const options = {
          structure: merged_structure,
          sequence: merged_sequence
        }
        container.addRNA(options.structure, options);

        for (let i = 0; i < 2; i++) {
          hybridized_chains[i].nucleotides.forEach((nucleotide, index) => {
            //@ts-ignore
            d3.select(`circle.fornac-node[node_num="${nucleotide.index}"]`).select("title").text(`${hybridized_chains[i].name} ${nucleotide.index}`);

            //@ts-ignore
            d3.selectAll("text.fornac-nodeLabel").filter(function () {
              //@ts-ignore
              return d3.select(this).text() === `${nucleotide.index}`;
            }).text(`${nucleotide.original_index}`);

          });
        }

      }
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

  // Zapis do chains
  // Jeśli nastąpi zmiana na grafie zmieniany jest parametr selected w nucleotides
  const isDragging = useRef(false);
  const debounceTimeout = useRef(null);

  useEffect(() => {
    console.log("isDragging: ", isDragging);
    let observer: MutationObserver | null = null;
    let globalObserver: MutationObserver | null = null;

    const updateSelectedNucleotides = () => {
      // Nie aktualizuj w trakcie przeciągania
      if (isDragging.current)
        return;

      const selectedNodes = document.querySelectorAll("g.gnode.fornac-selectedNode");
      const selectedIndices = new Set<number>();

      selectedNodes.forEach((node) => {
        const nodeNumAttr = node.getAttribute("num");
        if (nodeNumAttr) {
          const numIndex = parseInt(nodeNumAttr.slice(1), 10);
          selectedIndices.add(numIndex);
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
          const hasChanged = JSON.stringify(prevChains) !== JSON.stringify(newChains);
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

    document.getElementById("rna_ss")?.addEventListener("mousedown", handleMouseDown);
    document.getElementById("rna_ss")?.addEventListener("mouseup", handleMouseUp);

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
      document.getElementById("rna_ss")?.removeEventListener("mousedown", handleMouseDown);
      document.getElementById("rna_ss")?.removeEventListener("mouseup", handleMouseUp);
      //@ts-ignore
      clearTimeout(debounceTimeout.current);
    };
  }, [setChains]);

  //Odczyt chains
  //Na podstawie parametru selected w nucleotides (zaznacz) zmień klasę wierzchołków na grafie 
  //Kolorowanie grafu poprzez zmianę klasy na podstawie zmiany selected
  useEffect(() => {
    const updateFornacSelection = () => {
      console.log("Aktualizacja klas w grafie");
      chains.forEach(chain => {
        chain.nucleotides.forEach(nucleotide => {
          const gNode = document.querySelector(`g.gnode[num="n${nucleotide.index}"]`);
          if (gNode) {
            gNode.setAttribute("class", nucleotide.selected ? "gnode fornac-selectedNode" : "gnode");
          }
        });
      });
    };

    // Wywołaj aktualizację przy zmianach w chains
    updateFornacSelection();

    // Obserwuj zmiany w grafie
    const observer = new MutationObserver(() => {
      console.log("Mutacja w grafie wykryta");
      updateFornacSelection();
    });

    const target = document.querySelector("#rna_ss");
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }

    return () => observer.disconnect();
  }, [chains]);

  //Zapis do chains
  //Służy do obsługi wyboru nukleotydów po zakresie
  const handleSubmit = () => {
    const start = parseInt(inputValueStart, 10);
    const end = parseInt(inputValueEnd, 10);

    if (isNaN(start) || isNaN(end) || start > end || start <= 0 || end <= 0) {
      alert("Invalid range");
      return;
    }
    if (minId && maxId && start >= parseInt(minId, 10) && end <= parseInt(maxId, 10)) {

      const newChains = chains.map(chain => ({
        ...chain,
        nucleotides: chain.nucleotides.map(nucleotide => ({
          ...nucleotide,
          selected: nucleotide.original_index >= start && nucleotide.original_index <= end,
        })),
      }));

      setChains(newChains);
    } else {
      alert("Type valid range on selected chain");
    }

  };

  //do placeholder z max i min original_id nukleotydów podanego chain
  useEffect(() => {
    chains.forEach((chain) => {
      if (chain.name.slice(-1) === selectedChain) {
        const indices = chain.nucleotides.map(nucleotide => nucleotide.original_index);
        const min = Math.min(...indices);
        const max = Math.max(...indices);

        setMinId(min.toString());
        setMaxId(max.toString());
      }

    })
  }, [selectedChain])

  //Ustaw kolor nukleotydu na sekwencji i zmień parametr selected
  const setColor = (index: number) => {
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
    console.log(chains)
  }

  return (
    <div className="absolute bottom-0 h-[90%] flex-grow w-full bg-transparent">
      <div
        className={`text-xl font-semibold overflow-x-scroll pb-2 break-words drop-shadow-xl`}
      >
        <div className="flex flex-row items-center mx-4 space-x-4">
          <Box sx={{ width: "80px", maxWidth: 120 }}>
            <FormControl fullWidth>
              <InputLabel id="demo-simple-select-label" >Chain</InputLabel>
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={selectedChain}
                label="Chain"
                onChange={handleChange}
                className="p-0"
              >
                {chains.map((chain) => (
                  <MenuItem key={chain.name} value={chain.name.slice(-1)}>{chain.name.slice(-1)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <div className="flex flex-row items-baseline m-6 mt-0">
            <label htmlFor="range_start" className="text-xl font-medium mr-4">From</label>
            <input
              id="range_start"
              type="number"
              min={minId}
              max={maxId}
              value={inputValueStart}
              onChange={handleInputChangeStart}
              placeholder={minId}
              className="w-[100px] p-2  mr-4 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <label htmlFor="range_end" className="text-xl font-medium  mr-4">To</label>
            <input
              id="range_end"
              type="number"
              min={minId}
              max={maxId}
              value={inputValueEnd}
              onChange={handleInputChangeEnd}
              placeholder={maxId}
              className="w-[100px] p-2  mr-4 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              id="select_button"
              onClick={handleSubmit}
            >
              Select
            </button>
          </div>

        </div>

        {chains.filter((chain) => chain.name.slice(-1) === selectedChain).map(chain => (
          <div className="whitespace-nowrap w-max cursor-pointer ml-2" key={chain.name}>
            <div>
              <span className="text-blue-600">{chain.name}: </span>
              {chain.nucleotides.map((nucleotide) => (
                <span
                  className={clsx(
                    nucleotide.selected ? "text-red-500" : ""
                  )}
                  key={nucleotide.index}
                  onClick={() => setColor(nucleotide.index)}

                >
                  {nucleotide.base}
                </span>
              ))}
            </div>
          </div>
        ))
        }


      </div>
      {error ? (
        <div className="text-red-500 p-4 bg-red-100 border border-red-300 rounded">
          <p>${error}</p>
        </div>
      ) : (
        <>
          <div
            id="rna_ss"
          ></div>
          <div id="containerLoadingText" className="p-2">
            <Loading />
          </div>
        </>
      )}
    </div>
  );
};

export default FornaComponent;
