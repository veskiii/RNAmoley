import React, {useEffect, useRef, useState} from "react";
import PropTypes from "prop-types";
import {DefaultPluginSpec} from "molstar/lib/mol-plugin/spec";
import {DefaultPluginUISpec} from "molstar/lib/mol-plugin-ui/spec";
import {createPluginUI} from "molstar/lib/mol-plugin-ui/index";
import {PluginContext} from "molstar/lib/mol-plugin/context";
import "molstar/build/viewer/molstar.css";
import {ParamDefinition} from "molstar/lib/mol-util/param-definition";
import {CameraHelperParams} from "molstar/lib/mol-canvas3d/helper/camera-helper";
import {renderReact18} from "molstar/lib/mol-plugin-ui/react18";
import {
    Structure, StructureProperties,
} from "molstar/lib/mol-model/structure"
import {MolScriptBuilder as MS} from "molstar/lib/mol-script/language/builder";
import {StructureSelectionQuery} from "molstar/lib/mol-plugin-state/helpers/structure-selection-query";
import {PluginCommands} from 'molstar/lib/mol-plugin/commands';
import {
    BadAnglesColorThemeProvider,
    BadBondsColorThemeProvider,
    ClashScoreThemeProvider
} from "./ColorByQuality";

const Molstar = props => {

    const {
        useInterface,
        pdbId,
        url,
        file,
        dimensions,
        className,
        showControls,
        showAxes,
        selectedNts,
        setSelectedNts,
        initialized,
        setInitialized,
        chains,
        setChains,
        is3dEnabled,
    } = props;
    const parentRef = useRef(null);
    const canvasRef = useRef(null);
    const plugin = useRef(null);
    // const [initialized, setInitialized] = useState(false);
    // const [selectedNts, setSelectedNts] = useState([]);
    const [selected, setSelected] = useState([]);
    const [enableSelection, setEnableSelection] = useState(false);

    function changeNucleotideColors() {
        console.info("Kolorowanie nukleotyd!");

        if (!plugin.current) {
            console.warn("Plugin nie został zainicjalizowany!");
            return;
        }
        plugin.current.representation.structure.themes.colorThemeRegistry.add(ClashScoreThemeProvider);
        plugin.current.representation.structure.themes.colorThemeRegistry.add(BadBondsColorThemeProvider);
        plugin.current.representation.structure.themes.colorThemeRegistry.add(BadAnglesColorThemeProvider);
    }

    useEffect(() => {
        if (initialized) {
            changeNucleotideColors()
        }
    }, [initialized]);

    useEffect(() => {
        if (plugin.current) {
            console.log("Plugin already initialized");
            return;
        } else {
            (async () => {
                if (useInterface) {
                    const spec = DefaultPluginUISpec();
                    spec.layout = {
                        initial: {
                            isExpanded: false, controlsDisplay: "reactive", showControls,
                        }
                    };

                    plugin.current = await createPluginUI({
                        target: parentRef.current, spec: spec, render: renderReact18,
                    });

                } else {

                    plugin.current = new PluginContext(DefaultPluginSpec());
                    plugin.current.initViewer(canvasRef.current, parentRef.current);
                    await plugin.current.init();
                }
                if (!showAxes) {
                    plugin.current.canvas3d?.setProps({
                        camera: {
                            helper: {
                                axes: {
                                    name: "off", params: {}
                                }
                            }
                        }
                    });
                }
                await loadStructure(pdbId, url, file, plugin.current);
                setInitialized(true);
            })()
        }

        return () => {
            plugin.current?.dispose();
            plugin.current = null;
            setInitialized(false);
        };
    }, [])


    useEffect(() => {
        if (!initialized) return;
        (async () => {
            await loadStructure(pdbId, url, file, plugin.current);
        })();
    }, [pdbId, url, file])


    useEffect(() => {
        if (plugin.current) {
            if (!showAxes) {
                plugin.current.canvas3d?.setProps({
                    camera: {
                        helper: {
                            axes: {
                                name: "off", params: {}
                            }
                        }
                    }
                })
            } else {
                plugin.current.canvas3d?.setProps({
                    camera: {
                        helper: {
                            axes: ParamDefinition.getDefaultValues(CameraHelperParams).axes
                        }
                    }
                })
            }
        }
    }, [showAxes])

//Odczyt chains - wywołanie jednokrotne, tylko po otworzeniu komponentu
//Zaznaczanie elementów na podstawie parametru selected w nucleotides
    useEffect(() => {
        setEnableSelection(false);
        if (!plugin.current) return;
        console.log("oDCZYT!")

        const atomGroups = chains.flatMap(chain => chain.nucleotides.filter(nucleotide => nucleotide.selected === true).map(nucleotide => MS.struct.generator.atomGroups({
            "residue-test": MS.core.rel.eq([MS.struct.atomProperty.macromolecular.label_seq_id(), nucleotide.index,]),
        })));
        console.log("atom groups", atomGroups);

        const selectionQuery = StructureSelectionQuery("selected_nucleotides", MS.struct.combinator.merge(atomGroups));
        console.log("Selectionquery", selectionQuery);

        plugin.current.managers.structure.selection.fromSelectionQuery("set", selectionQuery);

        const updateLoci = async () => {
            const loci = await plugin.current.managers.structure.selection.fromSelectionQuery("set", selectionQuery);
            console.log("Loci:", loci);
            if (loci) {
                plugin.current.managers.camera.focusLoci(loci);
                plugin.current.managers.interactivity.lociSelects.select({loci});
            } else {
                console.warn("No loci found for the selection query");
            }
        };
        console.log(updateLoci());

    }, [plugin.current, chains]);

//ZAPIS
//Tworzenie tablicy indeksów elementów zaznaczonych na podstawie zmiany na widoku
    useEffect(() => {
        if (is3dEnabled) {
            document.body.addEventListener('click', () => {
                console.log("PLUGIN: ", plugin.current);

                if (initialized && plugin.current && plugin.current.managers.structure) {

                    console.log("przed subskrypcja")
                    const subscription = plugin.current.behaviors?.interaction?.click.subscribe(async (event) => {

                        const selections = Array.from(plugin.current.managers.structure.selection.entries.values());
                        if (selections.length === 0) {
                            console.log("Brak dostępnych selekcji!");
                            return;
                        }

                        console.log("Selections:", selections);
                        const localSelected = [];
                        for (const {structure} of selections) {
                            console.log("AAAAAAAAAa");
                            if (!structure) continue;
                            console.log("BBBBBBBBBb");

                            Structure.eachAtomicHierarchyElement(structure, {
                                residue: (loc) => {
                                    const position = StructureProperties.residue.label_seq_id(loc);
                                    const auth_position = StructureProperties.residue.auth_seq_id(loc);
                                    console.log(`Kliknięto pozycja: ${position}`, `auth_pos: ${auth_position}`);

                                    localSelected.push({position});
                                },
                            });
                        }

                        setSelected(localSelected);
                        setEnableSelection(true);
                    })

                    return () => {
                        subscription?.unsubscribe();
                    };

                }
            });
        }
    }, [initialized]);//set
    // ,

//Zapis do chains
//Zmiana selected w nucleotides na podstawie tablicy selected
    useEffect(() => {
        console.log(enableSelection, typeof enableSelection);
        if (enableSelection === true) {
            console.log("Updated selected:", selected);
            console.log("Updated chains in Mol*:", chains);

            // Create a map for faster lookup of selected indices
            const selectedIndices = new Set(selected.map((item) => item.position));

            // Update chains immutably
            const updatedChains = chains.map((chain) => {
                const updatedNucleotides = chain.nucleotides.map((nucleotide) => ({
                    ...nucleotide, // Spread existing nucleotide properties
                    selected: selectedIndices.has(nucleotide.index),
                }));

                return {...chain, nucleotides: updatedNucleotides};
            });

            setChains(updatedChains);

            console.log("Updated chains (after update):", updatedChains);

        }

    }, [selected, setChains, enableSelection]);

    // Funkcja iterująca przez wszystkie nukleotydy i ustawiająca ich kolor w zależności od ID

    const loadStructure = async (pdbId, url, file = null, plugin) => {
        console.log("FETCHUJE:", pdbId);
        if (plugin) {
            plugin.clear();
            if (file) {
                console.log(file)
                console.log("FILE TYPE:", file.type);
                const data = await plugin.builders.data.rawData({
                    data: file //await file.text()
                });
                const traj = await plugin.builders.structure.parseTrajectory(data, "pdb");
                await plugin.builders.structure.hierarchy.applyPreset(traj, "default");

            } else {
                const structureUrl = url ? url : pdbId ? `https://files.rcsb.org/view/${pdbId}.cif` : null;
                if (!structureUrl) return;
                const data = await plugin.builders.data.download({url: structureUrl}, {state: {isGhost: true}});
                let extension = structureUrl.split(".").pop().replace("cif", "mmcif");
                if (extension.includes("?")) extension = extension.substring(0, extension.indexOf("?"));
                const traj = await plugin.builders.structure.parseTrajectory(data, extension);
                await plugin.builders.structure.hierarchy.applyPreset(traj, "default");
            }
            console.log("Załadowano strukturę.");
        }
    }

    const width = "100%";
    const height = "100%";

    if (useInterface) {
        return (<div style={{position: "relative", width, height, overflow: "hidden"}}>
            <div ref={parentRef} style={{position: "absolute", left: 0, top: 0, right: 0, bottom: 0}}/>
        </div>)
    }

    return (<div
        ref={parentRef}
        style={{position: "relative", width, height}}
        className={className || ""}
    >
        <canvas
            ref={canvasRef}
            style={{position: "absolute", top: 0, left: 0, right: 0, bottom: 0}}
        />
    </div>);
};

Molstar.propTypes = {
    useInterface: PropTypes.bool,
    pdbId: PropTypes.string,
    url: PropTypes.string,
    file: PropTypes.string,
    dimensions: PropTypes.array,
    showControls: PropTypes.bool,
    showAxes: PropTypes.bool,
    className: PropTypes.string,
    chains: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string.isRequired,
        sequence: PropTypes.string.isRequired,
        dotBracket: PropTypes.string.isRequired,
        nucleotides: PropTypes.arrayOf(PropTypes.shape({
            index: PropTypes.number.isRequired,
            original_index: PropTypes.number.isRequired,
            base: PropTypes.string.isRequired,
            structure: PropTypes.string.isRequired,
            selected: PropTypes.bool.isRequired,
        })).isRequired,
    })).isRequired,
    setChains: PropTypes.func,
    initialized: PropTypes.bool,
    setInitialized: PropTypes.func,
    is3dEnabled: PropTypes.bool,
};

export default Molstar;