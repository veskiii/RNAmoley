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
} from "molstar/lib/mol-model/structure"

import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import { StructureSelectionQuery } from "molstar/lib/mol-plugin-state/helpers/structure-selection-query";



const Molstar = props => {

  const { useInterface, pdbId, url, file, dimensions, className, showControls, showAxes, selectedNts, setSelectedNts, initialized, setInitialized, chains, setChains } = props;
  const parentRef = useRef(null);
  const canvasRef = useRef(null);
  const plugin = useRef(null);
  // const [initialized, setInitialized] = useState(false);
  // const [selectedNts, setSelectedNts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [chainsState, setChainsState] = useState(chains);
  
  useEffect(() => {
    console.log("Chains data in Molstar:", chains);
    chains.map(chain =>{
      console.log(chain.nucleotides);
    })
  }, [chains]);

  useEffect(() => {
    if (plugin.current) {
      console.log("Plugin already initialized");
      return;
    }else{
    (async () => {
      if (useInterface) {
        const spec = DefaultPluginUISpec();
        spec.layout = {
          initial: {
            isExpanded: false,
            controlsDisplay: "reactive",
            showControls,
          }
        };

        // plugin.current = await createPluginUI(parentRef.current, spec);
        plugin.current = await createPluginUI({
          target: parentRef.current,
          spec: spec,
          render: renderReact18,
        });
        
      } else {

        plugin.current = new PluginContext(DefaultPluginSpec());
        plugin.current.initViewer(canvasRef.current, parentRef.current);
        await plugin.current.init();
      }
      if (!showAxes) {
        plugin.current.canvas3d?.setProps({ camera: { helper: { axes: {
          name: "off", params: {}
        } } } });
      }
      await loadStructure(pdbId, url, file, plugin.current);
      setInitialized(true);
    })()};
    // return () => plugin.current = null;
    return () => {
      plugin.current?.dispose();
      plugin.current = null;
      setInitialized(false);
    };
  }, [])


  useEffect(() => {
    if (!initialized) return;
    (async() => {
      await loadStructure(pdbId, url, file, plugin.current);
    })();
  }, [pdbId, url, file])


  useEffect(() => {
    if (plugin.current) {
      if (!showAxes) {
        plugin.current.canvas3d?.setProps({ camera: { helper: { axes: {
          name: "off", params: {}
        } } } })
      } else {
        plugin.current.canvas3d?.setProps({ camera: { helper: {
          axes: ParamDefinition.getDefaultValues(CameraHelperParams).axes
        } } })
      }
    }
  }, [showAxes]) 







// useEffect(() => {
//   // Map through chains and nucleotides to create updated chains with the new selection state
//   const updatedChains = chains.map((chain) => {
//     const updatedNucleotides = chain.nucleotides.map((nucleotide) => {
//       const isSelected = selected.includes(nucleotide.original_index);
//       // Only update if the selection status is different
//       if (nucleotide.selected !== isSelected) {
//         return { ...nucleotide, selected: isSelected };
//       }
//       return nucleotide;
//     });

//     // Return the updated chain with updated nucleotides
//     return {
//       ...chain,
//       nucleotides: updatedNucleotides,
//     };
//   });

//   // Check if there's any change between updatedChains and the current chains state
//   const chainsHaveChanged = !updatedChains.every((chain, index) =>
//     chain.nucleotides.every((nucleotide, i) =>
//       nucleotide.selected === chains[index].nucleotides[i].selected
//     )
//   );

//   // If there were changes, update the chains state
//   if (chainsHaveChanged) {
//     setChains(updatedChains);
//   }
// }, [selected, chains, setChains]); // Dependency array ensures this effect runs when selected or chains change
useEffect(() => {
  setChainsState(chains);  // Zaktualizuj stan na podstawie przekazywanych danych
  console.log("chainsState w pierwszym useEffect:", chainsState);
}, [chains]); 
useEffect(() => {
  if (!plugin.current) return;
console.log("HALO!")

  const atomGroups = chainsState.flatMap(chain =>
    chain.nucleotides.filter(nucleotide => nucleotide.selected === true).map(nucleotide =>
      MS.struct.generator.atomGroups({
        "residue-test": MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.label_seq_id(),
          nucleotide.index,
        ]),
      })
    )
  );
  console.log("atom groups", atomGroups);

  const selectionQuery = StructureSelectionQuery(
    "selected_nucleotides",
    MS.struct.combinator.merge(atomGroups)
  );
  console.log("Selectionquery", selectionQuery);

  plugin.current.managers.structure.selection.fromSelectionQuery("set", selectionQuery);

  const updateLoci = async () => {
    const loci = await plugin.current.managers.structure.selection.fromSelectionQuery(
      "set",
      selectionQuery
    );
    console.log("Loci:", loci);
    if (loci) {
      plugin.current.managers.camera.focusLoci(loci);
      plugin.current.managers.interactivity.lociSelects.select({ loci });
    } else {
      console.warn("No loci found for the selection query");
    }
  };
  console.log(updateLoci());


}, [ plugin.current, chainsState]);


  useEffect(() => {
    console.log("PLUGIN: ", plugin.current);
    
    if (initialized && plugin.current && plugin.current.managers.structure){

      const subscription = plugin.current.behaviors?.interaction?.click.subscribe(async (event) => {
        const selections = Array.from(
          plugin.current.managers.structure.selection.entries.values()
        );
        if (selections.length === 0) {
          console.log("Brak dostępnych selekcji!");
          return;
        }
        
        console.log("Selections:", selections); 
        const localSelected = [];
        for (const { structure } of selections) {
          console.log("AAAAAAAAAa");
          if (!structure) continue;
          console.log("BBBBBBBBBb");
          
          Structure.eachAtomicHierarchyElement(structure, {
            residue: (loc) => {
              const position = StructureProperties.residue.label_seq_id(loc);
              const auth_position = StructureProperties.residue.auth_seq_id(loc);
              console.log(`Kliknięto pozycja: ${position}`, `auth_pos: ${auth_position}`);
              
              // chains.forEach((chain, chainIndex) =>{
                
              //   chain.nucleotides.forEach((nucleotide, index) => {
              //     console.log(chain);
                  
              //     //TODO: zmien na wyszukiwanie po oryginalny id
              //     //nie dziala - co drugi nukleotyd ma dodatkowo zmieniany stan????
                 
              //       console.log(nucleotide.original_index , auth_position);
              //       if(nucleotide.original_index === auth_position){
              //         const newChains = [...chains];
              //         if(!nucleotide.selected)
              //           newChains[chainIndex].nucleotides[index].selected = true;
              //         else
              //           newChains[chainIndex].nucleotides[index].selected = false;
              //         setChains(newChains);
              //         console.log("CO ZMIENIAM: ", chain.nucleotides[index], "original index: ", nucleotide.original_index, "auth_pos: ", auth_position );
              //         return;
              //       }
                 
                  
              //     // newChains[chainIndex].nucleotides[position].selected = !newChains[chainIndex].nucleotides[position].selected;
                  
              //     // console.log(newChains);
                              
              // });
              // }) 

              localSelected.push({ auth_position });

              // localSelected.push({  position });
            },
          });
        }
        // console.log("wybrane obiekty: ",localSelected);
        // setSelectedNts(prevSelected => [...prevSelected, ...localSelected]);
        // console.log(selectedNts);
        setSelected(localSelected);
      })

      return () => {
        subscription?.unsubscribe();
      };
  
    }
    
  }, [setSelected, initialized]);


// //do selekcji:
// useEffect(() => {
//   chainsState.forEach((chain, chainIndex) =>{
                
//     chain.nucleotides.forEach((nucleotide, index) => {
//       console.log(chain);
      
//       //TODO: zmien na wyszukiwanie po oryginalny id
//       //nie dziala - co drugi nukleotyd ma dodatkowo zmieniany stan????
//       selected.forEach(selected_index =>{
//         console.log(nucleotide.original_index , selected_index);
//         if(nucleotide.original_index === selected_index){
//           const newChains = [...chainsState];
//           if(!nucleotide.selected)
//             newChains[chainIndex].nucleotides[index].selected = true;
//           else
//             newChains[chainIndex].nucleotides[index].selected = false;
//           setChains(newChains);
//           console.log("CO ZMIENIAM: ", chain.nucleotides[index], "original index: ", nucleotide.original_index, "auth_pos: ", selected_index );
//           return;
//         }
//       })
      
//       // newChains[chainIndex].nucleotides[position].selected = !newChains[chainIndex].nucleotides[position].selected;
      
//       // console.log(newChains);
                  
//   });
//   }) 
// },[ chainsState, selected, setChains])



useEffect(() => {
  setChainsState(chains); // Synchronizuj lokalny stan
  console.log("chainsState w molstarze:", chainsState);
}, [chains, setChainsState]);

  // useEffect(() => {
  //   console.log("Updated selected:", selected);
  //   console.log("Updated chains in Mol*:", chains);
  
  //   // Create a map for faster lookup of selected indices
  //   const selectedIndices = new Set(selected.map((item) => item.auth_position));
  
  //   // Update chains immutably
  //   const updatedChains = chains.map((chain) => {
  //     const updatedNucleotides = chain.nucleotides.map((nucleotide) => ({
  //       ...nucleotide, // Spread existing nucleotide properties
  //       selected: selectedIndices.has(nucleotide.original_index),
  //     }));
  
  //     return { ...chain, nucleotides: updatedNucleotides };
  //   });
  
  //   setChains(updatedChains);
  
  //   // updated chains
  //   updatedChains.forEach((chain, chainIndex) => {
  //     chain.nucleotides.forEach((nucleotide, index) => {
  //       console.log(
  //         `Nucleotide at index ${index} in chain ${chainIndex} is ${
  //           nucleotide.selected ? "selected" : "not selected"
  //         }: `,
  //         nucleotide
  //       );
  //     });
  //   });
  // }, [setChains, selected]);
  
  
  
  // useEffect(() => {
  //   console.log("pobieranie tablicy1111:", selectedNts);
  //   if (!plugin.current || !selectedNts.length) return;

  //   console.log("pobieranie tablicy:", selectedNts);
  //   // Create selection query for selected nucleotides
  //   const selectionExpressions = selectedNts.map((resId) =>
  //     MS.struct.generator.atomGroups({
  //       "residue-test": MS.core.rel.eq([
  //         MS.struct.atomProperty.macromolecular.label_seq_id(),
  //         resId,
  //       ]),
  //     })
  //   );

  //   // Merge expressions into a single selection query
  //   const selectionQuery = StructureSelectionQuery(
  //     "selected_residues",
  //     MS.struct.combinator.merge(selectionExpressions)
  //   );

  //   // Apply the selection in Mol*
  //   plugin.current.managers.structure.selection.fromSelectionQuery("set", selectionQuery);

  // }, [plugin, selectedNts]);

  const loadStructure = async (pdbId, url, file=null, plugin) => {
    console.log("FETCHUJE:", pdbId);
    if (plugin) {
      plugin.clear();
      if (file) {
        console.log(file)
        console.log("FILE TYPE:",file.type);
        const data = await plugin.builders.data.rawData({
          data: file //await file.text()
        });
        const traj = await plugin.builders.structure.parseTrajectory(data, "pdb");
        await plugin.builders.structure.hierarchy.applyPreset(traj, "default");

      } else {
        const structureUrl = url ? url : pdbId ? `https://files.rcsb.org/view/${pdbId}.cif` : null;
        if (!structureUrl) return;
        const data = await plugin.builders.data.download(
          { url: structureUrl }, {state: {isGhost: true}}
        );
        let extension = structureUrl.split(".").pop().replace("cif", "mmcif");
        if (extension.includes("?"))
          extension = extension.substring(0, extension.indexOf("?"));
        const traj = await plugin.builders.structure.parseTrajectory(data, extension);
        await plugin.builders.structure.hierarchy.applyPreset(traj, "default");
      }
      console.log("Załadowano strukturę.");
    }
  }


  const width = "100%";
  const height = 600;

  if (useInterface) {
    return (
      <div style={{position: "absolute", width, height, overflow: "hidden", top: "10%"}}>
        <div ref={parentRef} style={{position: "absolute", left: 0, top: 0, right: 0, bottom: 0}} />
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      style={{position: "relative", width, height}}
      className={className || ""}
    >
      <canvas
        ref={canvasRef}
        style={{position: "absolute", top: 0, left: 0, right: 0, bottom: 0}}
      />
    </div>
  );
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
  setChains: PropTypes.func,
  initialized: PropTypes.bool,
  setInitialized: PropTypes.func,
};

export default Molstar;