import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
import { DefaultPluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import { createPluginUI } from "molstar/lib/mol-plugin-ui/index";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import "molstar/build/viewer/molstar.css";
import { ParamDefinition } from "molstar/lib/mol-util/param-definition";
import { CameraHelperParams } from "molstar/lib/mol-canvas3d/helper/camera-helper";
import { renderReact18 } from "molstar/lib/mol-plugin-ui/react18";
import {
  Structure,
  StructureProperties,
} from "molstar/lib/mol-model/structure";
import { PluginConfig } from "molstar/lib/mol-plugin/config";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import { StructureSelectionQuery } from "molstar/lib/mol-plugin-state/helpers/structure-selection-query";

const Molstar = (props) => {
  const {
    useInterface,
    pdbId,
    url,
    file,
    className,
    showControls,
    showAxes,
    initialized,
    setInitialized,
    chains,
    selectResidue,
    deselectResidue,
    setIsViewInitialized,
  } = props;
  const parentRef = useRef(null);
  const canvasRef = useRef(null);
  const plugin = useRef(null);
  const [selected, setSelected] = useState([]);
  const [enableSelection, setEnableSelection] = useState(false);

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
              isExpanded: false,
              controlsDisplay: "reactive",
              showControls,
              regionState: {
                right: "hidden",
                bottom: "hidden",
                left: "collapsed",
              },
            },
          };

          spec.config = [
            [PluginConfig.VolumeStreaming.Enabled, true],
            [PluginConfig.Viewport.ShowSelectionMode, true],
            [PluginConfig.Viewport.ShowSettings, true],
            [PluginConfig.Viewport.ShowAnimation, true],
            [PluginConfig.Viewport.ShowTrajectoryControls, true],
            [PluginConfig.Viewport.ShowControls, true],
          ];

          plugin.current = await createPluginUI({
            target: parentRef.current,
            spec: spec,
            render: renderReact18,
          });
        } else {
          plugin.current = new PluginContext(DefaultPluginSpec());
          plugin.current.initViewer(canvasRef.current, parentRef.current);
        }
        if (!showAxes) {
          plugin.current.canvas3d?.setProps({
            camera: {
              show: true,
            },
          });
        }
        await loadStructure(plugin.current, file);
        setInitialized(true);
        setIsViewInitialized(true);
      })();
    }
    return () => {
      plugin.current?.dispose();
      plugin.current = null;
      setInitialized(false);
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;
    (async () => {
      await loadStructure(plugin.current, file);
    })();
  }, [pdbId, url, file]);

  useEffect(() => {
    if (plugin.current) {
      if (!showAxes) {
        plugin.current.canvas3d?.setProps({
          camera: {
            show: true,
          },
        });
      } else {
        plugin.current.canvas3d?.setProps({
          camera: {
            helper: {
              axes: ParamDefinition.getDefaultValues(CameraHelperParams).axes,
            },
          },
        });
      }
    }
  }, [showAxes]);

  //Odczyt chains - wywołanie jednokrotne, tylko po otworzeniu komponentu
  //Zaznaczanie elementów na podstawie parametru selected w nucleotides
  useEffect(() => {
    setEnableSelection(false);
    if (!plugin.current) return;

    const atomGroups = chains.flatMap((chain) =>
      chain.nucleotides
        .filter((nucleotide) => nucleotide.selected === true)
        .map((nucleotide) =>
          MS.struct.generator.atomGroups({
            "residue-test": MS.core.rel.eq([
              MS.struct.atomProperty.macromolecular.label_seq_id(),
              nucleotide.index,
            ]),
          })
        )
    );

    const selectionQuery = StructureSelectionQuery(
      "selected_nucleotides",
      MS.struct.combinator.merge(atomGroups)
    );

    plugin.current.managers.structure.selection.fromSelectionQuery(
      "set",
      selectionQuery
    );
  }, [plugin.current, chains]);

  //ZAPIS
  //Tworzenie tablicy indeksów elementów zaznaczonych na podstawie zmiany na widoku
  useEffect(() => {
    document.body.addEventListener("click", () => {
      if (initialized && plugin.current && plugin.current.managers.structure) {
        const subscription =
          plugin.current.behaviors?.interaction?.click.subscribe(
            async (event) => {
              const selections = Array.from(
                plugin.current.managers.structure.selection.entries.values()
              );

              if (selections.length === 0) {
                return;
              }

              const localSelected = [];
              for (const { structure } of selections) {
                if (!structure) continue;
                Structure.eachAtomicHierarchyElement(structure, {
                  residue: (loc) => {
                    const position = StructureProperties.residue.label_seq_id(loc);
                    const chain = StructureProperties.chain.label_asym_id(loc);
                    localSelected.push({ position, chain });
                  },
                });
              }

              setSelected((prevSelected) => {
                // Nowe wybrane
                const newSelected = localSelected.map(sel => {
                  const wasSelected = chains.find( c => c.name.slice(-1) === sel.chain)
                    .nucleotides.some(
                      nucleotide =>
                        nucleotide.index === sel.position &&
                        nucleotide.selected === true
                    );

                  return {
                    ...sel,
                    status: wasSelected ? "kept" : "added"
                  };
                });

                // Odznaczone
                const removed = prevSelected
                  .filter(
                    prev =>
                      !localSelected.some(
                        sel => sel.position === prev.position && sel.chain === prev.chain
                      ) && prev.status !== "removed"
                  )
                  .map(prev => ({
                    ...prev,
                    status: "removed"
                  }));

                // Jeśli nie ma zmian, nie aktualizuj stanu
                if (
                  newSelected.length === prevSelected.length &&
                  newSelected.every((item, idx) =>
                    item.position === prevSelected[idx].position &&
                    item.chain === prevSelected[idx].chain &&
                    (item.status === prevSelected[idx].status || prevSelected[idx].status === "kept")
                  )
                ) {
                  return prevSelected;
                }

                setEnableSelection(true);
                console.log("New selection:", newSelected);
                console.log("Removed selection:", removed);
                return [...newSelected, ...removed];
              });
            }
          );

        return () => {
          subscription?.unsubscribe();
        };
      }
    });
  }, [initialized]);

  //Zapis do chains
  //Zmiana selected w nucleotides na podstawie tablicy selected
  useEffect(() => {
    if (enableSelection === true) {
      console.log("Selected residues:", selected);
      selected.forEach((item) => {
        const { position, chain } = item;
        const chainIndex = chains.findIndex(
          (c) => c.name.slice(-1) === chain
        );
        if (chainIndex !== -1) {
          const nucleotideIndex = chains[chainIndex].nucleotides.findIndex(
            (nucleotide) => nucleotide.index === position
          );
          if (nucleotideIndex !== -1 && item.status == "added") {
            selectResidue(chain, position);
          }
          if (nucleotideIndex !== -1 && item.status == "removed") {
            deselectResidue(chain, position);
          }
        }
      });
    }
  }, [selected, enableSelection]);

  const loadStructure = async (plugin, file = null) => {
    if (plugin) {
      plugin.clear();
      if (file) {
        const data = await plugin.builders.data.rawData({
          data: file,
        });
        const traj = await plugin.builders.structure.parseTrajectory(
          data,
          "pdb"
        );
        await plugin.builders.structure.hierarchy.applyPreset(traj, "default");
      }
    }
  };
  const hideOptions = () => {
    const options = [
      ...document.querySelectorAll('[title="Home"]'),
      ...document.querySelectorAll('[title="Plugin State"]'),
      ...document.querySelectorAll('[title="Remove All"]'),
      ...document.querySelectorAll(
        '[class="msp-btn msp-btn-icon-small msp-btn-link-toggle-off"]'
      ),
    ];
    options.forEach((option) => {
      option.style.visibility = "hidden";
      option.style.width = "0px";
      option.style.height = "0px";
      option.style.flex = "0px";
    });
  };
  useEffect(() => {
    const handleHidingOptions = () => {
      hideOptions();
    };
    document.body.addEventListener("click", handleHidingOptions);
    return () => {
      document.body.removeEventListener("click", handleHidingOptions);
    };
  }, []);
  const width = "50%";
  const height = "80%";

  if (useInterface) {
    return (
      // <div
      //   // style={{
      //   //   position: "absolute",
      //   //   width,
      //   //   height,
      //   //   overflow: "hidden",
      //   //   top: "20%",
      //   //   zIndex: "1000",
      //   // }}
      //   className="flex-grow relative h-1/2"
      // >
      //   <div
      //     ref={parentRef}
      //     style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
      //   />
      // </div>
      <div className="h-full relative">
        <div ref={parentRef} className="w-full h-full" />
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      style={{ position: "relative", width, height }}
      className={className || ""}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </div>
  );
};

Molstar.propTypes = {
  useInterface: PropTypes.bool,
  pdbId: PropTypes.string,
  url: PropTypes.string,
  file: PropTypes.string,
  showControls: PropTypes.bool,
  showAxes: PropTypes.bool,
  className: PropTypes.string,
  chains: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      sequence: PropTypes.string.isRequired,
      dotBracket: PropTypes.string.isRequired,
      nucleotides: PropTypes.arrayOf(
        PropTypes.shape({
          index: PropTypes.number.isRequired,
          original_index: PropTypes.number.isRequired,
          base: PropTypes.string.isRequired,
          structure: PropTypes.string.isRequired,
          selected: PropTypes.bool.isRequired,
        })
      ).isRequired,
    })
  ).isRequired,
  selectResidue: PropTypes.func,
  deselectResidue: PropTypes.func,
  initialized: PropTypes.bool,
  setInitialized: PropTypes.func,
  setIsViewInitialized: PropTypes.func,
};

export default Molstar;
