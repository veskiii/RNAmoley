import React from "react";
import {Colors} from "../common/colors"

interface AnalyzeButtonProps {
    onClick: () => void; // Function with no arguments and no return value
}

const AnalyzeButton: React.FC<AnalyzeButtonProps> = ({onClick}) => {

    return (
        <button
            id="saveButton"
            onClick={onClick}
            className={
                "font-bold rounded-lg p-2 text-lg text-black flex justify-center items-center h-auto w-[90%] my-1 transition-colors bg-rose-400/80 hover:bg-sky-400"
            }
            style={{backgroundColor: Colors.salmon}}
        >
            Analyze
        </button>
    );
};

export default AnalyzeButton;
