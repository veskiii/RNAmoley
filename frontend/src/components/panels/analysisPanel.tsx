import React, { useEffect, useMemo, useState } from "react";
import Loading from "../common/loading";
import "../../App.css";
import Molstar from "../visualizations/molStarComponent";
import FornaComponent from "../visualizations/fornacWrapper";
import { useNavigate, useParams } from "react-router-dom";
import { SelectChangeEvent } from "@mui/material/Select";
import { Job, Chain, Nucleotide, SelectedFragment, ChainElement } from "../utils/types";
import { fetchJobData, sendDataToAnalyze } from "../utils/api";
import { transformJobToChains } from "../utils/transformJobToChains";
import ErrorPage from "../common/ErrorPage";
import SmallScreenPage from "../common/smallScreenPage";
import TopPanel from "../common/topPanel";
import Footer from "../common/footerComponent";
import ResidueTable from "../visualizations/ResidueTable";

type AutoSelectFragmentSpec = {
  model: number;
  chainName: string;
  start: number;
  end: number;
  label: string;
};

type AutoSelectFragmentConfig = {
  fragment: string;
  label: string;
};

const AUTO_SELECT_FRAGMENT_REGEX =
  /^\(\s*(\d+)\s*:\s*([^:()]+)\s*:\s*(\d+)(?:-(\d+))?\s*\)$/;

function extractAutoSelectFragments(fragment: string): string[] {
  const trimmed = fragment.trim();
  if (AUTO_SELECT_FRAGMENT_REGEX.test(trimmed)) {
    return [trimmed];
  }

  const matches = trimmed.match(/\(\s*\d+\s*:\s*[^:()]+\s*:\s*\d+(?:-\d+)?\s*\)/g);
  return matches ?? [];
}

const AUTO_SELECT_FRAGMENTS_BY_JOB: Record<string, AutoSelectFragmentConfig[]> = {
  "Example 1": [{ fragment: "(1:A:1-90)", label: "Range 1-90" }],
  "Example 2": [{ fragment: "(1:A:11-36)", label: "Range 11-36" }],
  "Example 3": [{ fragment: "(1:A:8-12),(1:A:44-49)", label: "Range" }],
  "Example 4": [{ fragment: "(1:A:42-83)", label: "Range 42-83" }],
  "Example 5": [{ fragment: "(1:A:1-39),(1:A:83-90)", label: "Range" }],
  "Example 6": [{ fragment: "(1:0:1-30),(3:0:1-30),(5:0:1-30)", label: "Range" }]
};

function parseAutoSelectFragmentSpec(
  entry: AutoSelectFragmentConfig
): AutoSelectFragmentSpec[] {
  const { fragment, label } = entry;
  const fragments = extractAutoSelectFragments(fragment);

  return fragments
    .map((fragmentSpec, index) => {
      const match = fragmentSpec.match(AUTO_SELECT_FRAGMENT_REGEX);
      if (!match) {
        return null;
      }

      const model = Number(match[1]);
      const chainName = match[2].trim();
      const start = Number(match[3]);
      const end = Number(match[4] ?? match[3]);

      if (
        !Number.isFinite(model) ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start <= 0 ||
        end <= 0 ||
        start > end
      ) {
        return null;
      }

      return {
        model,
        chainName,
        start,
        end,
        label: fragments.length === 1 ? label : `${label} ${index + 1}`,
      };
    })
    .filter((spec): spec is AutoSelectFragmentSpec => spec !== null);
}

function applyConfiguredSelections(
  jobName: string | undefined,
  model: number,
  chains: Chain[]
): {
  chains: Chain[];
  selectedFragments: SelectedFragment[];
  selectedChain: string;
} {
  const configuredSpecs = jobName ? AUTO_SELECT_FRAGMENTS_BY_JOB[jobName] ?? [] : [];
  if (configuredSpecs.length === 0) {
    return {
      chains,
      selectedFragments: [],
      selectedChain: "",
    };
  }

  const parsedSpecs = configuredSpecs
    .flatMap(parseAutoSelectFragmentSpec)
    .filter((spec) => spec.model === model);

  if (parsedSpecs.length === 0) {
    return {
      chains,
      selectedFragments: [],
      selectedChain: "",
    };
  }

  const selectedFragments: SelectedFragment[] = [];
  const selectedResiduesByChain = new Map<string, Set<number>>();
  const usedFragmentNames = new Map<string, number>();
  let selectedChain = chains[0]?.name || "";

  parsedSpecs.forEach((spec) => {
    const chain = chains.find((candidate) => candidate.name === spec.chainName);
    if (!chain) {
      return;
    }

    const residueIds = chain.nucleotides
      .filter(
        (nucleotide) =>
          nucleotide.original_index >= spec.start && nucleotide.original_index <= spec.end
      )
      .map((nucleotide) => nucleotide.index);

    if (residueIds.length === 0) {
      return;
    }

    if (!selectedResiduesByChain.has(spec.chainName)) {
      selectedResiduesByChain.set(spec.chainName, new Set<number>());
    }

    const selectedResidues = selectedResiduesByChain.get(spec.chainName);
    residueIds.forEach((residueId) => selectedResidues?.add(residueId));

    const occurrence = (usedFragmentNames.get(spec.label) ?? 0) + 1;
    usedFragmentNames.set(spec.label, occurrence);
    const uniqueFragmentName = occurrence === 1 ? spec.label : `${spec.label} (${occurrence})`;

    selectedFragments.push({
      name: uniqueFragmentName,
      chainName: spec.chainName,
      residues: residueIds,
      deselectedResidues: [],
    });

    if (!selectedChain) {
      selectedChain = spec.chainName;
    }
  });

  const selectedChains = chains.map((chain) => {
    const selectedResidues = selectedResiduesByChain.get(chain.name);
    if (!selectedResidues || selectedResidues.size === 0) {
      return chain;
    }

    return {
      ...chain,
      nucleotides: chain.nucleotides.map((nucleotide) =>
        selectedResidues.has(nucleotide.index)
          ? { ...nucleotide, selected: true }
          : nucleotide
      ),
    };
  });

  return {
    chains: selectedChains,
    selectedFragments,
    selectedChain,
  };
}

function clearChainSelections(chains: Chain[]): Chain[] {
  return chains.map((chain) => ({
    ...chain,
    nucleotides: chain.nucleotides.map((nucleotide) => ({
      ...nucleotide,
      selected: false,
    })),
  }));
}

async function preloadConfiguredModelSelections(
  jobID: string | undefined,
  jobName: string | undefined,
  availableModels: number[],
  excludedModel: number
): Promise<Record<number, { chainsState: Chain[]; selectedFragments: SelectedFragment[] }>> {
  const configuredSpecs = jobName ? AUTO_SELECT_FRAGMENTS_BY_JOB[jobName] ?? [] : [];
  if (!jobID || configuredSpecs.length === 0) {
    return {};
  }

  const configuredModels = Array.from(
    new Set(
      configuredSpecs
        .flatMap(parseAutoSelectFragmentSpec)
        .map((spec) => spec.model)
    )
  ).filter((model) => model !== excludedModel && availableModels.includes(model));

  if (configuredModels.length === 0) {
    return {};
  }

  const loadedSelections = await Promise.allSettled(
    configuredModels.map(async (model) => {
      const modelData = await fetchJobData(jobID, model);
      const chains = transformJobToChains(modelData);
      const configuredSelection = applyConfiguredSelections(jobName, model, chains);

      return [
        model,
        {
          chainsState: configuredSelection.chains,
          selectedFragments: configuredSelection.selectedFragments,
        },
      ] as const;
    })
  );

  return loadedSelections.reduce<Record<number, { chainsState: Chain[]; selectedFragments: SelectedFragment[] }>>(
    (accumulator, result) => {
      if (result.status === "fulfilled") {
        const [model, selection] = result.value;
        accumulator[model] = selection;
      }

      return accumulator;
    },
    {}
  );
}

const Panel: React.FC = () => {
  const [myData, setMyData] = useState<Job>();
  const [error, setError] = useState<string | null>(null);
  const [labelInterval, setLabelInterval] = useState(10);
  const [numbering, setNumbering] = useState(false);
  const [nodeOutline, setNodeOutline] = useState(true);
  const [nodeLabel, setNodeLabel] = useState(true);
  const [links, setLinks] = useState(true);
  const [animation, setAnimation] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [chainsState, setChainsState] = useState<Chain[]>([]);
  const [selectedModel, setSelectedModel] = useState<number>(0);
  const [selectedChain, setSelectedChain] = useState<string>(
    chainsState[0]?.name|| ""
  );
  const [inputValueStart, setInputValueStart] = useState<string>("");
  const [inputValueEnd, setInputValueEnd] = useState<string>("");
  const [minId, setMinId] = useState<string>("");
  const [maxId, setMaxId] = useState<string>("");
  const [selectedFragments, setSelectedFragments] = useState<SelectedFragment[]>([]);
  const [isViewInitialized, setIsViewInitialized] = useState<boolean>(true);
  const { jobId } = useParams();
  const jobID = jobId;
  const navigate = useNavigate();
  const [showVisualization, setShowVisualization] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [sidebarTab, setSidebarTab] = useState(0);
  const [showFornaSettings, setShowFornaSettings] = useState(false);
  const [modelSelections, setModelSelections] = useState<Record<number, {chainsState: Chain[], selectedFragments: SelectedFragment[]}>>({});

  const selectedList = useMemo<ChainElement[]>(() => {
    return chainsState.flatMap((chain) =>
      chain.nucleotides
        .filter((nucleotide) => nucleotide.selected)
        .map((nucleotide) => ({
          chainID: chain.name,
          residueID: nucleotide.index,
        }))
    );
  }, [chainsState]);

  const selectedResidueIdsForChain = useMemo(() => {
    const selectedChainData = chainsState.find((chain) => chain.name === selectedChain);
    if (!selectedChainData) return [];
    return selectedChainData.nucleotides
      .filter((nucleotide) => nucleotide.selected)
      .map((nucleotide) => nucleotide.index);
  }, [chainsState, selectedChain]);

  const isDisabled = selectedList.length === 0;

  useEffect(() => {
    if (chainsState.length === 0) {
      setSelectedChain("");
      return;
    }

    // if (!selectedChain || !chainsState.some((chain) => chain.name === selectedChain)) {
    //   setSelectedChain(chainsState[0]?.name || "");
    // }
  }, [chainsState, selectedChain]);

  const handleInputChangeStart = (event: SelectChangeEvent) => {
    setInputValueStart(event.target.value);
  };

  const handleInputChangeEnd = (event: SelectChangeEvent) => {
    setInputValueEnd(event.target.value);
  };

  const handleChange = (event: SelectChangeEvent) => {
    setSelectedChain(event.target.value);
  };

  //do placeholder z max i min original_id nukleotydów podanego chain
  useEffect(() => {
    if (!selectedChain) {
      return;
    }

    chainsState.forEach((chain) => {
      if (chain.name === selectedChain) {
        const indices = chain.nucleotides.map((nucleotide) => nucleotide.index);
        const min = Math.min(...indices);
        const max = Math.max(...indices);

        setMinId(min.toString());
        setMaxId(max.toString());
        setInputValueStart(min.toString());
        setInputValueEnd(max.toString());
      }
    });
  }, [chainsState, selectedChain]);

  async function loadData(jobID: string | undefined, model: number = 1) {
    try {
      const data = await fetchJobData(jobID, model);
      setMyData(data);
      console.log(data);
      const chains = transformJobToChains(data);
      const configuredSelection = applyConfiguredSelections(data.name, model, chains);
      setChainsState(configuredSelection.chains);
      setSelectedFragments(configuredSelection.selectedFragments);
      void preloadConfiguredModelSelections(jobID, data.name, data.metadata.models, model).then(
        (preloadedSelections) => {
          if (Object.keys(preloadedSelections).length === 0) {
            return;
          }

          setModelSelections((prev) => ({
            ...prev,
            ...preloadedSelections,
          }));
        }
      );
      /* If user selected model or there is only one model, select this model */
      // if ( selectedModel !== 0 || data.metadata.model_count === 1 ) {
        setSelectedModel(model);
        /* If there is only one chain, select it. Otherwise, select preselected or none */
        // if (configuredSelection.chains.length < 2) {
          setSelectedChain(configuredSelection.chains[0]?.name || "");
        // } else {
          // setSelectedChain(configuredSelection.selectedChain);
        // }
      // }
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    }
  }

  async function handleNavigate() {
    const selectedModelsMap: Record<number, ChainElement[]> = {};
    Object.entries(modelSelections).forEach(([modelNum, selection]) => {
      const selected = selection.chainsState.flatMap(chain =>
        chain.nucleotides
          .filter(n => n.selected)
          .map(n => ({
            chainID: chain.name,
            residueID: n.original_index,
          }))
      );
      if (selected.length > 0) {
        selectedModelsMap[Number(modelNum)] = selected;
      }
    });
    console.log("Selected models map:", selectedModelsMap);

    if (myData?.metadata.analyzeNeighborhoods) {
      await sendDataToAnalyze(
        myData.metadata.analyzeNeighborhoods,
        jobID,
        selectedModelsMap,
        myData.metadata.radius,
        myData.metadata.interval
      );
    }
    else {
      await sendDataToAnalyze(
        myData?.metadata.analyzeNeighborhoods || false,
        jobID,
        selectedModelsMap
      );
    }
    const firstModel = Object.keys(selectedModelsMap)[0];
    navigate(`/summary/${jobID}/${firstModel}`);
    
  }

  useEffect(() => {
    if (!selectedModel) return;
    setModelSelections(prev => ({
      ...prev,
      [selectedModel]: {
        chainsState,
        selectedFragments,
      }
    }));
  }, [chainsState, selectedFragments, selectedModel]);

  const changeModel = (model: number) => {
    if (!jobID || model === selectedModel) return;
    setModelSelections(prev => ({
      ...prev,
      [selectedModel]: {
        chainsState,
        selectedFragments,
      }
    }));
    loadData(jobID, model).then(() => {
      const saved = modelSelections[model];
      if (saved) {
        setChainsState(saved.chainsState);
        setSelectedFragments(saved.selectedFragments);
      }
      setSelectedModel(model);
      if (chainsState.length === 1) {
        setSelectedChain(chainsState[0]?.name || "");
      }
    });
  };

  const selectFragment = (name: string, chainName: string, residueIds: number[]) => {
    // check if all residues are already selected
    const allSelected = residueIds.every((id) =>
      chainsState.some(
        (chain) =>
          chain.name === chainName &&
          chain.nucleotides.some((nucleotide) => nucleotide.index === id && nucleotide.selected)
      )
    );
    if (allSelected) {
      // If all residues are selected, dont do anything
      return;
    } else if (selectedFragments.some(f => f.name === name && f.chainName === chainName)) {
      // If fragment with the same name and chain already exists, update it
      setSelectedFragments((prev) =>
        prev.map((f) =>
          f.name === name && f.chainName === chainName
            ? {
                ...f,
                deselectedResidues: [],
              }
            : f
        )
      );
    } else {
      // Otherwise, set selected fragment
      setSelectedFragments((prev) => [
        ...prev,
        { name, chainName, residues: residueIds, deselectedResidues: [] },
      ]);
    }

    // Zaznacz odpowiednie nukleotydy w chainsState
    setChainsState((prevChains) =>
      prevChains.map((chain) => {
        if (chain.name === chainName) {
          return {
            ...chain,
            nucleotides: chain.nucleotides.map((nucleotide) =>
              residueIds.includes(nucleotide.index)
                ? { ...nucleotide, selected: true }
                : nucleotide
            ),
          };
        }
        return chain;
      })
    );
  };

  const selectResidue = (chainName: string, residueId: number) => {
    // check if residue is already selected
    const isSelected = chainsState.some(
      (chain) =>
        chain.name === chainName &&
        chain.nucleotides.some((nucleotide) => nucleotide.index === residueId && nucleotide.selected)
    );
    if (isSelected) {
      // If residue is already selected, deselect it
      deselectResidue(chainName, residueId);
      return;
    }
    // Otherwise, select the residue
    setChainsState((prevChains) =>
      prevChains.map((chain) => {   
        if (chain.name === chainName) {
          return {
            ...chain,
            nucleotides: chain.nucleotides.map((nucleotide) => {
              if (nucleotide.index === residueId) {
                return { ...nucleotide, selected: true };
              }
              return nucleotide;
            }),
          };
        }
        return chain;
      }
    )
    );
    // check if residue is part of any selected fragment
    const fragment = selectedFragments.find(
      (f) =>
        f.chainName === chainName && f.residues.includes(residueId)
    );
    if (fragment) {
      // If residue is part of a fragment, remove it from deselected residues
      setSelectedFragments((prev) =>
        prev.map((f) =>
          f.name === fragment.name
            ? {
                ...f,
                deselectedResidues: f.deselectedResidues.filter(
                  (id) => id !== residueId
                ),
              }
            : f
        )
      );
    } else {
      const selectionFragments = selectedFragments
        .filter(f => f.chainName === chainName && f.name.startsWith("Selection"));

      let allResidues = [
        ...selectionFragments.flatMap(f => f.residues.filter(id => !f.deselectedResidues?.includes(id))),
        residueId,
      ];

      allResidues = Array.from(new Set(allResidues)).sort((a, b) => a - b);

      const ranges: number[][] = [];
      let rangeStart = allResidues[0];
      let prev = allResidues[0];
      for (let i = 1; i < allResidues.length; i++) {
        if (allResidues[i] === prev + 1) {
          prev = allResidues[i];
        } else {
          ranges.push([rangeStart, prev]);
          rangeStart = prev = allResidues[i];
        }
      }
      ranges.push([rangeStart, prev]);

      setSelectedFragments(prev =>
        [
          ...prev.filter(f => !(f.chainName === chainName && f.name.startsWith("Selection"))),
          ...ranges.map(([start, end]) => ({
        name: start === end ? `Selection ${start}` : `Selection ${start}-${end}`,
        chainName,
        residues: Array.from({ length: end - start + 1 }, (_, i) => start + i),
        deselectedResidues: [],
          })),
        ]
      );
    }
  }

  const deselectResidue = (chainName: string, residueId: number) => {
    // check selected fragments if residue is part of any
    setChainsState((prevChains) =>
      prevChains.map((chain) => {
        if (chain.name === chainName) {
          return {
            ...chain,
            nucleotides: chain.nucleotides.map((nucleotide) => {
              if (nucleotide.index === residueId) {
                return { ...nucleotide, selected: false };
              }
              return nucleotide;
            }),
          };
        }
        return chain;
      })
    );
    const fragment = selectedFragments.find(
      (f) =>
        f.chainName === chainName && f.residues.includes(residueId)
    );
    if (fragment) {
      // Sprawdź, czy po dodaniu residueId do deselectedResidues będą identyczne z residues
      const newDeselected = [...fragment.deselectedResidues, residueId];
      const residuesSorted = [...fragment.residues].sort((a, b) => a - b);
      const deselectedSorted = [...newDeselected].sort((a, b) => a - b);
      const allDeselected =
        residuesSorted.length === deselectedSorted.length &&
        residuesSorted.every((val, idx) => val === deselectedSorted[idx]);

      if (allDeselected) {
        removeSelectedFragment(fragment.name);
      } else {
        // If residue is part of a fragment, add it to deselected residues
        setSelectedFragments((prev) =>
          prev.map((f) =>
            f.name === fragment.name
              ? {
                  ...f,
                  deselectedResidues: newDeselected,
                }
              : f
          )
        );
      }
    }
  }

  const removeSelectedFragment = ( selectedFragmentName: string, otherFragmentsToRemove?: string[] ) => {
    console.log("Removing fragment:", selectedFragmentName);
    // Get the fragment to remove
    const fragmentToRemove = selectedFragments.find(
      (f) => f.name === selectedFragmentName
    );
    console.log("Fragment to remove:", fragmentToRemove);
    if (!fragmentToRemove) return;
    // Remove the fragment from selected fragments
    setSelectedFragments((prev) =>
      prev.filter((f) => f.name !== selectedFragmentName)
    );
    // Deselect all residues in the removed fragment, excluding those that are part of other fragments
    setChainsState((prevChains) =>
      prevChains.map((chain) => {
        if (chain.name === fragmentToRemove.chainName) {
          return {
            ...chain,
            nucleotides: chain.nucleotides.map((nucleotide) => {
              if ( fragmentToRemove.residues.includes(nucleotide.index) &&
                selectedFragments.some(
                  (f) =>
                    f.name !== selectedFragmentName &&
                    (otherFragmentsToRemove == null || !otherFragmentsToRemove?.includes(f.name)) &&
                    f.chainName === fragmentToRemove.chainName &&
                    f.residues.includes(nucleotide.index)
                ) === false
              ) {
                return { ...nucleotide, selected: false };
              }
              return nucleotide;
            }),
          };
        }
        return chain;
      }));
  }

  const formatResidueRanges = (residues: number[]): string => {
    if (!residues || residues.length === 0) return "";
    const sorted = [...residues].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${getResidueByIndex(start).original_index}` : `${getResidueByIndex(start).original_index}-${getResidueByIndex(end).original_index}`);
        start = end = sorted[i];
      }
    }
    ranges.push(start === end ? `${getResidueByIndex(start).original_index}` : `${getResidueByIndex(start).original_index}-${getResidueByIndex(end).original_index}`);
    return ranges.join(",");
  }

  const getResidueByIndex = (index: number): Nucleotide => {
    for (const chain of chainsState) {
      const nucleotide = chain.nucleotides.find(n => n.index === index);
      if (nucleotide) {
        return nucleotide;
      }
    }
    throw new Error(`Residue with index ${index} not found`);
  }

  // Helpers for formatting residues for arbitrary model chains (used when showing selections from other models)
  const getResidueByIndexForChains = (index: number, chains: Chain[]): Nucleotide => {
    for (const chain of chains) {
      const nucleotide = chain.nucleotides.find(n => n.index === index);
      if (nucleotide) return nucleotide;
    }
    throw new Error(`Residue with index ${index} not found in provided chains`);
  }

  const formatResidueRangesForChains = (residues: number[], chains: Chain[]): string => {
    if (!residues || residues.length === 0) return "";
    const sorted = [...residues].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(
          start === end
            ? `${getResidueByIndexForChains(start, chains).original_index}`
            : `${getResidueByIndexForChains(start, chains).original_index}-${getResidueByIndexForChains(end, chains).original_index}`
        );
        start = end = sorted[i];
      }
    }
    ranges.push(
      start === end
        ? `${getResidueByIndexForChains(start, chains).original_index}`
        : `${getResidueByIndexForChains(start, chains).original_index}-${getResidueByIndexForChains(end, chains).original_index}`
    );
    return ranges.join(",");
  }

  const getAllSelectedFragmentsGrouped = () => {
    const groups = new Map<number, SelectedFragment[]>();

    // from saved modelSelections
    Object.entries(modelSelections).forEach(([modelKey, sel]) => {
      const modelNum = Number(modelKey);
      if (sel?.selectedFragments && sel.selectedFragments.length > 0) {
        groups.set(modelNum, sel.selectedFragments);
      }
    });

    // include current model's selections
    if (selectedFragments && selectedFragments.length > 0) {
      groups.set(selectedModel, selectedFragments);
    }

    // convert to sorted array
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([model, fragments]) => ({ model, fragments }));
  }

  const removeFragmentFromModel = (modelNum: number, fragmentName: string) => {
    if (modelNum === selectedModel) {
      removeSelectedFragment(fragmentName);
      return;
    }

    setModelSelections((prev) => {
      const prevSel = prev[modelNum];
      if (!prevSel) return prev;
      const fragmentToRemove = prevSel.selectedFragments.find((f) => f.name === fragmentName);
      if (!fragmentToRemove) return prev;

      const newSelectedFragments = prevSel.selectedFragments.filter((f) => f.name !== fragmentName);

      const newChainsState = prevSel.chainsState.map((chain) => {
        if (chain.name === fragmentToRemove.chainName) {
          return {
            ...chain,
            nucleotides: chain.nucleotides.map((nucleotide) => {
              const shouldRemainSelected = prevSel.selectedFragments.some(
                (f) => f.name !== fragmentName && f.chainName === chain.name && f.residues.includes(nucleotide.index)
              );
              if (fragmentToRemove.residues.includes(nucleotide.index) && !shouldRemainSelected) {
                return { ...nucleotide, selected: false };
              }
              return nucleotide;
            }),
          };
        }
        return chain;
      });

      return {
        ...prev,
        [modelNum]: {
          chainsState: newChainsState,
          selectedFragments: newSelectedFragments,
        },
      };
    });
  }

  const handleSubmitSelection = () => {
    const start = parseInt(inputValueStart, 10);
    const end = parseInt(inputValueEnd, 10);
    
        console.log(`Selected range: ${start} to ${end} on chain ${selectedChain}`);

    if (isNaN(start) || isNaN(end) || start > end || start <= 0 || end <= 0) {
        alert(`Invalid range: ${start} to ${end}`);
        return;
    }
    if (minId && maxId && start >= parseInt(minId, 10) && end <= parseInt(maxId, 10)) {

        const selectedNucleotides = chainsState
            .find(chain => chain.name === selectedChain)
            ?.nucleotides
            .filter(nucleotide => nucleotide.index >= start && nucleotide.index <= end)
            .map(nucleotide => nucleotide.index) || [];
        
        selectFragment(`Range ${start}-${end}`, selectedChain, selectedNucleotides);
    } else {
        alert("Type valid range on selected chain");
    }

  };

  const resetSettings = () => {
    const clearedCurrentChains = clearChainSelections(chainsState);

    setChainsState(clearedCurrentChains);
    setSelectedFragments([]);
    setModelSelections((prev) => {
      const clearedModels: Record<number, { chainsState: Chain[]; selectedFragments: SelectedFragment[] }> = {};

      Object.entries(prev).forEach(([modelKey, modelSelection]) => {
        const modelNum = Number(modelKey);
        clearedModels[modelNum] = {
          chainsState: clearChainSelections(modelSelection.chainsState),
          selectedFragments: [],
        };
      });

      if (selectedModel !== 0) {
        clearedModels[selectedModel] = {
          chainsState: clearedCurrentChains,
          selectedFragments: [],
        };
      }

      return clearedModels;
    });

    /* Resetting model and chain */
    // if ( myData && myData.metadata.model_count === 1 ) {
    //   setSelectedModel(1);
    //   /* If there is only one chain, select it.*/
    //   if (chainsState.length < 2) {
    //     setSelectedChain(chainsState[0]?.name || "");
    //   } else {
    //     setSelectedChain("");
    //   }
    // } else {
    //   setSelectedModel(0);
    //   setSelectedChain("");
    // }
  }

  useEffect(() => {
    if (!jobID) return;
    loadData(jobID, 1);
  }, [jobID]);

  if (error) return <ErrorPage errorMessage={error} />;
  if (!myData) {
    return <Loading page="Analysis panel" />;
  }
  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      {/* Desktop view */}
      <div className="flex flex-col h-full w-full">
        {/* Top panel */}
        <TopPanel />
        {/* Main content */}
        <div className="text-gray-800 text-sm/6 overflow-y-auto min-h-0">
        {/* Scrollable content */}
          <div className="mx-2 md:mx-16">
            {/* Job data */}
            <div className="mt-10 text-gray-500">
              <p>Input data defined in previous step</p>
              <div className="mt-2 space-y-0">
                <p><span>Structure:</span><i className="ml-2">{myData.name || "Unnamed job"}</i></p>
                <p><span>Local analysis {
                myData.metadata.analyzeNeighborhoods ? 
                "enabled; sphere radius (Å): " + myData.metadata.radius 
                // + "; sampling interval: " + myData.metadata.interval
                : "disabled"}
                </span></p>
              </div>
            </div>
            {/* Analysis setup */}
            <div className="mt-10">
              <h1 className="font-semibold">Analysis setup</h1>
              {/* Model selection */}
              <div className="mt-2">
                <div>
                  <label>Select model(s)</label>
                  <span className="group relative inline-flex cursor-help items-center justify-center ml-2">
                    <span
                      aria-label="What this field does"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                    >
                      ?
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                      Select a model to inspect and define regions for analysis.
                    </span>
                  </span>
                </div>
                <div className="flex flex-row overflow-x-auto gap-2 py-2" style={{ scrollbarWidth: "thin" }}>
                  {myData.metadata.models.map((modelNum) => {
                    return (
                      <div
                        key={"model" + modelNum}
                        className={`p-2 bg-white rounded shadow cursor-pointer transition-all w-12 flex-shrink-0 ${
                          selectedModel === modelNum ? "border-2 border-moley-darkGreen" : "border border-transparent"
                        } flex items-center justify-center`}
                        onClick={() => changeModel(modelNum)}
                      >
                        <span>{modelNum}</span>
                      </div>
                    );
                  })}
                </div>
                {/* 2D and 3D view */}
                <div>
                  <button
                    className="h-auto w-auto px-2 my-2 border text-gray-800 bg-gray-100 text-sm/6 rounded hover:bg-gray-200 hover:text-gray-800"
                    onClick={() => setShowVisualization(!showVisualization)}
                    title={"Show or hide the structure visualization. The selected region is highlighted in green for easy identification."}
                  >
                    {showVisualization ? "Hide model visualization ▲" : "Show model visualization ▼"}
                  </button>
                  {showVisualization && (
                  <div className="flex flex-col md:flex-row h-[60vh] min-h-[400px]">
                    <div className="w-full md:w-1/2 h-full relative border border-gray-300">
                      {/* Gear icon button */}
                      <button
                        onClick={() => setShowFornaSettings(!showFornaSettings)}
                        className="absolute top-5 right-5 z-20 px-2 py-1 bg-white rounded-lg shadow hover:bg-gray-100 transition text-lg w-fit"
                        title="Toggle Forna settings"
                      >
                        ⚙️
                      </button>
                      {/* Floating settings panel */}
                      {showFornaSettings && (
                        <div className="absolute inset-0 z-30 p-5 bg-white rounded-lg shadow-lg overflow-auto">
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold">Forna settings</h3>
                            <button
                              onClick={() => setShowFornaSettings(false)}
                              className="px-2 py-1 bg-white rounded-lg shadow hover:bg-gray-100 text-gray-500 hover:text-gray-700 text-lg w-fit"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="flex flex-col gap-3">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={numbering}
                                onChange={e => setNumbering(e.target.checked)}
                                className="mr-2"
                              />
                              <span>Numbering</span>
                            </label>
                            {numbering && (
                              <div className="ml-4 mb-2">
                                <label className="block text-sm font-medium mb-1">Label interval</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={labelInterval}
                                  onChange={e => setLabelInterval(Number(e.target.value))}
                                  className="w-full border rounded px-2 py-1"
                                />
                              </div>
                            )}
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={nodeOutline}
                                onChange={e => setNodeOutline(e.target.checked)}
                                className="mr-2"
                              />
                              <span>Node outline</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={nodeLabel}
                                onChange={e => setNodeLabel(e.target.checked)}
                                className="mr-2"
                              />
                              <span>Node label</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={links}
                                onChange={e => setLinks(e.target.checked)}
                                className="mr-2"
                              />
                              <span>Show connectivity</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={animation}
                                onChange={e => setAnimation(e.target.checked)}
                                className="mr-2"
                              />
                              <span>Animation</span>
                            </label>
                          </div>
                        </div>
                      )}
                      <FornaComponent
                        chains={chainsState}
                        setChains={setChainsState}
                        labelInterval={labelInterval}
                        numbering={numbering}
                        nodeOutline={nodeOutline}
                        nodeLabel={nodeLabel}
                        links={links}
                        directionArrows={false}
                        setAnimation={animation}
                        setIsViewInitialized={setIsViewInitialized}
                      />
                    </div>
                    <div className="w-full md:w-1/2 h-full">
                      <Molstar
                        useInterface={true}
                        file={myData.pdb_file_string}
                        chains={chainsState}
                        selectResidue={selectResidue}
                        deselectResidue={deselectResidue}
                        initialized={initialized}
                        setInitialized={setInitialized}
                        setIsViewInitialized={setIsViewInitialized}
                      />
                    </div>
                  </div>
                  )}
                </div>
              </div>
              {/* Chain selection */}
              <div>
                <div>
                  <label className="mt-4">Select chain(s) of model {selectedModel === 0 ? "<X>" : selectedModel}</label>
                  <span className="group relative inline-flex cursor-help items-center justify-center ml-2">
                    <span
                      aria-label="What this field does"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                    >
                      ?
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                      Select a chain to analyze. Its sequence and structure will be displayed below for region selection.
                    </span>
                  </span>
                </div>
                <div className="flex flex-row overflow-x-auto gap-2 py-2" style={{ scrollbarWidth: "thin" }}>
                  {chainsState.map((chain) => {
                    return (
                      <div
                        key={"chain" + chain.name}
                        className={`p-2 bg-white rounded shadow transition-all w-12 flex-shrink-0 flex items-center justify-center
                          ${selectedModel === 0 ? "border border-transparent bg-gray-200 cursor-not-allowed" :
                            "cursor-pointer " +(selectedChain === chain.name ? "border-2 border-moley-darkGreen" : "border border-transparent")} 
                          `}
                        onClick={() => selectedModel !== 0 && setSelectedChain(chain.name)}
                      >
                        <span>{chain.original_name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Region selection */}
              <div>
                <div>
                  <label className="mt-4">Select region(s) of model {selectedModel || "<X>"}.chain {selectedChain || "<Y>"}</label>
                  <span className="group relative inline-flex cursor-help items-center justify-center ml-2">
                    <span
                      aria-label="What this field does"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                    >
                      ?
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                      Select a region to analyze by specifying a residue range or by selecting it in the sequence view below.
                    </span>
                  </span>
                </div>
                <div className="flex flex-row items-center">
                  <span>Start residue:</span>
                  <input
                    id="residueRangeStart"
                    type="number"
                    value={inputValueStart}
                    onChange={handleInputChangeStart}
                    disabled={selectedModel === 0 || !selectedChain}
                    placeholder={(selectedModel === 0 || !selectedChain) ? minId : undefined}
                    min={minId}
                    max={maxId}
                    className="mx-2 p-1 border rounded w-24 disabled:bg-gray-200"
                  />
                  <span>End residue:</span>
                  <input
                    id="residueRangeEnd"
                    type="number"
                    value={inputValueEnd}
                    onChange={handleInputChangeEnd}
                    disabled={selectedModel === 0 || !selectedChain}
                    placeholder={(selectedModel === 0 || !selectedChain) ? undefined : maxId}
                    min={minId}
                    max={maxId}
                    className="mx-2 p-1 border rounded w-24 disabled:bg-gray-200"
                  />
                  <button
                    className="ml-4 my-0 border text-gray-800 bg-gray-100 text-sm/6 rounded hover:bg-gray-200 hover:text-gray-800 disabled:bg-gray-400 disabled:text-gray-100 disabled:cursor-not-allowed"
                    disabled={inputValueStart === "" || inputValueEnd === "" || selectedModel === 0 || !selectedChain}
                    onClick={handleSubmitSelection}
                    title={"Adds the specified residue range to the selection and highlights it below."}
                  >
                    Add to selection
                  </button>
                </div>
                <div className="mt-2">
                  <label>Selected regions are highlighted below. Click residues to add or remove them from the selection.</label>
                  <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                    <ResidueTable
                      data={chainsState}
                      selectedChain={selectedChain}
                      selectedResidueIds={selectedResidueIdsForChain}
                      selectResidue={selectResidue}
                      selectFragment={selectFragment}
                      deselectResidue={deselectResidue}
                      deselectFragment={removeSelectedFragment}
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Selection summary */}
            <div>
              <div className="flex flex-row mt-10 items-center">
                <h1 className="font-semibold">Selection summary</h1>
                <button 
                  className="h-auto w-auto px-2 ml-4 my-0 border text-gray-800 bg-gray-100 text-sm/6 rounded hover:bg-gray-200 hover:text-gray-800"
                  onClick={() => {
                    // Reset model selection, chain selection and selected fragments
                    resetSettings();
                  }}
                >Clear all
                </button>
              </div>
              <div className="h-48 w-full overflow-y-auto p-2 rounded-md">
                {(() => {
                  const grouped = getAllSelectedFragmentsGrouped();
                  return (
                    <div className="w-full">
                      <table className="w-full table-fixed">
                        <colgroup>
                          <col style={{ width: '60px' }} />
                          <col style={{ width: '5em' }} />
                          <col style={{ width: '5em' }} />
                          <col style={{ width: '60%' }} />
                        </colgroup>
                        <thead>
                          <tr className={"border-y border-gray-300"}>
                            <th></th>
                            <th className="text-left">Model</th>
                            <th className="text-left">Chain</th>
                            <th className="text-left">Residues</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grouped.map(({ model, fragments }) => (
                            fragments.map((fragment, idx) => (
                              <tr key={`${model}-${fragment.name}-${fragment.chainName}-${idx}`}
                                className={"border-b border-gray-200"}>
                                <td>
                                  <div
                                    className="ml-1 px-1 py-0.5 bg-white text-center text-gray-800 border border-gray-800 rounded hover:bg-gray-200 w-8 h-6 flex items-center justify-center"
                                    onClick={() => removeFragmentFromModel(model, fragment.name)}
                                    title={"Removes the entry from the selection summary."}
                                  >
                                    X
                                  </div>
                                </td>
                                <td>{model}</td>
                                <td>{fragment.chainName}</td>
                                <td>
                                  {model === selectedModel
                                    ? formatResidueRanges(fragment.residues)
                                    : formatResidueRangesForChains(fragment.residues, modelSelections[model]?.chainsState ?? chainsState)}
                                  {fragment.deselectedResidues && fragment.deselectedResidues.length > 0 && (
                                    <span className="ml-2 text-xs text-orange-600">
                                      (except: {model === selectedModel
                                        ? formatResidueRanges(fragment.deselectedResidues)
                                        : formatResidueRangesForChains(fragment.deselectedResidues, modelSelections[model]?.chainsState ?? chainsState)})
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
            {/* Run analysis button */}
            <div className="mb-10">
              <button
                className="rounded-md px-1 py-2 bg-moley-darkGreen text-sm font-semibold text-white shadow-xs hover:bg-moley-green focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={getAllSelectedFragmentsGrouped().length === 0}
                onClick={handleNavigate}
              >
                Run analysis
              </button>
            </div>
          </div>
          <Footer />
        </div>
      </div>
      {/* Mobile view */}
      {/* <div className="md:hidden h-full w-full overflow-y-auto">
        <SmallScreenPage />
      </div> */}
    </div>
  );
};
export default Panel;
