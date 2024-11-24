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
  const [selectedChain, setSelectedChain] = useState('');

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

    var merged_chains: Chain[] = [];
    var hybridized_chains: Chain[] = [];

    chains.forEach((chain, index) =>{
      if(isHybridized(chain.dotBracket)){
        hybridized_chains.push(chain);
        console.log(chain);
      }else{
        merged_chains.push(chain);
      }
    });


    if(hybridized_chains.length > 0 && hybridized_chains.length < 3){

      //Nie działa łączenie listy nukleotydów
      var merged_sequence = hybridized_chains[0].sequence + hybridized_chains[1].sequence;
      var merged_structure = hybridized_chains[0].dotBracket + hybridized_chains[1].dotBracket;
      const merged_nucleotides = hybridized_chains[0].nucleotides.concat(hybridized_chains[1].nucleotides.map((nucleotide) => ({
        ...nucleotide,
        index: nucleotide.index + hybridized_chains[0].nucleotides.length,
        original_index: nucleotide.original_index,
        selected: nucleotide.selected,
      })));

      
      var name = hybridized_chains[0].name + "_" +hybridized_chains[1].name;

      const merged_chain: Chain = {
        name: name,
        sequence: merged_sequence,
        dotBracket: merged_structure,
        nucleotides: merged_nucleotides
      }
      merged_chains.push(merged_chain);

      console.log("Zhybrydyzowane łańcuchy: ",merged_chain.name, merged_chain.sequence, merged_chain.dotBracket, merged_chain.nucleotides);
  
    }else if(hybridized_chains.length > 2){
      //Throw new error;
      console.log("Wiecej niż 2 sekwencje zhybrydyzowane!");
    }

    try {

      merged_chains.forEach((chain) =>{
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

      });

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
    chains.forEach(chain =>{
      chain.nucleotides.forEach((nucleotide, index) => {
        //@ts-ignore
        const g = d3.select(`g.gnode[num="n${index+1}"]`);
        g.attr("class", nucleotide.selected ?  "gnode fornac-selectedNode" : "gnode");
      });
    }) 

    //Analogiczna funkcja, która zmienia parametr selected na podstawie kliknięcia na grafie
    chainsState.forEach((chain, chainIndex) =>{
      chain.nucleotides.forEach((nucleotide, index) => {

        //@ts-ignore
        const g = d3.select(`g.gnode[num="n${index+1}"]`);

        // TODO: dodaj obsługę gdy przeciagnięcie
        g.on("click", ()=>{
          const newChains = [...chainsState];
          newChains[chainIndex].nucleotides[index].selected = (g.attr("class") === "gnode") ? false : true;
          setChainsState(newChains);
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

    return () => {
      // document.removeEventListener("click", handleClick);
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


  return (
    <div className="absolute bottom-0 h-[90%] flex-grow w-full bg-transparent">
<div
  className={`text-xl font-semibold overflow-x-scroll pb-2 break-words drop-shadow-xl`}
>
<Box sx={{ maxWidth: 120 }}>
      <FormControl fullWidth>
        <InputLabel id="demo-simple-select-label">Chain</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="demo-simple-select"
          value={selectedChain}
          label="Chain"
          onChange={handleChange}
        >
          {chains.map((chain, chainIndex) => (
            <MenuItem value={chainIndex}>{chainIndex}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  {chains.map((chain, chainIndex) => (
    
    <div key={chainIndex} className="mb-4">
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
  ))}
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
