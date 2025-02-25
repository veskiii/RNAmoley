import { useEffect } from "react";
import { Chain } from "../utils/types";
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';

interface RangeSelectingProps {
    chains: Chain[];
    selectedChain: string;
    minId: string;
    maxId: string;
    inputValueStart: string;
    inputValueEnd: string;
    setChainsState: React.Dispatch<React.SetStateAction<Chain[]>>;
    setMinId: React.Dispatch<React.SetStateAction<string>>;
    setMaxId: React.Dispatch<React.SetStateAction<string>>;
    setInputValueStart: React.Dispatch<React.SetStateAction<string>>;
    setInputValueEnd: React.Dispatch<React.SetStateAction<string>>;
    handleChange: (event: SelectChangeEvent<string>) => void;
    handleInputChangeStart: React.ChangeEventHandler<HTMLInputElement>;
    handleInputChangeEnd: React.ChangeEventHandler<HTMLInputElement>;
}

const RangeSelecting: React.FC<RangeSelectingProps> = ({
    chains,
    selectedChain,
    minId,
    maxId,
    inputValueStart,
    inputValueEnd,
    setChainsState,
    setMinId,
    setMaxId,
    setInputValueStart,
    setInputValueEnd,
    handleChange,
    handleInputChangeStart,
    handleInputChangeEnd,
}) => {
    const handleSubmit = () => {
        const start = parseInt(inputValueStart, 10);
        const end = parseInt(inputValueEnd, 10);

        if (isNaN(start) || isNaN(end) || start > end || start <= 0 || end <= 0) {
            alert(`Invalid range: ${start} to ${end}`);
            return;
        }
        if (minId && maxId && start >= parseInt(minId, 10) && end <= parseInt(maxId, 10)) {
            setChainsState(prevChains =>
                prevChains.map(chain => {
                    if (chain.name.slice(-1) === selectedChain) {

                        return {
                            ...chain,
                            nucleotides: chain.nucleotides.map(nucleotide => ({
                                ...nucleotide,
                                selected: nucleotide.index >= start && nucleotide.index <= end,
                            })),
                        };
                    }
                    return chain;
                }));
        } else {
            alert("Type valid range on selected chain");
        }

    };

    useEffect(() => {
        chains.forEach((chain) => {
            if (chain.name.slice(-1) === selectedChain) {
                const indices = chain.nucleotides.map(nucleotide => nucleotide.index);
                const min = Math.min(...indices);
                const max = Math.max(...indices);

                setMinId(min.toString());
                setMaxId(max.toString());
                setInputValueStart(min.toString());
                setInputValueEnd(max.toString());
            }

        })
    }, [selectedChain])
    return (
        <div className="flex items-center pl-6 h-[auto] z-0 text-xl font-semibold "> {/* justify-end */}
            <Box sx={{ width: "80px", maxWidth: 120 }}>
                <FormControl fullWidth>
                    <InputLabel id="demo-simple-select-label" >Chain</InputLabel>
                    <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        value={selectedChain || chains[0].name.slice(-1)}
                        label="Chain"
                        onChange={handleChange}
                        className="p-0"
                        sx={{ height: "40px", maxWidth: 120 }}
                    >
                        {chains.map((chain) => (
                            <MenuItem key={chain.name} value={chain.name.slice(-1)}>{chain.name.slice(-1)}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>
            <div className="flex flex-row items-baseline mx-6 mt-0">
                <label htmlFor="range_start" className="text-xl font-medium mr-4">From</label>
                <input
                    id="range_start"
                    type="number"
                    min={minId}
                    max={maxId}
                    defaultValue={minId}
                    onChange={handleInputChangeStart}
                    placeholder={minId}
                    className="w-[100px] h-[40px] p-2  mr-4 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <label htmlFor="range_end" className="text-xl font-medium  mr-4">To</label>
                <input
                    id="range_end"
                    type="number"
                    min={minId}
                    max={maxId}
                    defaultValue={maxId}
                    onChange={handleInputChangeEnd}
                    placeholder={maxId}
                    className="w-[100px] h-[40px] p-2  mr-4 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                    id="select_button"
                    onClick={handleSubmit}
                    className="p-0 m-0"
                >
                    Select
                </button>
            </div>
        </div>
    )
}

export default RangeSelecting;