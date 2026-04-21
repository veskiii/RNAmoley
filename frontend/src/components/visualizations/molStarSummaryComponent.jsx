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
import {
  clearStructureOverpaint,
  setStructureOverpaint,
} from "molstar/lib/mol-plugin-state/helpers/structure-overpaint";
import { QualityScore } from "../utils/types";
import { getColor } from "../utils/ColorUtils";

const SUPPORTED_QUALITY_SCORES = new Set([
  QualityScore.BAD_ANGLES,
  QualityScore.BAD_BONDS,
  QualityScore.CLASH_SCORE,
  QualityScore.SUGAR_PUCKER_OUT,
  QualityScore.SUITENESS,
]);

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
  const coloringRunId = useRef(0);
  const isStructureLoading = useRef(false);
  const [canColor, setCanColor] = useState(false);
  const [isContainerReady, setIsContainerReady] = useState(false);

  const mapResiduesToColors = () => {
    if (!SUPPORTED_QUALITY_SCORES.has(selectedQualityScore)) {
      return [];
    }

    return resultResidues
      .map((residue) => {
        const metricsResidue = residue?.residueMetrics?.residue;
        const parsedChain = metricsResidue?.trim()?.split(/\s+/)?.[0];
        const chainId = residue?.chainID || parsedChain;
        const authResidueNumber = Number(residue?.original_index);
        const labelResidueNumber = Number(residue?.residue_number);

        if (!chainId || Number.isNaN(authResidueNumber)) {
          return null;
        }

        return {
          chainId,
          authResidueNumber,
          labelResidueNumber,
          color: getColor(residue, selectedQualityScore),
        };
      })
      .filter(Boolean);
  };

  const changeNucleotideColors = async () => {
    if (!plugin.current) {
      console.warn("Plugin not initialized.");
      return;
    }

    if (isStructureLoading.current) {
      return;
    }

    if (!Array.isArray(resultResidues) || resultResidues.length === 0) return;

    const runId = ++coloringRunId.current;
    const hierarchy = plugin.current.managers?.structure?.hierarchy?.current;
    const structure = hierarchy?.structures?.[0];
    const data = structure?.cell?.obj?.data;
    const components = structure?.components;

    if (!structure || !data || !components || components.length === 0) {
      return;
    }

    try {
      await clearStructureOverpaint(plugin.current, components);
    } catch (error) {
      console.warn("Failed to clear overpaint", error);
      return;
    }

    if (runId !== coloringRunId.current || !plugin.current) {
      return;
    }

    const residueColors = mapResiduesToColors();

    const groupedByColor = {};

    residueColors.forEach((entry) => {
      if (!groupedByColor[entry.color]) {
        groupedByColor[entry.color] = [];
      }
      groupedByColor[entry.color].push(entry);
    });

    for (const color in groupedByColor) {
      if (runId !== coloringRunId.current || !plugin.current) {
        return;
      }

      const entries = groupedByColor[color];

      const groups = [];
      for (const entry of entries) {
        const residueByAuth = MS.struct.generator.atomGroups({
          "chain-test": MS.core.rel.eq([
            MolScriptBuilder.struct.atomProperty.macromolecular.auth_asym_id(),
            entry.chainId,
          ]),
          "residue-test": MS.core.rel.eq([
            MolScriptBuilder.struct.atomProperty.macromolecular.auth_seq_id(),
            entry.authResidueNumber,
          ]),
        });

        groups.push(
          Number.isNaN(entry.labelResidueNumber)
            ? residueByAuth
            : MS.struct.combinator.merge([
                residueByAuth,
                MS.struct.generator.atomGroups({
                  "chain-test": MS.core.rel.eq([
                    MolScriptBuilder.struct.atomProperty.macromolecular.auth_asym_id(),
                    entry.chainId,
                  ]),
                  "residue-test": MS.core.rel.eq([
                    MolScriptBuilder.struct.atomProperty.macromolecular.label_seq_id(),
                    entry.labelResidueNumber,
                  ]),
                }),
              ])
        );
      }

      if (groups.length === 0) continue;

      const sel = Script.getStructureSelection(
        MS.struct.combinator.merge(groups),
        data
      );

      if (!sel) continue;

      const loci = StructureSelection.toLociWithSourceUnits(sel);

      if (!loci || !Array.isArray(loci.elements) || loci.elements.length === 0) {
        continue;
      }

      const getLoci = async () => loci;

      try {
        await setStructureOverpaint(
          plugin.current,
          components,
          Color(parseInt(color.replace("#", ""), 16)),
          getLoci
        );
      } catch (error) {
        console.warn("Failed to apply overpaint for color", color, error);
      }
      //   return;
    }
  };

  useEffect(() => {
    if (!initialized) {
      return;
    }

    void changeNucleotideColors();
  }, [resultResidues, selectedQualityScore]);

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const updateContainerReady = () => {
      const { width, height } = element.getBoundingClientRect();
      setIsContainerReady(width > 0 && height > 0);
    };

    updateContainerReady();

    if (typeof ResizeObserver === "undefined") {
      return () => {
        setIsContainerReady(false);
      };
    }

    const observer = new ResizeObserver(() => {
      updateContainerReady();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
      setIsContainerReady(false);
    };
  }, []);

  useEffect(() => {
    if (!isContainerReady) {
      return;
    }

    console.log("Initializing Molstar plugin...");

    if (plugin.current) {
      console.log("Plugin already initialized");
      return;
    }

    let cancelled = false;
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

        const createdPlugin = await createPluginUI({
          target: parentRef.current,
          spec: spec,
          render: renderReact18,
        });

        if (cancelled) {
          createdPlugin.dispose();
          return;
        }

        plugin.current = createdPlugin;
      } else {
        const createdPlugin = new PluginContext(DefaultPluginSpec());
        createdPlugin.initViewer(canvasRef.current, parentRef.current);
        await createdPlugin.init();

        if (cancelled) {
          createdPlugin.dispose();
          return;
        }

        plugin.current = createdPlugin;
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

      if (cancelled) {
        return;
      }

      await changeNucleotideColors();

      if (!cancelled) {
        setInitialized(true);
      }
    })();

    return () => {
      cancelled = true;

      plugin.current?.dispose();
      plugin.current = null;
      setInitialized(false);
    };
  }, [isContainerReady]);

  useEffect(() => {
    if (!initialized) return;
    let cancelled = false;

    (async () => {
      try {
        isStructureLoading.current = true;
        await loadStructure(pdbId, url, file, plugin.current);
      } finally {
        isStructureLoading.current = false;
      }

      if (cancelled) return;
      await changeNucleotideColors();
    })();

    return () => {
      cancelled = true;
      coloringRunId.current += 1;
    };
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
