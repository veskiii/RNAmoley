import React, { useEffect, useState } from "react";
import DownloadLink from "./downloadLink";
import Loading from "./loading";
import clsx from "clsx";
import { ChainsSchema } from "molstar/lib/mol-model/structure/model/properties/atomic";
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

const FornacComponent = ({
  sequences,
  structures,
  chains,
  labelInterval,
  numbering,
  nodeOutline,
  nodeLabel,
  links,
  directionArrows,
  setAnimation,
  selectedNts,
  setSelectedNts,
}: {
  sequences: string[];
  structures: string[];
  chains: Chain[];
  labelInterval: number;
  numbering: boolean;
  nodeOutline: boolean;
  nodeLabel: boolean;
  links: boolean;
  directionArrows: boolean;
  setAnimation: boolean;
  selectedNts: number[];
  setSelectedNts: React.Dispatch<React.SetStateAction<number[]>>;
}) => {
  //const [selectedNts, setSelectedNts] = React.useState<number[]>([]);
  // const [labelInterval, setLabelInterval] = useState(1);
  const [chainsState, setChainsState] = useState<Chain[]>(chains);
  const [selectedChain, setSelectedChain] = useState<string>(chains[0]?.name.slice(-1));
  const [inputValueStart, setInputValueStart] = useState('');
  const [inputValueEnd, setInputValueEnd] = useState('');

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
      initialSize: [41, 26],
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

    // key of the rna is a random sting in the container object so this way we get the first rna
    // @ts-expect-error
    var nodes = Object.values(container.rnas)[0].nodes;
    // filter out the nucleotides
    // @ts-expect-error
    var nucleotides = nodes.filter((obj) => {
      return obj.nodeType === "nucleotide";
    });
    console.log(nucleotides);

    //Zaznaczamy elementy na podstawie parametru selected 
    chainsState.forEach(chain =>{
      chain.nucleotides.forEach((nucleotide, index) => {
        //@ts-ignore
        const g = d3.select(`g.gnode[num="n${nucleotide.index}"]`);
        g.attr("class", nucleotide.selected ?  "gnode fornac-selectedNode" : "gnode");
      });
    }) 

    container.displayNumbering(numbering);

    container.displayNodeOutline(nodeOutline);

    container.displayNodeLabel(nodeLabel);

    container.displayLinks(links);

    container.displayDirectionArrows(directionArrows);

    setAnimation ? container.startAnimation() : container.stopAnimation();

    return () => {
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
    setSelectedNts,
  ]);


  useEffect(() =>{
    chainsState.map(chain =>{
      console.log(chain);
    })
    setChainsState(chainsState);

  }, [chainsState, setChainsState])


  useEffect(() => {
    const updateSelectedNucleotides = () => {
      const selectedNodes = document.querySelectorAll("g.gnode.fornac-selectedNode");
      const selectedIndices = new Set<number>();
      selectedNodes.forEach(node => {
        const nodeNumAttr = node.getAttribute("num");
        if (nodeNumAttr) {
          const numIndex = parseInt(nodeNumAttr.slice(1));
          selectedIndices.add(numIndex);
        }
      });
  

      chainsState.forEach((chain, chainIndex) =>{
          chain.nucleotides.forEach((nucleotide, index) => {

              const newChains = [...chainsState];
              newChains[chainIndex].nucleotides[index].selected = selectedIndices.has(nucleotide.index);
              setChainsState(newChains);
              
              console.log("ZMIANA W SELECTED:", newChains[chainIndex].nucleotides[index]);

          });
        }) 

    };
  
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
  }, [setChainsState]);
  
  const handleSubmit = () =>{
    console.log(inputValueStart, inputValueEnd);
  }

  

  return (
    <div className="absolute bottom-0 h-[90%] flex-grow w-full bg-transparent">
<div
  className={`text-xl font-semibold overflow-x-scroll pb-2 break-words drop-shadow-xl`}
>
<Box sx={{ maxWidth: 120}}>
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
  {chainsState.filter((chain) => chain.name.slice(-1) === selectedChain).map(chain =>(
    
    <div key={chain.name.slice(-1)} className="mb-4">
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
  )) 
}
{/* <div> 

  <label htmlFor="range_start">From</label>
  <input id="range_start" type="text" value={inputValueStart} onChange={handleInputChangeStart} ></input>

  <label htmlFor="range_end">To</label>
  <input id="range_end" type="text" value={inputValueEnd} onChange={handleInputChangeEnd} ></input>

  <button id="select_button" onClick={handleSubmit}>Select</button>

</div> */}
</div>

      <div
        id="rna_ss"

        //className="rounded-lg border-black border-solid border-2 bg-gray-100 m-2"
      ></div>
      <div id="containerLoadingText" className="p-2">
        <Loading />
      </div>
    </div>
  );
};

export default FornacComponent;
