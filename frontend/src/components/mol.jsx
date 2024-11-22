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

  const { useInterface, pdbId, url, file, dimensions, className, showControls, showAxes, selectedNts, setSelectedNts, initialized, setInitialized } = props;//
  const parentRef = useRef(null);
  const canvasRef = useRef(null);
  const plugin = useRef(null);
  // const [initialized, setInitialized] = useState(false);
  // const [selectedNts, setSelectedNts] = useState([]);
  
  useEffect(() => {
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
    })();
    return () => plugin.current = null;
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

  useEffect(() => {
    
    if (initialized && plugin.current && plugin.current.managers.structure){

      const subscription = plugin.current.behaviors?.interaction?.click.subscribe( (event) => {
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
              console.log(`Kliknięto pozycja: ${position}`);
              localSelected.push({  position });
            },
          });
        }
        console.log("wybrane obiekty: ",localSelected);
        setSelectedNts(localSelected);
        console.log(selectedNts);
      })

      return () => {
        subscription?.unsubscribe();
      };
  
    }
    
  }, [setSelectedNts, initialized]);

  useEffect(() => {
    console.log("Updated selectedNts:", selectedNts);
  }, [selectedNts]);
  
  useEffect(() => {
    console.log("pobieranie tablicy1111:", selectedNts);
    if (!plugin.current || !selectedNts.length) return;

    console.log("pobieranie tablicy:", selectedNts);
    // Create selection query for selected nucleotides
    const selectionExpressions = selectedNts.map((resId) =>
      MS.struct.generator.atomGroups({
        "residue-test": MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.label_seq_id(),
          resId,
        ]),
      })
    );

    // Merge expressions into a single selection query
    const selectionQuery = StructureSelectionQuery(
      "selected_residues",
      MS.struct.combinator.merge(selectionExpressions)
    );

    // Apply the selection in Mol*
    plugin.current.managers.structure.selection.fromSelectionQuery("set", selectionQuery);

    // Optional: Focus the camera on the selected loci for better visibility
    const loci = plugin.current.managers.structure.selection.toLociWithSourceUnits(
      selectionQuery
    );
    plugin.current.managers.camera.focusLoci(loci);

  }, [plugin, selectedNts]);

  const loadStructure = async (pdbId, url, file, plugin) => {
    if (plugin) {
      plugin.clear();
      if (file) {
        const data = await plugin.builders.data.rawData({
          data: file.filestring
        });
        const traj = await plugin.builders.structure.parseTrajectory(data, file.type);
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
  file: PropTypes.object,
  dimensions: PropTypes.array,
  showControls: PropTypes.bool,
  showAxes: PropTypes.bool,
  className: PropTypes.string,
  selectedNts: PropTypes.arrayOf(PropTypes.number).isRequired,
  setSelectedNts: PropTypes.func.isRequired,
  initialized: PropTypes.bool,
  setInitialized: PropTypes.func,
};

export default Molstar;