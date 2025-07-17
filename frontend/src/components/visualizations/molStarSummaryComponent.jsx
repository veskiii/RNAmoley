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

import { Color } from "molstar/lib/mol-util/color";
import { StructureSelection } from "molstar/lib/mol-model/structure";
import { Script } from "molstar/lib/mol-script/script";
import {
  MolScriptBuilder as MS,
  MolScriptBuilder,
} from "molstar/lib/mol-script/language/builder";
import { Expression } from "molstar/lib/mol-script/language/expression";
import { StructureSelectionQuery } from "molstar/lib/mol-plugin-state/helpers/structure-selection-query";
import {
  clearStructureOverpaint,
  setStructureOverpaint,
} from "molstar/lib/mol-plugin-state/helpers/structure-overpaint";
import { QualityScore } from "../utils/types";
import { getColor } from "../utils/ColorUtils";

const Molstar = (props) => {
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
    resultResidues,
    selectedQualityScore,
  } = props;
  const parentRef = useRef(null);
  const canvasRef = useRef(null);
  const plugin = useRef(null);
  const [canColor, setCanColor] = useState(false);

  const mapResiduesToColors = () => {
    if (selectedQualityScore == QualityScore.BAD_ANGLES) {
      return resultResidues.map((residue) => [
        residue.residueMetrics.residue.trim().split(/\s+/)[0],
        residue.residue_number,
        getColor(residue, QualityScore.BAD_ANGLES),
      ]);
    } else if (selectedQualityScore == QualityScore.BAD_BONDS) {
      return resultResidues.map((residue) => [
        residue.residueMetrics.residue.trim().split(/\s+/)[0],
        residue.residue_number,
        getColor(residue, QualityScore.BAD_BONDS),
      ]);
    } else if (selectedQualityScore == QualityScore.CLASH_SCORE) {
      return resultResidues.map((residue) => [
        residue.residueMetrics.residue.trim().split(/\s+/)[0],
        residue.residue_number,
        getColor(residue, QualityScore.CLASH_SCORE),
      ]);
    } else if (selectedQualityScore == QualityScore.SUGAR_PUCKER_OUT) {
      return resultResidues.map((residue) => [
        residue.residueMetrics.residue.trim().split(/\s+/)[0],
        residue.residue_number,
        getColor(residue, QualityScore.SUGAR_PUCKER_OUT),
      ]);
    } else if (selectedQualityScore == QualityScore.SUITENESS) {
      return resultResidues.map((residue) => [
        residue.residueMetrics.residue.trim().split(/\s+/)[0],
        residue.residue_number,
        getColor(residue, QualityScore.SUITENESS),
      ]);
    } else {
      return [];
    }
  };

  const changeNucleotideColors = async () => {
    if (!plugin.current) {
      console.warn("Plugin not initialized.");
      return;
    }

    if (!resultResidues[0].residueMetrics) return;

    const structure =
      plugin.current.managers.structure.hierarchy.current.structures[0];
    const data =
      plugin.current.managers.structure.hierarchy.current.structures[0]?.cell
        .obj?.data;

    await clearStructureOverpaint(plugin.current, structure.components);

    const residueColors = mapResiduesToColors();

    const groupedByColor = {};

    residueColors.forEach(([chain, number, color]) => {
      if (!groupedByColor[color]) {
        groupedByColor[color] = [];
      }
      groupedByColor[color].push([chain, number, color]);
    });
    for (const color in groupedByColor) {
      const entries = groupedByColor[color];

      const groups: Expression[] = [];
      for (var chain of entries) {
        groups.push(
          MS.struct.generator.atomGroups({
            "chain-test": MS.core.rel.eq([
              MolScriptBuilder.struct.atomProperty.macromolecular.auth_asym_id(),
              chain[0],
            ]),
            "residue-test": MS.core.rel.eq([
              MolScriptBuilder.struct.atomProperty.macromolecular.label_seq_id(),
              chain[1],
            ]),
          })
        );
      }
      var sq = StructureSelectionQuery(
        "selection_" + color,
        MS.struct.combinator.merge(groups)
      );

      const sel = Script.getStructureSelection(
        MS.struct.combinator.merge(groups),
        data
      );
      const loci = StructureSelection.toLociWithSourceUnits(sel);

      const getLoci = async (s: Structure) => loci;

      await setStructureOverpaint(
        plugin.current,
        structure.components,
        Color(parseInt(color.replace("#", ""), 16)),
        getLoci
      );
      //   return;
    }
  };

  useEffect(() => {
    if (initialized) {
      changeNucleotideColors();
    }
  }, [initialized, resultResidues, selectedQualityScore]);

  useEffect(() => {
    console.log("Initializing Molstar plugin...");
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
            },
          };

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
          plugin.current.canvas3d?.setProps({
            camera: {
              helper: {
                axes: {
                  name: "off",
                  params: {},
                },
              },
            },
          });
        }
        await loadStructure(pdbId, url, file, plugin.current);
        const timer = setTimeout(() => {
          setInitialized(true);
        }, 2000);
        return () => clearTimeout(timer);
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
      await loadStructure(pdbId, url, file, plugin.current);
    })();
  }, [pdbId, url, file]);

  useEffect(() => {
    if (plugin.current) {
      if (!showAxes) {
        plugin.current.canvas3d?.setProps({
          camera: {
            helper: {
              axes: {
                name: "off",
                params: {},
              },
            },
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

  const loadStructure = async (pdbId, url, file = null, plugin) => {
    //console.log("Fetching:", pdbId);
    if (plugin) {
      plugin.clear();
      if (file) {
        //console.log(file)
        //console.log("FILE TYPE:", file.type);
        const data = await plugin.builders.data.rawData({
          data: file, //await file.text()
        });
        const traj = await plugin.builders.structure.parseTrajectory(
          data,
          "pdb"
        );
        await plugin.builders.structure.hierarchy.applyPreset(traj, "default");
      } else {
        const structureUrl = url
          ? url
          : pdbId
          ? `https://files.rcsb.org/view/${pdbId}.cif`
          : null;
        if (!structureUrl) return;
        const data = await plugin.builders.data.download(
          { url: structureUrl },
          { state: { isGhost: true } }
        );
        let extension = structureUrl.split(".").pop().replace("cif", "mmcif");
        if (extension.includes("?"))
          extension = extension.substring(0, extension.indexOf("?"));
        const traj = await plugin.builders.structure.parseTrajectory(
          data,
          extension
        );
        await plugin.builders.structure.hierarchy.applyPreset(traj, "default");
      }
      //console.log("Structure loaded.");
    }
  };

  const width = "100%";
  const height = "100%";

  if (useInterface) {
    return (
      <div style={{ position: "relative", width, height, overflow: "hidden" }}>
        <div
          ref={parentRef}
          style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
        />
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
  is3dEnabled: PropTypes.bool,
  resultResidues: PropTypes.array.isRequired,
  selectedQualityScore: PropTypes.any.isRequired,
};

export default Molstar;
