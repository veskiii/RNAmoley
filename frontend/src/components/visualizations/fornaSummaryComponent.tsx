import React, {useEffect} from "react";
import * as d3 from "d3";
import {Job} from "../panels/summaryPanel"

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

const FornacSummaryComponent = ({
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
                                    job
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
    job: Job;
}) => {
    /**
     * **Inicjalizacja kontenera `FornaContainer`**
     */
    const initializeContainer = () => {
        return new fornac.FornaContainer("#rna_ss", {
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
    };

    /**
     * **Dodawanie RNA do kontenera**
     */
    const addRNAtoContainer = (container: any, chain: Chain) => {
        const options = {
            structure: chain.dotBracket,
            sequence: chain.sequence,
        };

        container.addRNA(options.structure, options);

        var nodes = d3.selectAll('circle.fornac-node');
        nodes.select("title").text('No data');
        // Aktualizacja węzłów D3 na podstawie `nucleotide` w `chain`
        chain.nucleotides.forEach((nucleotide, index) => {

            d3.select(`circle.fornac-node[node_num="${index + 1}"]`)
                .select("title")
                .text(`Residue number: ${nucleotide.index}\nClash score: ${job.results.data[index].metrics.clashscore}\nBad angles: ${job.results.data[index].metrics.numbadangles}\nBad bonds: ${job.results.data[index].metrics.numbadbonds}`);


            d3.selectAll("text.fornac-nodeLabel")
                .filter(function () {
                    return d3.select(this).text() === `${index + 1}`;
                })
                .text(`${nucleotide.original_index}`);
        });
    };

    /**
     * **Identyfikacja i łączenie łańcuchów hybrydowych**
     */
    const handleHybridChains = (chains: Chain[]): { sequence: string; dotBracket: string } | null => {
        const isHybridized = (structure: string): boolean => {
            const countOpeners = Array.from(structure).filter((x) =>
                ["(", "["].includes(x)
            ).length;
            const countClosers = Array.from(structure).filter((x) =>
                [")", "]"].includes(x)
            ).length;
            return countOpeners !== countClosers;
        };

        const hybridizedChains = chains.filter((chain) =>
            isHybridized(chain.dotBracket)
        );

        if (hybridizedChains.length > 2) {
            console.log("Możesz połączyć maksymalnie 2 łańcuchy hybrydowe");
            return null;
        }

        if (hybridizedChains.length === 2) {
            return {
                sequence: hybridizedChains[0].sequence + hybridizedChains[1].sequence,
                dotBracket:
                    hybridizedChains[0].dotBracket + hybridizedChains[1].dotBracket,
            };
        }

        return null;
    };

    useEffect(() => {
        const container = initializeContainer();

        try {
            const hybridizedChains = handleHybridChains(chains);

            // Dodaj standardowe łańcuchy (nie-hybrydowe)
            chains.forEach((chain) => {
                if (!hybridizedChains || chain.sequence !== hybridizedChains.sequence) {
                    addRNAtoContainer(container, chain);
                }
            });

            // Dodaj RNA połączony z hybrydyzowanych łańcuchów, jeśli istnieje
            if (hybridizedChains !== null) {
                addRNAtoContainer(container, {
                    name: "hybrid",
                    sequence: hybridizedChains.sequence,
                    dotBracket: hybridizedChains.dotBracket,
                    nucleotides: [], // Domyślne wartości
                });
            }

            // Wyświetl parametry kontenera
            container.displayNumbering(numbering);
            container.displayNodeOutline(nodeOutline);
            container.displayNodeLabel(nodeLabel);
            container.displayLinks(links);
            container.displayDirectionArrows(directionArrows);

            setAnimation ? container.startAnimation() : container.stopAnimation();
        } catch (error) {
            console.error("Błąd przy dodawaniu RNA:", error);
        }
    }, [chains, labelInterval, numbering, nodeOutline, nodeLabel, links, directionArrows, setAnimation]);

    return <div className="w-full h-full" id="rna_ss"></div>;
};
export default FornacSummaryComponent;