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

const C1_PRIME_SPHERES_QUALITY_SCORES = new Set([
  QualityScore.BAD_ANGLES,
  QualityScore.BAD_BONDS,
  QualityScore.CLASH_SCORE,
  // QualityScore.SUGAR_PUCKER_OUT,
  // QualityScore.SUITENESS,
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
    radius,
    errorFocusedMode,
    comparisonFile,
    comparisonMode,
  } = props;
  const selectedOutlineComponentsRef = useRef([]);
  const parentRef = useRef(null);
  const canvasRef = useRef(null);
  const plugin = useRef(null);
  const coloringRunId = useRef(0);
  const isStructureLoading = useRef(false);
  const c1PrimeComponentsRef = useRef([]);
  const comparisonStructureCell = useRef(null);
  const comparisonComponent = useRef(null);
  const [canColor, setCanColor] = useState(false);
  const [isContainerReady, setIsContainerReady] = useState(false);
  const sphereRadiusAngstrom =
    typeof radius === "number" && Number.isFinite(radius) && radius > 0
      ? radius
      : 2.2;

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

  const applyComparisonColor = async (pluginInstance, comparisonColorHex) => {
    if (!pluginInstance || !comparisonColorHex) return;
    try {
      const hierarchy = pluginInstance.managers?.structure?.hierarchy?.current;
      const structures = hierarchy?.structures || [];
      if (structures.length < 2) return; // need a comparison structure

      const comparison = structures[structures.length - 1];
      const structureCell = comparison?.cell;
      const component = comparison?.components?.[0];

      if (!structureCell || !component) return;

      const structureData = structureCell?.obj?.data;
      if (!structureData) return;

      const allAtoms = MS.struct.generator.atomGroups({});

      // Build residue entries from resultResidues (chain + auth/label numbers + selected flag)
      const residueEntries = (Array.isArray(resultResidues) ? resultResidues : [])
        .map((residue) => {
          const metricsResidue = residue?.residueMetrics?.residue;
          const parsedChain = metricsResidue?.trim()?.split(/\s+/)?.[0];
          const chainId = residue?.chainID || parsedChain;
          const authResidueNumber = Number(residue?.original_index);
          const labelResidueNumber = Number(residue?.residue_number);

          if (!chainId || Number.isNaN(authResidueNumber)) return null;

          return {
            chainId,
            authResidueNumber,
            labelResidueNumber,
            selected: !!residue?.selected,
          };
        })
        .filter(Boolean);

      const makeGroups = (entries) => {
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

          const group = Number.isNaN(entry.labelResidueNumber)
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
              ]);

          groups.push(group);
        }
        return groups;
      };

      const selectedEntries = residueEntries.filter((e) => e.selected);
      const unselectedEntries = residueEntries.filter((e) => !e.selected);

      // Apply grey to unselected residues (or to whole structure if nothing selected)
      const greyHex = "#cccccc";

      if (selectedEntries.length === 0) {
        // no selected residues: make everything grey
        const selection = Script.getStructureSelection(allAtoms, structureData);
        if (selection) {
          const loci = StructureSelection.toLociWithSourceUnits(selection);
          if (loci?.elements?.length) {
            await setStructureOverpaint(
              pluginInstance,
              [component],
              Color(parseInt(greyHex.replace("#", ""), 16)),
              async () => loci
            );
          }
        }
        return;
      }

      if (unselectedEntries.length > 0) {
        const groupsUnselected = makeGroups(unselectedEntries);
        if (groupsUnselected.length > 0) {
          const selUn = Script.getStructureSelection(
            MS.struct.combinator.merge(groupsUnselected),
            structureData
          );
          if (selUn) {
            const lociUn = StructureSelection.toLociWithSourceUnits(selUn);
            if (lociUn?.elements?.length) {
              await setStructureOverpaint(
                pluginInstance,
                [component],
                Color(parseInt(greyHex.replace("#", ""), 16)),
                async () => lociUn
              );
            }
          }
        }
      }

      // Apply requested color to selected residues
      if (selectedEntries.length > 0) {
        const groupsSelected = makeGroups(selectedEntries);
        if (groupsSelected.length > 0) {
          const sel = Script.getStructureSelection(
            MS.struct.combinator.merge(groupsSelected),
            structureData
          );
          if (sel) {
            const loci = StructureSelection.toLociWithSourceUnits(sel);
            if (loci?.elements?.length) {
              await setStructureOverpaint(
                pluginInstance,
                [component],
                Color(parseInt(comparisonColorHex.replace("#", ""), 16)),
                async () => loci
              );
            }
          }
        }
      }
    } catch (error) {
      console.warn("applyComparisonColor failed", error);
    }
  };

  const applyUniformColorToStructure = async (pluginInstance, structureIndex, colorHex) => {
    if (!pluginInstance || !colorHex) return;
    try {
      const hierarchy = pluginInstance.managers?.structure?.hierarchy?.current;
      const structures = hierarchy?.structures || [];
      if (structureIndex < 0 || structureIndex >= structures.length) return;

      const targetStruct = structures[structureIndex];
      const structureCell = targetStruct?.cell;
      const component = targetStruct?.components?.[0];
      if (!structureCell || !component) return;

      const structureData = structureCell?.obj?.data;
      if (!structureData) return;

      const allAtoms = MS.struct.generator.atomGroups({});

      const residueEntries = (Array.isArray(resultResidues) ? resultResidues : [])
        .map((residue) => {
          const metricsResidue = residue?.residueMetrics?.residue;
          const parsedChain = metricsResidue?.trim()?.split(/\s+/)?.[0];
          const chainId = residue?.chainID || parsedChain;
          const authResidueNumber = Number(residue?.original_index);
          const labelResidueNumber = Number(residue?.residue_number);

          if (!chainId || Number.isNaN(authResidueNumber)) return null;

          return {
            chainId,
            authResidueNumber,
            labelResidueNumber,
            selected: !!residue?.selected,
          };
        })
        .filter(Boolean);

      const makeGroups = (entries) => {
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

          const group = Number.isNaN(entry.labelResidueNumber)
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
              ]);

          groups.push(group);
        }
        return groups;
      };

      const selectedEntries = residueEntries.filter((e) => e.selected);
      const unselectedEntries = residueEntries.filter((e) => !e.selected);

      const greyHex = "#cccccc";

      if (selectedEntries.length === 0) {
        // no selected residues: make everything grey
        const selection = Script.getStructureSelection(allAtoms, structureData);
        if (selection) {
          const loci = StructureSelection.toLociWithSourceUnits(selection);
          if (loci?.elements?.length) {
            await setStructureOverpaint(
              pluginInstance,
              [component],
              Color(parseInt(greyHex.replace("#", ""), 16)),
              async () => loci
            );
          }
        }
        return;
      }

      if (unselectedEntries.length > 0) {
        const groupsUnselected = makeGroups(unselectedEntries);
        if (groupsUnselected.length > 0) {
          const selUn = Script.getStructureSelection(
            MS.struct.combinator.merge(groupsUnselected),
            structureData
          );
          if (selUn) {
            const lociUn = StructureSelection.toLociWithSourceUnits(selUn);
            if (lociUn?.elements?.length) {
              await setStructureOverpaint(
                pluginInstance,
                [component],
                Color(parseInt(greyHex.replace("#", ""), 16)),
                async () => lociUn
              );
            }
          }
        }
      }

      if (selectedEntries.length > 0) {
        const groupsSelected = makeGroups(selectedEntries);
        if (groupsSelected.length > 0) {
          const sel = Script.getStructureSelection(
            MS.struct.combinator.merge(groupsSelected),
            structureData
          );
          if (sel) {
            const loci = StructureSelection.toLociWithSourceUnits(sel);
            if (loci?.elements?.length) {
              await setStructureOverpaint(
                pluginInstance,
                [component],
                Color(parseInt(colorHex.replace("#", ""), 16)),
                async () => loci
              );
            }
          }
        }
      }
    } catch (error) {
      console.warn("applyUniformColorToStructure failed", error);
    }
  };

  const setBallAndStickForAllStructures = async (pluginInstance) => {
    if (!pluginInstance) return;
    const hierarchy = pluginInstance.managers?.structure?.hierarchy?.current;
    const structures = hierarchy?.structures || [];

    for (const s of structures) {
      const components = s?.components || [];
      for (const comp of components) {
        try {

          // remove existing representations for this component
          const reps = comp?.representations || [];
          if (reps.length > 0) {
            const builder = pluginInstance.state.data.build();
            let hadDeletes = false;
            for (const r of reps) {
                let ref = undefined;
                try {
                  if (typeof r === "string") ref = r;
                  else if (r && r.cell && r.cell.transform && typeof r.cell.transform.ref !== "undefined") ref = r.cell.transform.ref;
                  else if (r && r.transform && typeof r.transform.ref !== "undefined") ref = r.transform.ref;
                } catch (refErr) {
                  console.warn("setBallAndStick: error reading rep ref", r, refErr);
                  ref = undefined;
                }
                if (ref) {
                  builder.delete(ref);
                  hadDeletes = true;
                }
            }
            if (hadDeletes) {
              try {
                await builder.commit();
              } catch (commitErr) {
                console.warn("setBallAndStick: commit failed", commitErr);
              }
            }
          }

          // add Ball & Stick representation
          const reprType = pluginInstance.representation.structure.registry.get(
            "ball-and-stick"
          );
          if (reprType) {
            try {
              const target = comp?.cell ? comp.cell : comp;
              if (!target) {
                console.warn("setBallAndStick: no valid target found for addRepresentation", { comp });
              } else {
                // Prefer manager API which handles representation creation for components
                const compManager = pluginInstance.managers?.structure?.component;
                if (compManager && typeof compManager.addRepresentation === "function") {
                  try {
                    await compManager.addRepresentation([comp], "ball-and-stick");
                  } catch (mgrErr) {
                    console.warn("setBallAndStick: component manager addRepresentation failed", mgrErr, { comp });
                    // fallback to builders API
                    await pluginInstance.builders.structure.representation.addRepresentation(
                      target,
                      {
                        type: reprType,
                        typeParams: {},
                      }
                    );
                  }
                } else {
                  // direct fallback
                  await pluginInstance.builders.structure.representation.addRepresentation(
                    target,
                    {
                      type: reprType,
                      typeParams: {},
                    }
                  );
                }
              }
            } catch (addErr) {
              console.warn("setBallAndStick: addRepresentation failed", addErr, { comp });
            }
          } else {
            console.warn("setBallAndStick: Ball-and-stick representation type not found in registry.");
          }
        } catch (err) {
          console.warn("Failed to set ball-and-stick for component", err, { comp });
        }
      }
    }
  };

  const changeNucleotideColors = async () => {
    if (!plugin.current) {
      console.warn("Plugin not initialized.");
      return;
    }

    // Skip coloring in comparison mode
    if (comparisonMode) {
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
    // Filter to components that have valid state transform refs required by Mol* helpers
    const targetComponents = (components || [])
      .filter((c) => !!c)
      .filter((c) => {
        // keep the original component object shape that Mol* helpers expect
        try {
          if (c && c.cell && c.cell.transform && typeof c.cell.transform.ref !== "undefined") return true;
          if (c && c.transform && typeof c.transform.ref !== "undefined") return true;
        } catch (e) {}
        return false;
      });

    const primaryComponent = targetComponents.find((c) => Array.isArray(c?.representations)) || targetComponents[0];

    if (!primaryComponent) {
      console.debug("changeNucleotideColors: no valid primary component available for overpaint");
      return;
    }

    if (!targetComponents || targetComponents.length === 0) {
      // nothing we can paint safely yet
      console.debug("changeNucleotideColors: no valid components available for overpaint");
      return;
    }

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

    // Build residue entries including the original residue for metric checks
    const residueEntries = (Array.isArray(resultResidues) ? resultResidues : [])
      .map((residue) => {
        const metricsResidue = residue?.residueMetrics?.residue;
        const parsedChain = metricsResidue?.trim()?.split(/\s+/)?.[0];
        const chainId = residue?.chainID || parsedChain;
        const authResidueNumber = Number(residue?.original_index);
        const labelResidueNumber = Number(residue?.residue_number);

        if (!chainId || Number.isNaN(authResidueNumber)) return null;

        return {
          chainId,
          authResidueNumber,
          labelResidueNumber,
          selected: !!residue?.selected,
          raw: residue,
        };
      })
      .filter(Boolean);

    const selectedEntries = residueEntries.filter((e) => e.selected);
    const unselectedEntries = residueEntries.filter((e) => !e.selected);

    const greyHex = "#7c7c7c";
    const safeSetStructureOverpaint = async (componentsToPaint, colorHex, lociGetter) => {
      try {
        await setStructureOverpaint(
          plugin.current,
          componentsToPaint,
          Color(parseInt(colorHex.replace("#", ""), 16)),
          lociGetter
        );
      } catch (error) {
        if (!String(error?.message || error).includes("reading 'ref'")) {
          console.warn("Failed to apply overpaint", error);
        }
      }
    };

    // If nothing is selected, paint everything grey
    if (selectedEntries.length === 0) {
      const allAtoms = MS.struct.generator.atomGroups({});
      const selection = Script.getStructureSelection(allAtoms, data);
      if (selection) {
        const loci = StructureSelection.toLociWithSourceUnits(selection);
        if (loci?.elements?.length) {
          await safeSetStructureOverpaint([primaryComponent], greyHex, async () => loci);
        }
      }
      return;
    }

    // Paint unselected residues grey
    if (unselectedEntries.length > 0) {
      const groupsUnselected = [];
      for (const entry of unselectedEntries) {
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

        groupsUnselected.push(
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

      if (groupsUnselected.length > 0) {
        const selUn = Script.getStructureSelection(MS.struct.combinator.merge(groupsUnselected), data);
        if (selUn) {
          const lociUn = StructureSelection.toLociWithSourceUnits(selUn);
          if (lociUn?.elements?.length) {
            await safeSetStructureOverpaint([primaryComponent], greyHex, async () => lociUn);
          }
        }
      }

    }

    // Helper to check metric == 0 for an entry
    const isMetricZero = (res) => {
      try {
        switch (selectedQualityScore) {
          case QualityScore.CLASH_SCORE:
            return Number(res?.metrics?.clashscore) === 0;
          case QualityScore.BAD_ANGLES:
            return Number(res?.metrics?.numbadangles) === 0;
          case QualityScore.BAD_BONDS:
            return Number(res?.metrics?.numbadbonds) === 0;
          case QualityScore.SUITENESS:
            return Number(res?.residueMetrics?.suiteness) === 0;
          case QualityScore.SUGAR_PUCKER_OUT:
            return !(res?.residueMetrics?.pucker_outlier_type || "").toString().trim();
          default:
            return false;
        }
      } catch (e) {
        return false;
      }
    };

    // Compute colors for selected entries and group by color
    const selectedGrouped = {};
    for (const entry of selectedEntries) {
      let colorHex = "#ffffff";
      if (errorFocusedMode) {
        const hasError = (() => {
          try {
            switch (selectedQualityScore) {
              case QualityScore.CLASH_SCORE:
                return Number(entry.raw?.metrics?.clashscore) > 0;
              case QualityScore.BAD_ANGLES:
                return Number(entry.raw?.metrics?.numbadangles) > 0;
              case QualityScore.BAD_BONDS:
                return Number(entry.raw?.metrics?.numbadbonds) > 0;
              case QualityScore.SUITENESS:
                return Number(entry.raw?.residueMetrics?.suiteness) < 0.01;
              case QualityScore.SUGAR_PUCKER_OUT:
                return (entry.raw?.residueMetrics?.pucker_outlier_type || "").toString().trim() !== "";
              default:
                return false;
            }
          } catch (e) {
            return false;
          }
        })();
        colorHex = hasError ? "#ff8c42" : "#ffffff";
      } else {
        // Non-error mode: use getColor but force white for metric==0
        if (isMetricZero(entry.raw)) {
          colorHex = "#ffffff";
        } else {
          colorHex = getColor(entry.raw, selectedQualityScore) || "#ffffff";
        }
      }

      if (!selectedGrouped[colorHex]) selectedGrouped[colorHex] = [];
      selectedGrouped[colorHex].push(entry);
    }

    for (const color in selectedGrouped) {
      if (runId !== coloringRunId.current || !plugin.current) return;
      const entries = selectedGrouped[color];
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
      const sel = Script.getStructureSelection(MS.struct.combinator.merge(groups), data);
      if (!sel) continue;
      const loci = StructureSelection.toLociWithSourceUnits(sel);
      if (!loci || !Array.isArray(loci.elements) || loci.elements.length === 0) continue;
      try {
        await safeSetStructureOverpaint([primaryComponent], color, async () => loci);
      } catch (error) {
        console.warn("Failed to apply overpaint for color", color, error);
      }
    }

    // Remove previous selected-outline components
    if (selectedOutlineComponentsRef.current && selectedOutlineComponentsRef.current.length > 0) {
      try {
        const builder = plugin.current.state.data.build();
        let hadDeletes = false;
        for (const item of selectedOutlineComponentsRef.current) {
          try {
            let reprRef = undefined;
            let compRef = undefined;
            try {
              const r = item && item.representation ? item.representation : item;
              if (typeof r === "string") reprRef = r;
              else if (r && r.cell && r.cell.transform && typeof r.cell.transform.ref !== "undefined") reprRef = r.cell.transform.ref;
              else if (r && r.transform && typeof r.transform.ref !== "undefined") reprRef = r.transform.ref;
            } catch (e) {}

            try {
              const c = item && item.component ? item.component : item;
              if (typeof c === "string") compRef = c;
              else if (c && c.cell && c.cell.transform && typeof c.cell.transform.ref !== "undefined") compRef = c.cell.transform.ref;
              else if (c && c.transform && typeof c.transform.ref !== "undefined") compRef = c.transform.ref;
            } catch (e) {}

            if (reprRef) {
              builder.delete(reprRef);
              hadDeletes = true;
            }
            if (compRef) {
              builder.delete(compRef);
              hadDeletes = true;
            }
          } catch (e) {
            // ignore per-item errors
          }
        }
        if (hadDeletes) {
          await builder.commit();
        }
      } catch (e) {
        console.warn("Failed to remove previous selected outline components", e);
      }
      selectedOutlineComponentsRef.current = [];
    }

    // No additional components tracked here; existing selectedOutlineComponentsRef is used for cleanup

    // In error-focused mode, create black outline representation for selected residues
    // if (errorFocusedMode) {
    //   const selectedEntries = residueColors.filter((r) => r.selected);
    //   if (selectedEntries.length > 0) {
    //     const groups = [];
    //     for (const entry of selectedEntries) {
    //       const residueByAuth = MS.struct.generator.atomGroups({
    //         "chain-test": MS.core.rel.eq([
    //           MolScriptBuilder.struct.atomProperty.macromolecular.auth_asym_id(),
    //           entry.chainId,
    //         ]),
    //         "residue-test": MS.core.rel.eq([
    //           MolScriptBuilder.struct.atomProperty.macromolecular.auth_seq_id(),
    //           entry.authResidueNumber,
    //         ]),
    //       });

    //       groups.push(
    //         Number.isNaN(entry.labelResidueNumber)
    //           ? residueByAuth
    //           : MS.struct.combinator.merge([
    //               residueByAuth,
    //               MS.struct.generator.atomGroups({
    //                 "chain-test": MS.core.rel.eq([
    //                   MolScriptBuilder.struct.atomProperty.macromolecular.auth_asym_id(),
    //                   entry.chainId,
    //                 ]),
    //                 "residue-test": MS.core.rel.eq([
    //                   MolScriptBuilder.struct.atomProperty.macromolecular.label_seq_id(),
    //                   entry.labelResidueNumber,
    //                 ]),
    //               }),
    //             ])
    //       );
    //     }

    //     try {
    //       const merged = MS.struct.combinator.merge(groups);
    //       const comp = await plugin.current.builders.structure.tryCreateComponentFromExpression(
    //         structure.cell,
    //         merged,
    //         `selected-outline`,
    //         { label: `Selected Outline` }
    //       );

    //       if (comp) {
    //         try {
    //           const repr = await plugin.current.builders.structure.representation.addRepresentation(
    //             comp,
    //             {
    //               type: "ball-and-stick",
    //               typeParams: {},
    //               color: "uniform",
    //               colorParams: { value: Color(parseInt("000000", 16)) },
    //             }
    //           );
    //           selectedOutlineComponentsRef.current = [{ component: comp, representation: repr }];
    //         } catch (e) {
    //           console.warn("Failed to add selected outline representation", e);
    //         }
    //       }
    //     } catch (e) {
    //       console.warn("Failed to create selected outline component", e);
    //     }
    //   }
    // }
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

      if (C1_PRIME_SPHERES_QUALITY_SCORES.has(selectedQualityScore)) {
        c1PrimeComponentsRef.current = [];
        const result = await addC1PrimeSpheres(plugin.current);
        if (!cancelled && result) {
          c1PrimeComponentsRef.current = result;
        }
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

  useEffect(() => {
    if (!initialized || !plugin.current) {
      return;
    }

    let cancelled = false;

    (async () => {
      if (!C1_PRIME_SPHERES_QUALITY_SCORES.has(selectedQualityScore)) {
        c1PrimeComponentsRef.current = [];
        try {
          isStructureLoading.current = true;
          await loadStructure(pdbId, url, file, plugin.current);
        } finally {
          isStructureLoading.current = false;
        }
        if (!cancelled) {
          if (C1_PRIME_SPHERES_QUALITY_SCORES.has(selectedQualityScore)) {
            const result = await addC1PrimeSpheres(plugin.current);
            if (!cancelled && result) {
              c1PrimeComponentsRef.current = result;
            }
          }
          await changeNucleotideColors();
        }
        return;
      }

      c1PrimeComponentsRef.current = [];
      try {
        isStructureLoading.current = true;
        await loadStructure(pdbId, url, file, plugin.current);
      } finally {
        isStructureLoading.current = false;
      }

      if (cancelled) {
        return;
      }

      const result = await addC1PrimeSpheres(plugin.current);
      if (!cancelled && result) {
        c1PrimeComponentsRef.current = result;
      }

      if (cancelled) {
        return;
      }

      await changeNucleotideColors();
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedQualityScore, resultResidues, initialized, radius]);

  // Handle comparison mode
  useEffect(() => {
    if (!initialized || !plugin.current) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        if (comparisonMode && comparisonFile) {
          isStructureLoading.current = true;
          // Load first structure in blue
          await loadStructure(pdbId, url, file, plugin.current, false, "#5073ff");
          if (cancelled) return;
          
          // Load second structure in orange
          await loadStructure(null, null, comparisonFile, plugin.current, true, "#ff8c42");
          isStructureLoading.current = false;
          if (!cancelled) {
            try {
              await setBallAndStickForAllStructures(plugin.current);
            } catch (err) {
              console.warn("setBallAndStickForAllStructures failed", err);
            }
            // Apply comparison uniform color after representations changed
            try {
              await applyComparisonColor(plugin.current, "#60a5fa");
            } catch (err) {
              console.warn("applyComparisonColor failed", err);
            }
            // Apply uniform green to primary (index 0)
            try {
              await applyUniformColorToStructure(plugin.current, 0, "#fb923c");
            } catch (err) {
              console.warn("applyUniformColorToStructure failed", err);
            }
          }
        } else {
          isStructureLoading.current = true;
          // Return to normal mode - reload primary structure
          await loadStructure(pdbId, url, file, plugin.current);
          isStructureLoading.current = false;
          
          if (cancelled) return;
          
          // Restore nucleotide coloring after structure is fully loaded
          await new Promise(resolve => setTimeout(resolve, 100));
          if (!cancelled) {
            await changeNucleotideColors();
            
            // Restore C1' spheres if needed
            if (C1_PRIME_SPHERES_QUALITY_SCORES.has(selectedQualityScore)) {
              c1PrimeComponentsRef.current = [];
              const result = await addC1PrimeSpheres(plugin.current);
              if (!cancelled && result) {
                c1PrimeComponentsRef.current = result;
              }
            }
          }
        }
      } finally {
        isStructureLoading.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [errorFocusedMode,comparisonMode, comparisonFile, initialized, pdbId, url, file, selectedQualityScore]);

  const addC1PrimeSpheres = async (pluginInstance) => {
    const structureCell =
      pluginInstance?.managers?.structure?.hierarchy?.current?.structures?.[0]
        ?.cell;
    const structureData = structureCell?.obj?.data;

    if (!structureCell || !structureData) {
      return null;
    }

    let coloredResidues = mapResiduesToColors();
    if (errorFocusedMode) {
      // In error-focused mode produce white or orange for each residue (no scaling)
      coloredResidues = (Array.isArray(resultResidues) ? resultResidues : []).map((residue) => {
        const metricsResidue = residue?.residueMetrics?.residue;
        const parsedChain = metricsResidue?.trim()?.split(/\s+/)?.[0];
        const chainId = residue?.chainID || parsedChain;
        const authResidueNumber = Number(residue?.original_index);
        const labelResidueNumber = Number(residue?.residue_number);

        if (!chainId || Number.isNaN(authResidueNumber)) return null;

        const hasError = (() => {
          try {
            switch (selectedQualityScore) {
              case QualityScore.CLASH_SCORE:
                return Number(residue?.metrics?.clashscore) > 0;
              case QualityScore.BAD_ANGLES:
                return Number(residue?.metrics?.numbadangles) > 0;
              case QualityScore.BAD_BONDS:
                return Number(residue?.metrics?.numbadbonds) > 0;
              case QualityScore.SUITENESS:
                return Number(residue?.residueMetrics?.suiteness) > 0;
              case QualityScore.SUGAR_PUCKER_OUT:
                return (residue?.residueMetrics?.pucker_outlier_type || "").toString().trim() !== "";
              default:
                return false;
            }
          } catch (e) {
            return false;
          }
        })();

        return {
          chainId,
          authResidueNumber,
          labelResidueNumber,
          color: hasError ? "#ff8c42" : "#ffffff",
        };
      }).filter(Boolean);
    } else {
      coloredResidues = coloredResidues.filter((entry) => {
        const normalizedColor = String(entry?.color || "").trim().toLowerCase();
        return normalizedColor !== "#ffffff" && normalizedColor !== "ffffff";
      });
    }

    // Only keep residues that are selected in the provided resultResidues
    const isEntrySelected = (entry) => {
      if (!Array.isArray(resultResidues)) return false;
      if (entry.color === "#ffffff" || entry.color === "white") return false;
      for (const r of resultResidues) {
        const metricsResidue = r?.residueMetrics?.residue;
        const parsedChain = metricsResidue?.trim()?.split(/\s+/)?.[0];
        const chainId = r?.chainID || parsedChain;
        const authResidueNumber = Number(r?.original_index);
        const labelResidueNumber = Number(r?.residue_number);

        if (!chainId || Number.isNaN(authResidueNumber)) continue;

        const authMatch = chainId === entry.chainId && authResidueNumber === entry.authResidueNumber;
        const labelMatch = Number.isNaN(entry.labelResidueNumber) || labelResidueNumber === entry.labelResidueNumber;

        if (authMatch && labelMatch) {
          return !!r?.selected;
        }
      }
      return false;
    };

    coloredResidues = coloredResidues.filter(isEntrySelected);

    if (coloredResidues.length === 0) {
      return null;
    }

    const isC1PrimeAtom = MS.core.logic.or([
      MS.core.rel.eq([
        MolScriptBuilder.struct.atomProperty.macromolecular.label_atom_id(),
        "C1'",
      ]),
      MS.core.rel.eq([
        MolScriptBuilder.struct.atomProperty.macromolecular.auth_atom_id(),
        "C1'",
      ]),
      MS.core.rel.eq([
        MolScriptBuilder.struct.atomProperty.macromolecular.label_atom_id(),
        "C1*",
      ]),
      MS.core.rel.eq([
        MolScriptBuilder.struct.atomProperty.macromolecular.auth_atom_id(),
        "C1*",
      ]),
    ]);

    const groupedByColor = {};

    coloredResidues.forEach((entry) => {
      if (!groupedByColor[entry.color]) {
        groupedByColor[entry.color] = [];
      }
      groupedByColor[entry.color].push(entry);
    });

    const components = [];

    for (const color in groupedByColor) {
      const entries = groupedByColor[color];
      const residueGroups = [];

      for (const residue of entries) {
        const residueByAuth = MS.struct.generator.atomGroups({
          "chain-test": MS.core.rel.eq([
            MolScriptBuilder.struct.atomProperty.macromolecular.auth_asym_id(),
            residue.chainId,
          ]),
          "residue-test": MS.core.rel.eq([
            MolScriptBuilder.struct.atomProperty.macromolecular.auth_seq_id(),
            residue.authResidueNumber,
          ]),
          "atom-test": isC1PrimeAtom,
        });

        residueGroups.push(
          Number.isNaN(residue.labelResidueNumber)
            ? residueByAuth
            : MS.struct.combinator.merge([
                residueByAuth,
                MS.struct.generator.atomGroups({
                  "chain-test": MS.core.rel.eq([
                    MolScriptBuilder.struct.atomProperty.macromolecular.auth_asym_id(),
                    residue.chainId,
                  ]),
                  "residue-test": MS.core.rel.eq([
                    MolScriptBuilder.struct.atomProperty.macromolecular.label_seq_id(),
                    residue.labelResidueNumber,
                  ]),
                  "atom-test": isC1PrimeAtom,
                }),
              ])
        );
      }

      if (residueGroups.length === 0) continue;

      const c1PrimeAtoms = MS.struct.combinator.merge(residueGroups);

      const c1PrimeSelection = Script.getStructureSelection(
        c1PrimeAtoms,
        structureData
      );

      if (!c1PrimeSelection) continue;

      const c1PrimeLoci = StructureSelection.toLociWithSourceUnits(c1PrimeSelection);

      if (!c1PrimeLoci?.elements?.length) {
        continue;
      }

      try {
        const c1PrimeComponent =
          await pluginInstance.builders.structure.tryCreateComponentFromExpression(
            structureCell,
            c1PrimeAtoms,
            `c1-prime-atoms-${color}`,
            { label: `C1' atoms (${color})` }
          );

        if (!c1PrimeComponent) {
          continue;
        }

        const c1PrimeRepr =
          await pluginInstance.builders.structure.representation.addRepresentation(
            c1PrimeComponent,
            {
              type: "spacefill",
              typeParams: {
                sizeFactor: (sphereRadiusAngstrom / 1.7),
                alpha: 0.35,
              },
              color: "uniform",
              colorParams: { value: Color(parseInt(color.replace("#", ""), 16)) },
            }
          );

        components.push({ component: c1PrimeComponent, representation: c1PrimeRepr });
      } catch (error) {
        console.warn(`Failed to create C1' spheres for color ${color}`, error);
      }
    }

    return components.length > 0 ? components : null;
  };

  const detectTrajectoryFormat = (fileContent) => {
    if (typeof fileContent !== "string") {
      return null;
    }

    const trimmed = fileContent.trimStart();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith("data_")) {
      return "mmcif";
    }

    return "pdb";
  };

  const loadTrajectory = async (pluginInstance, data, format) => {
    const traj = await pluginInstance.builders.structure.parseTrajectory(
      data,
      format
    );
    await pluginInstance.builders.structure.hierarchy.applyPreset(traj, "default");
  };

  const loadStructure = async (pdbId, url, file = null, plugin, isComparison = false, comparisonColorHex = null) => {
    //console.log("Fetching:", pdbId);
    if (plugin) {
      if (!isComparison) {
        plugin.clear();
      }
      if (file) {
        const format = detectTrajectoryFormat(file);

        if (!format) {
          console.warn("Skipping structure load because the file payload is empty.");
          return;
        }

        try {
          const data = await plugin.builders.data.rawData({
            data: file,
          });

          const traj = await plugin.builders.structure.parseTrajectory(
            data,
            format
          );
          await plugin.builders.structure.hierarchy.applyPreset(traj, "default");

          // Comparison coloring moved to after representations are set
        } catch (error) {
          console.warn("Failed to load structure with detected format", format, error);

          if (format === "pdb") {
            try {
              const data = await plugin.builders.data.rawData({
                data: file,
              });

              await plugin.builders.structure.parseTrajectory(plugin, data, "mmcif");
              return;
            } catch (fallbackError) {
              console.warn("MMcIF fallback also failed", fallbackError);
            }
          }

          return;
        }
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
  radius: PropTypes.number,
  comparisonFile: PropTypes.string,
  comparisonMode: PropTypes.bool,
  errorFocusedMode: PropTypes.bool,
};

export default Molstar;
