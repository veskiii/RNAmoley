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
              id="1FFK"
              value="1FFK"
              checked={selectedValue === "1FFK"}
              onChange={() => handleRadioChange("1FFK")}
            />
            <label htmlFor="1FFK" className="radioLabel">
              1FFK
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
