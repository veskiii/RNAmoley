import React from 'react';

interface ControlsPanelProps {
  labelInterval: number;
  setLabelInterval: (value: number) => void;
  numbering: boolean;
  setNumbering: (checked: boolean) => void;
  nodeOutline: boolean;
  setNodeOutline: (checked: boolean) => void;
  nodeLabel: boolean;
  setNodeLabel: (checked: boolean) => void;
  links: boolean;
  setLinks: (checked: boolean) => void;
  directionArrows: boolean;
  setDirectionArrows: (checked: boolean) => void;
  animation: boolean;
  setAnimation: (checked: boolean) => void;
}

const fornaControls: React.FC<ControlsPanelProps> = ({
  labelInterval,
  setLabelInterval,
  numbering,
  setNumbering,
  nodeOutline,
  setNodeOutline,
  nodeLabel,
  setNodeLabel,
  links,
  setLinks,
  directionArrows,
  setDirectionArrows,
  animation,
  setAnimation,
}) => {
  const handleLabelIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLabelInterval(parseInt(e.target.value, 10));
  };

  const handleCheckboxChange = (setter: (checked: boolean) => void) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setter(e.target.checked);
  };

  return (
    <div className="flex flex-col">
      <label>
        Label interval:
        <br />
        <input
          type="number"
          value={labelInterval}
          onChange={handleLabelIntervalChange}
          placeholder="Label Interval"
          className="rounded-lg w-24 mb-2 border-gray-300 border-2 pl-2 p-1"
        />
      </label>
      <label className="options">
        <input
          type="checkbox"
          checked={numbering}
          onChange={handleCheckboxChange(setNumbering)}
        />{' '}
        Numbering
      </label>
      <label className="options">
        <input
          type="checkbox"
          checked={nodeOutline}
          onChange={handleCheckboxChange(setNodeOutline)}
        />{' '}
        Node Outline
      </label>
      <label className="options">
        <input
          type="checkbox"
          checked={nodeLabel}
          onChange={handleCheckboxChange(setNodeLabel)}
        />{' '}
        Node Label
      </label>
      <label className="options">
        <input
          type="checkbox"
          checked={links}
          onChange={handleCheckboxChange(setLinks)}
        />{' '}
        Links
      </label>
      <label className="options">
        <input
          type="checkbox"
          checked={directionArrows}
          onChange={handleCheckboxChange(setDirectionArrows)}
        />{' '}
        Direction Arrows
      </label>
      <label className="options">
        <input
          type="checkbox"
          checked={animation}
          onChange={handleCheckboxChange(setAnimation)}
        />{' '}
        Enable Animation
      </label>
    </div>
  );
};

export default fornaControls;
