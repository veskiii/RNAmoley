import React from "react";
import "../../App.css";

interface InputTypeProps {
  selectedValue: string;
  onValueChange: (value: string) => void;
}

const InputType: React.FC<InputTypeProps> = ({
  selectedValue,
  onValueChange,
}) => {
  const handleRadioChange = (value: string) => {
    onValueChange(value);
  };

  return (
    <div className="w-80">
      <p>Select method for entering data:</p>
      <div className="radio-container">
        <div className="radioGroup">
          <div className="radioButton">
            <input
              type="radio"
              id="file"
              value="file"
              checked={selectedValue === "file"}
              onChange={() => handleRadioChange("file")}
            />
            <label htmlFor="file" className="radioLabel">
              Upload file
            </label>
          </div>

          <div className="radioButton">
            <input
              type="radio"
              id="PDBid"
              value="PDBid"
              checked={selectedValue === "PDBid"}
              onChange={() => handleRadioChange("PDBid")}
            />
            <label htmlFor="PDBid" className="radioLabel">
              Fetch by PDB id
            </label>
          </div>

          <div className="radioButton">
            <input
              type="radio"
              id="sample"
              value="sample"
              checked={selectedValue === "sample"}
              onChange={() => handleRadioChange("sample")}
            />
            <label htmlFor="sample" className="radioLabel">
              Choose from samples
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
export default InputType;
