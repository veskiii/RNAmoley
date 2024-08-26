import React from "react";
import "../App.css";

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
              id="4BP7"
              value="4BP7"
              checked={selectedValue === "4BP7"}
              onChange={() => handleRadioChange("4BP7")}
            />
            <label htmlFor="4BP7" className="radioLabel">
              4BP7
            </label>
          </div>

          <div className="radioButton">
            <input
              type="radio"
              id="1L9Z"
              value="1L9Z"
              checked={selectedValue === "1L9Z"}
              onChange={() => handleRadioChange("1L9Z")}
            />
            <label htmlFor="1L9Z" className="radioLabel">
              1L9Z
            </label>
          </div>

          <div className="radioButton">
            <input
              type="radio"
              id="2A6E"
              value="2A6E"
              checked={selectedValue === "2A6E"}
              onChange={() => handleRadioChange("2A6E")}
            />
            <label htmlFor="2A6E" className="radioLabel">
              2A6E
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
