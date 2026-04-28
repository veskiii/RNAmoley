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
import RangeSelecting from "../common/rangeSelecting";
import SmallScreenPage from "../common/smallScreenPage";
import TopPanel from "../common/topPanel";
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

const AUTO_SELECT_FRAGMENTS_BY_JOB: Record<string, AutoSelectFragmentConfig[]> = {
  "Example 1": [{ fragment: "(1:A:1-90)", label: "Range 1-90" }],
  // "Example 2": [{ fragment: "(1:A:50-78)", label: "Range 50-78" }],
  "Example 3": [{ fragment: "(1:A:42-83)", label: "Range 42-83" }],
};

function parseAutoSelectFragmentSpec(
  entry: AutoSelectFragmentConfig
): AutoSelectFragmentSpec | null {
  const { fragment, label } = entry;
  const match = fragment.match(/^\(\s*(\d+)\s*:\s*([^:()]+)\s*:\s*(\d+)(?:-(\d+))?\s*\)$/);
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
    label,
  };
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
      selectedChain: chains[0]?.name || "",
    };
  }

  const parsedSpecs = configuredSpecs
    .map(parseAutoSelectFragmentSpec)
    .filter((spec): spec is AutoSelectFragmentSpec => spec !== null)
    .filter((spec) => spec.model === model);

  if (parsedSpecs.length === 0) {
    return {
      chains,
      selectedFragments: [],
      selectedChain: chains[0]?.name || "",
    };
  }

  const selectedFragments: SelectedFragment[] = [];
  const selectedResiduesByChain = new Map<string, Set<number>>();
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

    selectedFragments.push({
      name: spec.label,
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
  const [selectedModel, setSelectedModel] = useState<number>(1);
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

    if (!selectedChain || !chainsState.some((chain) => chain.name === selectedChain)) {
      setSelectedChain(chainsState[0]?.name || "");
    }
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
      setSelectedChain(configuredSelection.selectedChain);
      setSelectedModel(model);
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

  useEffect(() => {
    if (!jobID) return;
    loadData(jobID, 1);
  }, [jobID]);

  if (error) return <ErrorPage errorMessage={error} />;
  if (!myData) {
    return <Loading page="Analysis panel" />;
  }
  return (
    <div className="desktop-content h-screen w-screen overflow-hidden">
      {/* Top panel */}
        <TopPanel />

      {/* Side view + Main content */}
      <div className="flex overflow-hidden h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <div className="w-80">
          <div
            className="flex flex-col  bg-moley-backgroundGreen h-full w-80 px-4 pt-10 p-2 rounded-t-lg justify-between"
          >
            {/* Inside sidebar */}
            <div className="rounded-scrollbar overflow-auto flex-1">
              <div className="mb-4 rounded-lg bg-white p-3 shadow">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Job name
                </div>
                <div className="truncate text-sm font-semibold text-gray-900" title={myData.name || "Unnamed job"}>
                  {myData.name || "Unnamed job"}
                </div>
              </div>
              {/* Tabs */}
              <div className="flex mb-4">
                <div
                  className={`flex-1 py-2 rounded-t-lg text-center ${sidebarTab === 0 ? "bg-white font-bold shadow" : "bg-moley-backgroundLightGreen"}`}
                  onClick={() => setSidebarTab(0)}
                >
                  Models
                </div>
              </div>
              {/* Inside tabs */}
              
              {sidebarTab === 0 && (
                <>
                  {Array.from({ length: myData.metadata.model_count }, (_, i) => {
                    const modelNum = i + 1;
                    const hasSelections = modelSelections[modelNum]?.selectedFragments?.length > 0;
                    return (
                      <div
                        key={"model" + modelNum}
                        className={`mb-4 p-2 bg-white rounded shadow cursor-pointer transition-all ${
                          selectedModel === modelNum ? "border-2 border-moley-darkGreen" : "border border-transparent"
                        } flex items-center justify-between`}
                        onClick={() => changeModel(modelNum)}
                      >
                        <span>Model {modelNum}</span>
                        {hasSelections && (
                          <span
                            className="ml-2 w-3 h-3 rounded-full bg-moley-accentGreen inline-block"
                            title="Wybrano fragmenty"
                          ></span>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              {sidebarTab === 1 && (
                <></>
              )}
            </div>
            {/* Analyze button */}
            <div className="mt-4 flex justify-center">
              <button
                className="bg-moley-darkGreen hover:bg-moley-green text-white font-bold py-2 px-6 rounded shadow disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isDisabled}
                onClick={handleNavigate}
              >
                Analyze
              </button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div
          key={myData.id}
          className="flex-1 overflow-y-auto overflow-x-hidden"
        >
          {myData ? (
            <div className="flex flex-col min-h-full">
              <div className="bg-transparent z-10">
                <div className="overflow-x-auto">
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
              <div className="flex flex-row bg-transparent z-10">
                <RangeSelecting
                  chains={chainsState}
                  selectedChain={selectedChain}
                  minId={minId}
                  maxId={maxId}
                  inputValueStart={inputValueStart}
                  inputValueEnd={inputValueEnd}
                  setMinId={setMinId}
                  setMaxId={setMaxId}
                  setInputValueStart={setInputValueStart}
                  setInputValueEnd={setInputValueEnd}
                  handleChange={handleChange}
                  handleInputChangeStart={handleInputChangeStart}
                  handleInputChangeEnd={handleInputChangeEnd}
                  selectFragment={selectFragment}
                />
                <div className="bg-moley-backgroundGreen h-48 m-2 w-full overflow-y-auto p-2 rounded-md">
                  {(() => {
                    const grouped = getAllSelectedFragmentsGrouped();
                    if (!grouped || grouped.length === 0) {
                      return <span>No fragments selected</span>;
                    }

                    return (
                      <div className="w-full">
                        {grouped.map(({ model, fragments }) => (
                          <div key={`model-${model}`} className="mb-2">
                            <div className="font-semibold">Model {model}</div>
                            <table className="w-full table-fixed">
                              <colgroup>
                                <col style={{ width: '40px' }} />
                                <col style={{ width: '25%' }} />
                                <col style={{ width: '15%' }} />
                                <col style={{ width: '60%' }} />
                              </colgroup>
                              <thead>
                                <tr>
                                  <th></th>
                                  <th className="text-left">Name</th>
                                  <th className="text-left">Chain</th>
                                  <th className="text-left">Residues</th>
                                </tr>
                              </thead>
                              <tbody>
                                {fragments.map((fragment, idx) => (
                                  <tr key={`${model}-${fragment.name}-${fragment.chainName}-${idx}`}>
                                    <td>
                                      <div
                                        className="ml-1 px-1 py-0.5 bg-white text-center text-red-600 rounded hover:bg-gray-200 w-8 h-6 flex items-center justify-center"
                                        onClick={() => removeFragmentFromModel(model, fragment.name)}
                                        title="Usuń fragment"
                                      >
                                        X
                                      </div>
                                    </td>
                                    <td>{fragment.name}</td>
                                    <td>{fragment.chainName}</td>
                                    <td>
                                      {model === selectedModel
                                        ? formatResidueRanges(fragment.residues)
                                        : formatResidueRangesForChains(fragment.residues, modelSelections[model]?.chainsState ?? chainsState)}
                                      {fragment.deselectedResidues && fragment.deselectedResidues.length > 0 && (
                                        <span className="ml-2 text-xs text-yellow-200">
                                          (except: {model === selectedModel
                                            ? formatResidueRanges(fragment.deselectedResidues)
                                            : formatResidueRangesForChains(fragment.deselectedResidues, modelSelections[model]?.chainsState ?? chainsState)})
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
              {/* Forna + Molstar */}
              <div className="flex flex-row h-[60vh] min-h-[400px]">
                <div className="w-1/2 h-full p-5 relative">
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
                <div className="w-1/2 h-full p-5">
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
            </div>
          ) : (
            <Loading />
          )}
        </div>
      </div>
      <SmallScreenPage />
    </div>
  );
};
export default Panel;
