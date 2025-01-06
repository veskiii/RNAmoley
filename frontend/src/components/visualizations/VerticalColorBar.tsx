import React from 'react';
import {colorMapByRange} from "../utils/ColorUtils"

const VerticalColorBar = () => {
    const colorDivs = Array.from(colorMapByRange.entries()).map(([key, color]) => {
        return (
            <div key={key} className="flex-1 flex items-center justify-center font-bold"
                 style={{backgroundColor: color}}>
                <h3 className="m-2">{key}</h3>
            </div>
        );
    });

    return (
        <div className="z-10 right-0 top-0 h-full flex flex-col">
            {colorDivs}
        </div>
    );
};

export default VerticalColorBar;