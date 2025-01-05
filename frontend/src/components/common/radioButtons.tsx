import React from "react";
import "../../App.css";

interface RadioButtonsProps {
  selectedValue: string;
  onValueChange: (value: string) => void;
}

const RadioButtons: React.FC<RadioButtonsProps> = ({
  selectedValue,
  onValueChange,
}) => {
  const handleRadioChange = (value: string) => {
    onValueChange(value);
  };

  return (
    <div className="w-80">
      <p>Choose from samples:</p>
      <div className="radio-container">
        <div className="radioGroup">
          <div className="radioButton">
            <input
              type="radio"
              id="8ITS"
              value="8ITS"
              checked={selectedValue === "8ITS"}
              onChange={() => handleRadioChange("8ITS")}
            />
            <label htmlFor="8ITS" className="radioLabel">
              8ITS
            </label>
          </div>

          <div className="radioButton">
            <input
              type="radio"
              id="8JHP"
              value="8JHP"
              checked={selectedValue === "8JHP"}
              onChange={() => handleRadioChange("8JHP")}
            />
            <label htmlFor="8JHP" className="radioLabel">
              8JHP
            </label>
          </div>

          <div className="radioButton">
            <input
              type="radio"
              id="7KUC"
              value="7KUC"
              checked={selectedValue === "7KUC"}
              onChange={() => handleRadioChange("7KUC")}
            />
            <label htmlFor="7KUC" className="radioLabel">
              7KUC
            </label>
          </div>

          <div className="radioButton">
            <input
              type="radio"
              id="None"
              value="None"
              checked={selectedValue === "None"}
              onChange={() => handleRadioChange("None")}
            />
            <label htmlFor="None" className="radioLabel">
              None
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
export default RadioButtons;
