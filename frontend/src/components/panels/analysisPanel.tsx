import React, { useEffect, useState } from "react";
import Loading from "../common/loading";
import "../../App.css";
import Molstar from "../visualizations/molStarComponent";
import FornaComponent from "../visualizations/fornacWrapper";
import { useNavigate, useParams } from "react-router-dom";
import FornaControls from "../common/fornaControls";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import { Job, Chain, Nucleotide, SelectedFragment, ChainElement } from "../utils/types";
import { fetchJobData, sendDataToAnalyze } from "../utils/api";
import { transformJobToChains } from "../utils/transformJobToChains";
import { Colors } from "../common/colors";
import HelpIcon from "../common/helpIcon";
import Logo from "../common/logo";
import ErrorPage from "../common/ErrorPage";
import RangeSelecting from "../common/rangeSelecting";
import HomeIcon from "../common/homeIcon";
import SmallScreenPage from "../common/smallScreenPage";
import TopPanel from "../common/topPanel";
import ResidueTable from "../visualizations/ResidueTable";

const Panel: React.FC = () => {
  const [myData, setMyData] = useState<Job>();
  const [error, setError] = useState<string | null>(null);

  const [sphereRadius, setSphereRadius] = useState<number>(5);
  const [sphereInterval, setSphereInterval] = useState<number>(1);

  const [labelInterval, setLabelInterval] = useState(10);
  const [numbering, setNumbering] = useState(false);
  const [nodeOutline, setNodeOutline] = useState(true);
  const [nodeLabel, setNodeLabel] = useState(true);
  const [links, setLinks] = useState(true);
  const [directionArrows, setDirectionArrows] = useState(false);
  const [animation, setAnimation] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [chainsState, setChainsState] = useState<Chain[]>([]);
  const [selectedModel, setSelectedModel] = useState<number>(1);
  const [useWalkingSphere, setUseWalkingSphere] = useState(false);
  const [selectedChain, setSelectedChain] = useState<string>(
    chainsState[0]?.name.slice(-1) || ""
  );
  const [inputValueStart, setInputValueStart] = useState<string>("");
  const [inputValueEnd, setInputValueEnd] = useState<string>("");
  const [minId, setMinId] = useState<string>("");
  const [maxId, setMaxId] = useState<string>("");
  const [selectedList, setSelectedList] = useState<ChainElement[]>([]);
  const [selectedFragments, setSelectedFragments] = useState<SelectedFragment[]>([]);
  const [isViewInitialized, setIsViewInitialized] = useState<boolean>(true);
  const { jobId } = useParams();
  const jobID = jobId;
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const isDisabled = !(selectedList.length > 0);
  const [sidebarTab, setSidebarTab] = useState(0);
  const [modelSelections, setModelSelections] = useState<Record<number, {chainsState: Chain[], selectedFragments: SelectedFragment[]}>>({});

  useEffect(() => {
    setSelectedChain(chainsState[0]?.name.slice(-1) || "");
  }, [myData]);

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
    chainsState.forEach((chain) => {
      if (chain.name.slice(-1) === selectedChain) {
        const indices = chain.nucleotides.map((nucleotide) => nucleotide.index);
        const min = Math.min(...indices);
        const max = Math.max(...indices);

        setMinId(min.toString());
        setMaxId(max.toString());
        setInputValueStart(min.toString());
        setInputValueEnd(max.toString());
      }
    });
  }, [selectedChain]);

  async function loadData(jobID: string | undefined, model: number = 1) {
    try {
      const data = await fetchJobData(jobID, model);
      setMyData(data);
      console.log(data);
      const chains = transformJobToChains(data);
      setChainsState(chains);
      setSelectedModel(model);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    }
  }

  async function handleNavigate() {
    if (useWalkingSphere) {
      if (sphereRadius < 1) {
        alert(
          `Invalid radius value: ${sphereRadius}. Enter value greater or equal 1.`
        );
        return;
      } else if (sphereInterval < 1) {
        alert(
          `Invalid interval value: ${sphereInterval}. Enter value greater or equal 1.`
        );
        return;
      }
      await sendDataToAnalyze(
        useWalkingSphere,
        jobID,
        selectedModel,
        selectedList,
        sphereRadius,
        sphereInterval
      );
    }
    else {
      await sendDataToAnalyze(
        useWalkingSphere,
        jobID,
        selectedModel,
        selectedList
      );
    }
    navigate(`/summary/${jobID}`);
    
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
      } else {
        setChainsState(prev =>
          prev.map(chain => ({
            ...chain,
            nucleotides: chain.nucleotides.map(n => ({ ...n, selected: false }))
          }))
        );
        setSelectedFragments([]);
      }
      setSelectedModel(model);
    });
  };

  const selectFragment = (name: string, chainName: string, residueIds: number[]) => {
    // check if all residues are already selected
    const allSelected = residueIds.every((id) =>
      chainsState.some(
        (chain) =>
          chain.name.slice(-1) === chainName &&
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
        if (chain.name.slice(-1) === chainName) {
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
        chain.name.slice(-1) === chainName &&
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
        if (chain.name.slice(-1) === chainName) {
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
        if (chain.name.slice(-1) === chainName) {
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
        if (chain.name.slice(-1) === fragmentToRemove.chainName) {
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

  useEffect(() => {
    if (!jobID) return;
    loadData(jobID, 1);
  }, [jobID]);

  useEffect(() => {
    const selectedChainElements: ChainElement[] = chainsState.flatMap((chain) =>
      chain.nucleotides
        .filter((nucleotide) => nucleotide.selected)
        .map((nucleotide) => ({
          chainID: chain.name.slice(-1),
          residueID: nucleotide.index,
        }))
    );
    console.log("Selected IDs:", selectedChainElements);
    setSelectedList(selectedChainElements);
  }, [chainsState]);

  if (error) return <ErrorPage errorMessage={error} />;
  if (!myData) {
    return <Loading page="Analysis panel" />;
  }
  return (
    <div className="desktop-content h-screen w-screen overflow-hidden">
      {/* Top panel */}
      <div className="sticky top-0 z-50 bg-white">
        <TopPanel />
      </div>

      {/* Side view + Main content */}
      <div className="flex overflow-hidden h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <div className="w-80">
          <div
            className="flex flex-col  bg-moley-backgroundGreen h-full w-80 px-4 pt-10 p-2 rounded-t-lg justify-between"
          >
            {/* Inside sidebar */}
            <div className="rounded-scrollbar overflow-auto flex-1">
              {/* Tabs */}
              <div className="flex mb-4">
                <div
                  className={`flex-1 py-2 rounded-tl-lg text-center ${sidebarTab === 0 ? "bg-white font-bold shadow" : "bg-moley-backgroundLightGreen"}`}
                  onClick={() => setSidebarTab(0)}
                >
                  Models
                </div>
                <div
                  className={`flex-1 py-2 rounded-tr-lg text-center ${sidebarTab === 1 ? "bg-white font-bold shadow" : "bg-moley-backgroundLightGreen"}`}
                  onClick={() => setSidebarTab(1)}
                >
                  Settings
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
                <>
                  {/* Neighborhood sphere group */}
                  {useWalkingSphere && (
                    <div className="mb-4 p-2 bg-white rounded shadow">
                      <h3 className="font-bold mb-2">Neighborhood sphere</h3>
                      <div className="mb-2">
                        <label className="block text-sm font-medium mb-1">Radius</label>
                        <input
                          type="number"
                          min={1}
                          value={sphereRadius}
                          onChange={e => setSphereRadius(parseInt(e.target.value))}
                          className="w-full border rounded px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Interval</label>
                        <input
                          type="number"
                          min={1}
                          value={sphereInterval}
                          onChange={e => setSphereInterval(parseInt(e.target.value))}
                          className="w-full border rounded px-2 py-1"
                        />
                      </div>
                    </div>
                  )}
                  {/* Fornac group */}
                  <div className="mb-4 p-2 bg-white rounded shadow">
                    <h3 className="font-bold mb-2">Fornac settings</h3>
                    <div className="flex flex-col gap-2">
                      <label>
                        <input
                          type="checkbox"
                          checked={numbering}
                          onChange={e => setNumbering(e.target.checked)}
                          className="mr-2"
                        />
                        Numbering
                      </label>
                      {numbering && (
                        <div className="mb-2">
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
                      <label>
                        <input
                          type="checkbox"
                          checked={nodeOutline}
                          onChange={e => setNodeOutline(e.target.checked)}
                          className="mr-2"
                        />
                        Node outline
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={nodeLabel}
                          onChange={e => setNodeLabel(e.target.checked)}
                          className="mr-2"
                        />
                        Node label
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={directionArrows}
                          onChange={e => setDirectionArrows(e.target.checked)}
                          className="mr-2"
                        />
                        Direction arrows
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={links}
                          onChange={e => setLinks(e.target.checked)}
                          className="mr-2"
                        />
                        Show links
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={animation}
                          onChange={e => setAnimation(e.target.checked)}
                          className="mr-2"
                        />
                        Animation
                      </label>
                    </div>
                  </div>
                </>
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
          {/* Analyze neighborhood switch */}
            <div className="flex items-center gap-2 p-4">
            <label htmlFor="sequential-toggle" className="font-semibold">
              Analyze residue neighborhoods
            </label>
            <input
              id="sequential-toggle"
              type="checkbox"
              checked={useWalkingSphere}
              onChange={e => setUseWalkingSphere(e.target.checked)}
              className="w-5 h-5 accent-moley-accentGreen"
            />
            </div>
          {myData ? (
            <div className="flex flex-col min-h-full">
              <div className="bg-transparent z-10">
                <div className="overflow-x-auto">
                  <ResidueTable
                    data={chainsState}
                    selectedChain={selectedChain}
                    selectedResidueIds={selectedList.filter(ce => ce.chainID === selectedChain).map(ce => ce.residueID)}
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
                  {selectedFragments.length === 0 ? (
                    <span >No fragments selected</span>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th></th>
                          <th className="text-left">Name</th>
                          <th className="text-left">Chain</th>
                          <th className="text-left">Residues</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedFragments.map((fragment, idx) => (
                          <tr key={fragment.name + fragment.chainName + idx}>
                            <td>
                              <div
                                className="ml-2 px-1 py-1 bg-white text-center text-red-600 rounded hover:bg-gray-200"
                                onClick={() => removeSelectedFragment(fragment.name)}
                                title="Usuń fragment"
                              >
                                X
                              </div>
                            </td>
                            <td>{fragment.name}</td>
                            <td>{fragment.chainName}</td>
                            <td>
                              {formatResidueRanges(fragment.residues)}
                              {fragment.deselectedResidues && fragment.deselectedResidues.length > 0 && (
                                <span className="ml-2 text-xs text-yellow-200">
                                  (except: {formatResidueRanges(fragment.deselectedResidues)})
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              {/* Forna + Molstar */}
              <div className="flex flex-row h-[60vh] min-h-[400px]">
                <div className="w-1/2 h-full p-5">
                  <FornaComponent
                    chains={chainsState}
                    setChains={setChainsState}
                    labelInterval={labelInterval}
                    numbering={numbering}
                    nodeOutline={nodeOutline}
                    nodeLabel={nodeLabel}
                    links={links}
                    directionArrows={directionArrows}
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
