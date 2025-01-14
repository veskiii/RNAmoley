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
  onReset?: () => void;
}

const RadioButtons: React.FC<RadioButtonsProps> = ({
  options,
  selectedValue,
  onValueChange,
  onReset,
}) => {

  return (
    <div>
      <div className="radio-container">
        <div className="radioGroup">
        {options.map(option => (
          <div className="radioButton" key={option.id}>
            <input
              type="radio"
              id={option.id}
              value={option.value}
              checked={selectedValue === option.value}
              onChange={(e) => {
                if (onReset) onReset();
                onValueChange(e.target.value);
              }}
              className="hidden"
            />
            <label htmlFor={option.id} className="button-label">
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
