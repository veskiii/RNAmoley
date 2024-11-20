import React, { useEffect, useState } from "react";
import DownloadLink from "./downloadLink";
import Loading from "./loading";
import clsx from "clsx";

declare const fornac: any;

interface Nucleotide {
  index: number; 
  original_index: number; 
  base: string; 
  structure: string; 
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

  useEffect(() => {
    const container = new fornac.FornaContainer("#rna_ss", {
      animation: setAnimation,
      zoomable: true,
      labelInterval: labelInterval,
      initialSize: [41, 20],
      numbering: numbering,
      nodeOutline: nodeOutline,
      nodeLabel: nodeLabel,
      links: links,
      directionArrows: directionArrows,
    });

    // console.log("chains:",chains);

    //TODO: check for safety if chains are matching 
    const isHybridized = (structure: string):boolean =>{
      var count_openers = Array.from(structure).filter(x => (x === "(" || x=== "[")).length
      var count_closers = Array.from(structure).filter(x => (x === ")" || x=== "]")).length
      if(count_openers !== count_closers)
        return true;
      return false;
    };

    var merged_structures: string[] = [];
    var merged_sequences: string[] = [];

    var hybridized_structures: string[] = [];
    var hybridized_sequences: string[] = [];

    structures.forEach((structure, index) =>{
      if(isHybridized(structure)){
        hybridized_structures.push(structure);
        hybridized_sequences.push(sequences[index]);
      }else{
        merged_structures.push(structure);
        merged_sequences.push(sequences[index]);
      }
    });

    if(hybridized_sequences.length > 0 && hybridized_sequences.length < 3){
      for(let i = 0; i < hybridized_sequences.length; i+=2){
          var merged_sequence = hybridized_sequences[i] + "&  " + hybridized_sequences[i+1];
          var merged_structure = hybridized_structures[i] + "&.." + hybridized_structures[i+1];

          merged_sequences.push(merged_sequence);
          merged_structures.push(merged_structure);
      }
    }else if(hybridized_sequences.length > 2){
      //Throw new error;
      console.log("Wiecej niż 2 sekwencje zhybrydyzowane!");
    }


    //TODO: function checking if sequences are compatible


    try {

      chains.forEach((chain) =>{
          var options = {
            structure: chain.dotBracket,
            sequence: chain.sequence
          }
          container.addRNA(options.structure, options);

          chain.nucleotides.forEach((nucleotide, index) =>{
            //@ts-ignore
            d3.select(`circle.fornac-node[node_num="${index+1}"]`).select("title").text(`${chain.name}`);

            //@ts-ignore
            d3.selectAll("text.fornac-nodeLabel").filter(function(){
              //@ts-ignore
              return d3.select(this).text() === `${index+1}`;}).text(`${nucleotide.original_index}`);
          
          });

      });

      // merged_structures.forEach((structure, index) =>{
      //   var options = {
      //     structure: structure,
      //     sequence: merged_sequences[index],
      //   };
      //   console.log(options.structure, options.sequence);
      //   container.addRNA(options.structure, options);

      //   //@ts-ignore
      //   d3.select('circle.fornac-node[node_num="2"]').select("title").text("Nowy tytuł");

      //   //@ts-ignore
      //   d3.selectAll("text.fornac-nodeLabel").filter(function(){
      //     //@ts-ignore
      //     return d3.select(this).text() === "2";}).text("10");
      // });
        
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

    // on click get the selected nucelotides
    var selectedNts;
    document.addEventListener("click", () => {
      // @ts-expect-error
      selectedNts = nucleotides.filter((obj) => obj.selected);
      console.log(selectedNts);
      // @ts-expect-error
      setSelectedNts(selectedNts.map((obj) => obj.num));
    });

    container.displayNumbering(numbering);

    container.displayNodeOutline(nodeOutline);

    container.displayNodeLabel(nodeLabel);

    container.displayLinks(links);

    container.displayDirectionArrows(directionArrows);

    setAnimation ? container.startAnimation() : container.stopAnimation();
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
    <div className="absolute bottom-0 h-[90%] flex-grow w-full rounded-b-lg bg-slate-600">
      {/* <div
        className={` text-xl items-center text-justify font-semibold overflow-x-scroll pb-2 break-words drop-shadow-xl`}
      >
        {sequence.split("").map((nt, index) => (
          <span
            className={clsx(
              selectedNts.includes(index + 1) ? "text-red-500" : ""
            )}
            key={index}
          >
            {nt}
          </span>
        ))}
      </div> */}
      <div
        id="rna_ss"
        className="rounded-lg border-black border-solid border-2 bg-gray-100 m-2"
      ></div>
      <div id="containerLoadingText" className="p-2">
        <Loading />
      </div>
    </div>
  );
};

export default FornacComponent;
