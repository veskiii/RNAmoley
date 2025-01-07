import React from "react";
import "../../App.css";

interface RadioOption{
  id: string;
  value: string;
  label: string;
}

interface RadioButtonsProps {
  options: RadioOption[];
  selectedValue: string;
  onValueChange: (value: string) => void;
}

const RadioButtons: React.FC<RadioButtonsProps> = ({
  options,
  selectedValue,
  onValueChange,
}) => {

  return (
    <div className="w-80">
      <div className="radio-container">
        <div className="radioGroup">
        {options.map(option => (
          <div className="radioButton" key={option.id}>
            <input
              type="radio"
              id={option.id}
              value={option.value}
              checked={selectedValue === option.value}
              onChange={() => onValueChange(option.value)}
            />
            <label htmlFor={option.id} className="radioLabel">
              {option.label}
            </label>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
};
export default RadioButtons;
