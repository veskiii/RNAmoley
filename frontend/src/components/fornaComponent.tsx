import React, { useEffect, useState, useRef } from "react";
import Loading from "./loading";
import clsx from "clsx";
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { min } from "d3";

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
  //const [selectedNts, setSelectedNts] = React.useState<number[]>([]);
  // const [labelInterval, setLabelInterval] = useState(1);
  // const [chainsState, setChainsState] = useState<Chain[]>(chains);
  const [selectedChain, setSelectedChain] = useState<string>(chains[0]?.name.slice(-1));
  const [inputValueStart, setInputValueStart] = useState('');
  const [inputValueEnd, setInputValueEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [minId, setMinId] = useState<string>();
  const [maxId, setMaxId] = useState<string>();



  const handleInputChangeStart = (event: SelectChangeEvent) => {
    setInputValueStart(event.target.value);
  };

  const handleInputChangeEnd = (event: SelectChangeEvent) => {
    setInputValueEnd(event.target.value);
  };


  const handleChange = (event: SelectChangeEvent) => {
    setSelectedChain(event.target.value as string);
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
    const isHybridized = (structure: string):boolean =>{
      var count_openers = Array.from(structure).filter(x => (x === "(" || x=== "[")).length
      var count_closers = Array.from(structure).filter(x => (x === ")" || x=== "]")).length
      if(count_openers !== count_closers)
        return true;
      return false;
    };

    // var merged_chains: Chain[] = [];
    var hybridized_chains: Chain[] = [];

    chains.forEach((chain, index) =>{
      if(isHybridized(chain.dotBracket) && hybridized_chains.length < 3){
        hybridized_chains.push(chain);
        // console.log(hybridized_chains, index);
      }else if(hybridized_chains.length > 2){
        console.log("Mogą być tylko 2 łańcuchy zhybrydyzowane");
      }
    });

    try {
      // setChangeSource("molstar")
      chains.forEach((chain) =>{
        if(!(chain === hybridized_chains[0]  || chain === hybridized_chains[1]))
        {
          var options = {
            structure: chain.dotBracket,
            sequence: chain.sequence
          }
          container.addRNA(options.structure, options);

          chain.nucleotides.forEach((nucleotide, index) =>{
            //@ts-ignore
            d3.select(`circle.fornac-node[node_num="${index+1}"]`).select("title").text(`${chain.name} ${nucleotide.index}`);

            //@ts-ignore
            d3.selectAll("text.fornac-nodeLabel").filter(function(){
              //@ts-ignore
              return d3.select(this).text() === `${index+1}`;}).text(`${nucleotide.original_index}`);
          
          });
        }
      });
      if(hybridized_chains.length > 1){
        const merged_sequence = hybridized_chains[0].sequence + hybridized_chains[1].sequence;
        const merged_structure = hybridized_chains[0].dotBracket + hybridized_chains[1].dotBracket;
        var options = {
          structure: merged_structure,
          sequence: merged_sequence
        }
        container.addRNA(options.structure, options);

        for(let i =0; i<2; i++){
          hybridized_chains[i].nucleotides.forEach((nucleotide, index) =>{
            //@ts-ignore
            d3.select(`circle.fornac-node[node_num="${nucleotide.index}"]`).select("title").text(`${hybridized_chains[i].name} ${nucleotide.index}`);
  
            //@ts-ignore
            d3.selectAll("text.fornac-nodeLabel").filter(function(){
              //@ts-ignore
              return d3.select(this).text() === `${nucleotide.index}`;}).text(`${nucleotide.original_index}`);
          
          });
        }

      }
      // @ts-expect-error
      const rnaValues = Object.values(container.rnas)[0].nodes;
      if (!rnaValues.length) {
        throw new Error("No valid RNA nodes found in container.");
      }

      // throw new Error("");
    } catch (error) {
      console.error("Failed to add RNA:", error);
      let rnaContainer = document.getElementById("rna_ss") as HTMLElement;
      rnaContainer.setAttribute("style", "color:red; padding:10px;");
      rnaContainer.innerHTML = `<p>Failed to visualize RNA</p><p>${error}</p>`;
    }
    let loadingElement = document.getElementById(
      "containerLoadingText"
    ) as HTMLElement;
    loadingElement.style.display = "none";

    // Analogiczna funkcja, która zmienia parametr selected na podstawie kliknięcia na grafie
    chains.forEach((chain, chainIndex) =>{
      chain.nucleotides.forEach((nucleotide, index) => {

        //@ts-ignore
        const g = d3.select(`g.gnode[num="n${nucleotide.index}"]`);

        // TODO: dodaj obsługę gdy przeciagnięcie
        g.on("mousedown", ()=>{
          const newChains = [...chains];
          newChains[chainIndex].nucleotides[index].selected = (g.attr("class") === "gnode fornac-selectedNode") ? false : true;
          console.log("Klasa: ", g.attr("class"), "stan: ", newChains[chainIndex].nucleotides[index].selected);
          setChains(newChains);
          
          console.log("ZMIANA W SELECTED:", newChains[chainIndex].nucleotides[index]);

        })
      });
    }) 
    

    container.displayNumbering(numbering);

    container.displayNodeOutline(nodeOutline);

    container.displayNodeLabel(nodeLabel);

    container.displayLinks(links);

    container.displayDirectionArrows(directionArrows);

    setAnimation ? container.startAnimation() : container.stopAnimation();

    // document.addEventListener("mouseup", updateSelectedNucleotides);
    return () => {
      // document.removeEventListener("mouseup", updateSelectedNucleotides);
    };
  }, [
    sequences,
    structures,
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
  useEffect( ()=> {
    const updateSelectedNucleotides = () => {
        const selectedNodes = document.querySelectorAll("g.gnode.fornac-selectedNode");
        console.log(selectedNodes);
        const selectedIndices = new Set<number>();
        selectedNodes.forEach(node => {
          const nodeNumAttr = node.getAttribute("num");
          if (nodeNumAttr) {
            const numIndex = parseInt(nodeNumAttr.slice(1));
            selectedIndices.add(numIndex);
          }
        });
  
        //const newChains = chainsState.map(chain => ({
        //   ...chain,
        //   nucleotides: chain.nucleotides.map(nucleotide => ({
        //     ...nucleotide,
        //     selected: selectedIndices.has(nucleotide.index),
        //   })),
        // }));
        // setChainsState(newChains);
  
  
        chains.forEach((chain, chainIndex) =>{
            chain.nucleotides.forEach((nucleotide, index) => {
  
                const newChains = [...chains];
                newChains[chainIndex].nucleotides[index].selected = selectedIndices.has(nucleotide.index) ? true : false;
                setChains(newChains);
                
                console.log("ZMIANA W SELECTED:", newChains[chainIndex].nucleotides[index]);
  
            });
          }) 

    
      const observer = new MutationObserver(updateSelectedNucleotides);
    
      const observeTargets = () => {
        const targetNodes = document.querySelectorAll("g.gnode");
        targetNodes.forEach(targetNode => {
          observer.observe(targetNode, {
            attributes: true,
            attributeFilter: ["class"],
          });
        });
      };
    
      observeTargets(); // Obserwuj istniejące elementy
      updateSelectedNucleotides(); // Aktualizacja na starcie
    
      const globalObserver = new MutationObserver(() => {
        observer.disconnect(); // Odłącz stary observer
        observeTargets(); // Obserwuj nowe elementy
      });
    
      globalObserver.observe(document.body, { childList: true, subtree: true });
    
      return () => {
        observer.disconnect();
        globalObserver.disconnect();
      };
      }
      
  }, [setChains]);
  
  //Zapis do chains
  //Służy do obsługi wyboru nukleotydów po zakresie
  const handleSubmit = () => {
    const start = parseInt(inputValueStart, 10);
    const end = parseInt(inputValueEnd, 10);
  
    if (isNaN(start) || isNaN(end) || start > end || start <= 0 || end <= 0) {
      alert("Invalid range");
      return;
    }
    if(minId && maxId && start >= parseInt(minId,10) && end <= parseInt(maxId, 10)){

      const newChains = chains.map(chain => ({
        ...chain,
        nucleotides: chain.nucleotides.map(nucleotide => ({
          ...nucleotide,
          selected: nucleotide.original_index >= start && nucleotide.original_index <= end,
        })),
      }));
    
      setChains(newChains);
      setNeedsUpdate(true); 
    }else{
      alert("Type valid range on selected chain");
      return;
    }

  };
  

  //Odczyt - powinien być wywoływany tylko przy wejsciu do komponentu
  //zmiana na grafie na podstawie wybranego zakresu powinna byc obsługiwana przez inna funkcję 
  
  //Na podstawie parametru selected w nucleotides (zaznacz) zmień klasę wierzchołków na grafie 
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
  }, [chains]);//chains
  
  const handleNodeClick = () =>{
    console.log("handleNodeClick");
    const newChains = chains.map(chain => ({
      ...chain,
      nucleotides: chain.nucleotides.map(nucleotide => ({
        ...nucleotide,
        selected: false,
      })),
    }));
  
    setChains(newChains);
  }

  useEffect(() => {
    const target = document.querySelector("#rna_ss");
    if (target) {
      target.addEventListener("click", handleNodeClick);
    }
  
    return () => {
      if (target) {
        target.removeEventListener("click", handleNodeClick);
      }
    };
  }, []);

  //do placeholder z max i min original_id nukleotydów podanego chain
  useEffect(()=>{
    chains.forEach((chain) =>{
      if(chain.name.slice(-1) === selectedChain){
        const indices = chain.nucleotides.map(nucleotide =>nucleotide.original_index);
        const min = Math.min(...indices);
        const max = Math.max(...indices);

        setMinId(min.toString());
        setMaxId(max.toString());
      }

    })
  },[selectedChain])

  
  return (
    <div className="absolute bottom-0 h-[90%] flex-grow w-full bg-transparent">
<div
  className={`text-xl font-semibold overflow-x-scroll pb-2 break-words drop-shadow-xl`}
>
<div className="flex flex-row items-center mx-4 space-x-4">
<Box sx={{  width: "80px",maxWidth: 120}}>
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
          {chains.map((chain, chainIndex) => (
            <MenuItem value={chain.name.slice(-1)}>{chain.name.slice(-1)}</MenuItem>
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
            // placeholder={chains.filter(chain => chain.name.slice(-1) === selectedChain)}
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
    
  {chains.filter((chain) => chain.name.slice(-1) === selectedChain).map(chain =>(
    <div className="whitespace-nowrap w-max cursor-pointer ml-2">
    <div key={chain.name.slice(-1)} >
      <span className="text-blue-600">{chain.name}: </span>
      {chain.nucleotides.map((nucleotide, index) => (
        <span
          className={clsx(
            nucleotide.selected ? "text-red-500" : ""
          )}
          key={index}
          // onClick={() => setColor(index)}
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
        <p>{error}</p>
      </div>
    ) : (
      <>
      <div
        id="rna_ss"

        //className="rounded-lg border-black border-solid border-2 bg-gray-100 m-2"
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
