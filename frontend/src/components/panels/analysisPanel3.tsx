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
import { Job, Chain, Nucleotide, SelectedFragment } from "../utils/types";
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
  const [selectedList, setSelectedList] = useState<number[]>([]);
  const [selectedFragments, setSelectedFragments] = useState<SelectedFragment[]>([]);
  const [isViewInitialized, setIsViewInitialized] = useState<boolean>(true);
  const { jobId } = useParams();
  const jobID = jobId;
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const isDisabled = !(selectedList.length > 0);

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
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    }
  }

  function handleNavigate() {
    if (useWalkingSphere) {
      const radius = parseInt(
        "5"
      );
      const interval = parseInt(
        "1"
      );
      if (radius < 1) {
        alert(
          `Invalid radius value: ${radius}. Enter value greater or equal 1.`
        );
        return;
      } else if (interval < 1) {
        alert(
          `Invalid interval value: ${interval}. Enter value greater or equal 1.`
        );
        return;
      } 
    }
    sendDataToAnalyze(
      useWalkingSphere,
      jobID,
      selectedModel,
      selectedList
    );
    navigate(`/summary/${jobID}`);
    
  }

  const handleSetSelectedModel = (e: SelectChangeEvent) => {
    setSelectedModel(parseInt(e.target.value));
  };

  const changeModel = (model: number) => {
    if (!jobID || model === selectedModel) return;
    loadData(jobID, model);
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

  const removeSelectedFragment = ( selectedFragmentName: string ) => {
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
                    f.chainName === fragmentToRemove.chainName &&
                    f.residues.includes(nucleotide.index)
                ) === false
              ) {
                console.log("Deselecting nucleotide:", nucleotide.index);
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
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(",");
}

  useEffect(() => {
    if (!jobID) return;
    loadData(jobID, 1);
  }, [jobID]);

  useEffect(() => {
    const idList: number[] = chainsState.flatMap((chain) =>
      chain.nucleotides
        .filter((nucleotide) => nucleotide.selected)
        .map((nucleotide) => nucleotide.index)
    );
    console.log("Selected IDs:", idList);
    setSelectedList(idList);
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
            className="flex flex-col h-full w-80 px-4 pt-10 p-2 rounded-t-lg justify-between"
            style={{ background: Colors.backgroundBeige }}
          >
            {/* Scrollowalna zawartość sidebar'a */}
            <div className="rounded-scrollbar overflow-auto flex-1">
              {/* ...tutaj Twoja zawartość sidebar'a... */}
            </div>
            {/* Przycisk Analyze na dole sidebar'a */}
            <div className="mt-4 flex justify-center">
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded shadow disabled:opacity-50 disabled:cursor-not-allowed"
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
          {/* Toggle analizowania sekwencyjnego */}
            <div className="flex items-center gap-2 p-4">
            <label htmlFor="sequential-toggle" className="font-semibold">
              Analyze residue neighborhoods
            </label>
            <input
              id="sequential-toggle"
              type="checkbox"
              checked={useWalkingSphere}
              onChange={e => setUseWalkingSphere(e.target.checked)}
              className="w-5 h-5 accent-blue-600"
            />
            </div>
          {myData ? (
            <div className="flex flex-col min-h-full">
              <div className="bg-transparent z-10">
                <div className="overflow-x-auto">
                  <ResidueTable
                    data={chainsState}
                    selectedChain={selectedChain}
                    selectedResidueIds={selectedList}
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
                <div className="bg-gray-400 h-48 m-2 w-full overflow-y-auto p-2 rounded-md">
                  {selectedFragments.length === 0 ? (
                    <span >Brak wybranych fragmentów</span>
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
                    selectedChain={selectedChain}
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
