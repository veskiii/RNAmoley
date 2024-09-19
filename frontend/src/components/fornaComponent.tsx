import React, { useEffect, useState } from "react";
import DownloadLink from "./downloadLink";
import Loading from "./loading";
import clsx from "clsx";

declare const fornac: any;

const FornacComponent = ({
  sequence,
  structure,
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
  sequence: string;
  structure: string;
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

    const ntNumbers = sequence
      .toString()
      .split("")
      .map((_, i) => "nt" + (i + 1).toString());

    const options = {
      structure: structure,
      sequence: sequence,
      uids: ntNumbers,
    };

    try {
      container.addRNA(options.structure, options);
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
    sequence,
    structure,
    labelInterval,
    numbering,
    nodeOutline,
    nodeLabel,
    links,
    directionArrows,
    setAnimation,
  ]);

  return (
    <div className="absolute bottom-0 h-[90%] flex-grow w-full rounded-b-lg bg-slate-600">
      <div
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
      </div>
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
