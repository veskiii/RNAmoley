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
    d3.select("#rna_ss").selectAll("*").remove();

    const containerEl = document.getElementById("rna_ss");
    const rect = containerEl ? containerEl.getBoundingClientRect() : null;
    const initW = rect && rect.width > 0 ? Math.max(400, Math.floor(rect.width)) : 800;
    const initH = rect && rect.height > 0 ? Math.max(300, Math.floor(rect.height)) : 400;

    const container = new fornac.FornaContainer("#rna_ss", {
      animation: setAnimation,
      zoomable: true,
      labelInterval: labelInterval,
      initialSize: [initW, initH],
      numbering: numbering,
      nodeOutline: nodeOutline,
      nodeLabel: nodeLabel,
      links: links,
      directionArrows: false,
    });
    try {
      const hybridizedChains = handleHybridChains(chains);

      // Dodaj standardowe łańcuchy (nie-hybrydowe)
      chains.forEach((chain) => {
        const isHybridSourceChain =
          hybridizedChains?.sourceChainNames.includes(chain.name) ?? false;

        if (!isHybridSourceChain) {
          addRNAtoContainer(container, chain);
        }
      });

      // Dodaj RNA połączony z hybrydyzowanych łańcuchów, jeśli istnieje
      if (hybridizedChains !== null) {
        addRNAtoContainer(container, {
          name: "hybrid",
          original_name: "hybrid",
          sequence: hybridizedChains.sequence,
          dotBracket: hybridizedChains.dotBracket,
          nucleotides: [], // Domyślne wartości
        });
      }
    } catch (error) {
      console.error("Błąd przy dodawaniu RNA:", error);
    }
    setContainer(container);

    try {
      if (typeof colorGnodes === "function") colorGnodes();
    } catch (e) {
      console.warn("colorGnodes() failed:", e);
    }
  }, [chains, labelInterval, showClashes]); // Emp

  const addRNAtoContainer = (container: any, chain: Chain) => {
    try {
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
        extraLinks: showClashes ? clashMap : [],
      };

      container.addRNA(options.structure, options);

      const createZigzagPath = (x1: number, y1: number, x2: number, y2: number) => {
        const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const segments = Math.max(4, Math.floor(length / 8));
        const amplitude = 1;

        let path = `M${x1},${y1}`;

        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          const x = x1 + t * (x2 - x1);
          const y = y1 + t * (y2 - y1);

          const dx = x2 - x1;
          const dy = y2 - y1;
          const lineLength = Math.sqrt(dx * dx + dy * dy);
          const perpX = (-dy / lineLength) * amplitude;
          const perpY = (dx / lineLength) * amplitude;

          const offset = i % 2 === 0 ? 1 : -1;
          path += ` L${x + offset * perpX},${y + offset * perpY}`;
        }

        path += ` L${x2},${y2}`;
        return path;
      };

      d3.selectAll('line.link[link_type="external"]').each(function () {
        try {
          const line = d3.select(this);
          const x1 = parseFloat(line.attr("x1"));
          const y1 = parseFloat(line.attr("y1"));
          const x2 = parseFloat(line.attr("x2"));
          const y2 = parseFloat(line.attr("y2"));

          if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
            const zigzagPath = createZigzagPath(x1, y1, x2, y2);

            const parentElement = (this as Element).parentNode as Element;
            if (parentElement) {
              d3.select(parentElement)
                .append("path")
                .attr("d", zigzagPath)
                .attr("class", "clash-zigzag")
                .style("stroke", "purple")
                .style("stroke-width", "1.5px")
                .style("fill", "none")
                .style("stroke-linecap", "round");
            }

            line.remove();
          }
        } catch (e) {
          console.warn("Error processing external link element:", e);
        }
      });

      var nodes = d3.selectAll("circle.fornac-node");
      nodes.select("title").text("No data");

      chain.nucleotides.forEach((nucleotide, index) => {
        try {
          if (job && job.results && index <= job.results.data.length - 1) {
            d3.select(`circle.fornac-node[node_num="${index + 1}"]`)
              .select("title")
              .text(
                `Residue number: ${nucleotide.index}\n${
                  job.results.data[index].metrics
                    ? `Clash score: ${job.results.data[index].metrics.clashscore}\nBad angles: ${job.results.data[index].metrics.pct_badangles}\nBad bonds: ${job.results.data[index].metrics.pct_badbonds}`
                    : ""
                }`
              );

            d3.selectAll("text.fornac-nodeLabel")
              .filter(function () {
                return d3.select(this).text() === `${index + 1}`;
              })
              .text(`${nucleotide.original_index}`);
          }
        } catch (e) {
          console.warn("Error updating node title/label:", e);
        }
      });
    } catch (e) {
      console.error("addRNAtoContainer error:", e);
    }
  };

  /**
   * **Identyfikacja i łączenie łańcuchów hybrydowych**
   */
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

      const stacks: Record<string, number[]> = {};
      Object.keys(openerToCloser).forEach((op) => (stacks[op] = []));

      for (let idx = 0; idx < chars.length; idx++) {
        const ch = chars[idx];

        if (openerToCloser[ch]) {
          stacks[ch].push(idx);
          continue;
        }

        const opener = closerToOpener[ch];
        if (!opener) {
          continue;
        }

        const stack = stacks[opener];
        if (!stack || stack.length === 0) {
          chars[idx] = ".";
          continue;
        }

        stack.pop();
      }

      Object.values(stacks).forEach((arr) => {
        while (arr.length > 0) {
          const pos = arr.pop();
          if (pos !== undefined) chars[pos] = ".";
        }
      });

      return chars.join("");
    };


  const handleHybridChains = (
    chains: Chain[]
  ):
    | {
        sequence: string;
        dotBracket: string;
        sourceChainNames: string[];
      }
    | null => {
    const isHybridized = (structure: string): boolean => {
      const countOpeners = Array.from(structure).filter((x) =>
        ["(", "[", "{", "<"].includes(x)
      ).length;
      const countClosers = Array.from(structure).filter((x) =>
        [")", "]", "}", ">"].includes(x)
      ).length;
      return countOpeners !== countClosers;
    };

    const hybridizedChains = chains.filter((chain) =>
      isHybridized(chain.dotBracket)
    );

    if (hybridizedChains.length >= 2) {
      return {
        sequence: hybridizedChains.map((chain) => chain.sequence).join(""),
        dotBracket: hybridizedChains.map((chain) => chain.dotBracket).join(""),
        sourceChainNames: hybridizedChains.map((chain) => chain.name),
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
      container.displayDirectionArrows(false);
      d3.selectAll('line.link[link_type="external"]').style(
        "visibility",
        showClashes ? "visible" : "hidden"
      );
      d3.selectAll("path.clash-zigzag").style(
        "visibility",
        showClashes ? "visible" : "hidden"
      );
      // @ts-ignore
      setAnimation ? container.startAnimation() : container.stopAnimation();

      // Spróbuj dopasować skalę/zoom podobnie jak w głównym komponencie Forna
      setTimeout(() => {
        try {
          const currentContainer = container as any;
          const applyScale = (scale: number) => {
            if (currentContainer && typeof currentContainer.zoomTo === "function") {
              currentContainer.zoomTo(scale);
            } else if (currentContainer && typeof currentContainer.zoom === "function") {
              currentContainer.zoom(scale);
            } else if (currentContainer && typeof currentContainer.setScale === "function") {
              currentContainer.setScale(scale);
            } else {
              const svg = document.querySelector("#rna_ss svg") as SVGSVGElement | null;
              const g = svg ? (svg.querySelector("g") as SVGGElement | null) : null;
              if (svg && g) {
                const svgRect = svg.getBoundingClientRect();
                const bbox = g.getBBox();
                const dx = (svgRect.width - bbox.width * scale) / 2 - bbox.x * scale;
                const dy = (svgRect.height - bbox.height * scale) / 2 - bbox.y * scale;
                g.setAttribute("transform", `translate(${dx},${dy}) scale(${scale})`);
              } else if (svg) {
                svg.style.transformOrigin = "center center";
                svg.style.transform = `scale(${scale})`;
              }
            }
          };

          const svgEl = document.querySelector("#rna_ss svg") as SVGSVGElement | null;
          if (svgEl) {
            const g = svgEl.querySelector("g") as SVGGElement | null;
            if (g) {
              const svgRect = svgEl.getBoundingClientRect();
              const bbox = g.getBBox();
              const scaleW = svgRect.width / (bbox.width || svgRect.width);
              const scaleH = svgRect.height / (bbox.height || svgRect.height);
              const scale = Math.min(scaleW, scaleH, 1.4);
              if (scale > 1) {
                const dx = (svgRect.width - bbox.width * scale) / 2 - bbox.x * scale;
                const dy = (svgRect.height - bbox.height * scale) / 2 - bbox.y * scale;
                g.setAttribute("transform", `translate(${dx},${dy}) scale(${scale})`);
              }
            } else {
              applyScale(1.4);
            }
          } else {
            applyScale(1.4);
          }
        } catch (e) {
          console.warn("Scaling Forna summary failed:", e);
        }

        try {
          if (typeof colorGnodes === "function") colorGnodes();
        } catch (e) {
          console.warn("colorGnodes() failed:", e);
        }
      }, 50);
    }
  }, [
    container,
    labelInterval,
    numbering,
    nodeOutline,
    nodeLabel,
    links,
    showClashes,
    directionArrows,
    setAnimation,
    colorGnodes,
  ]);

  return <div className="w-full h-full" id="rna_ss"></div>;
};
export default FornacSummaryComponent;
