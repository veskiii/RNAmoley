import React, { useState, useCallback, useEffect } from "react";

interface TwoViewProps {
  sequence: string;
  structure: string;
  SELECTED: number[];
  setSELECTED: React.Dispatch<React.SetStateAction<number[]>>;
}

interface NucleotidePosition {
  x: number;
  y: number;
  fill: string;
}

const TwoDView: React.FC<TwoViewProps> = ({
  sequence,
  structure,
  SELECTED,
  setSELECTED,
}) => {
  const radius = 15; // Promień okręgów reprezentujących nukleotydy
  const gap = 50; // Odległość pomiędzy nukleotydami
  const [positions, setPositions] = useState<NucleotidePosition[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(
    null
  );
  const [cursorStart, setCursorStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [cursorStop, setCursorStop] = useState<{ x: number; y: number } | null>(
    null
  );
  const [isSelecting, setIsSelecting] = useState(false);

  // Lista pozycji każdego nukleotydu
  const generatePositions = (): NucleotidePosition[] => {
    const positions: NucleotidePosition[] = [];
    const angleStep = (2 * Math.PI) / sequence.length;
    const centerX = 200;
    const centerY = 200;
    const r = sequence.length * 6; // Promień okręgu, na którym będą ułożone nukleotydy - zależny od długości sekwencji

    for (let i = 0; i < sequence.length; i++) {
      const angle = i * angleStep;
      const x = centerX + r * Math.cos(angle);
      const y = centerY + r * Math.sin(angle);
      positions.push({ x, y, fill: "lightblue" });
    }
    return positions;
  };

  // Funkcja do znalezienia par w notacji dot-bracket
  const getBasePairs = (): [number, number][] => {
    const stack: number[] = [];
    const pairs: [number, number][] = [];

    for (let i = 0; i < structure.length; i++) {
      if (i < structure.length - 1) pairs.push([i, i + 1]);

      if (structure[i] === "(") {
        stack.push(i);
      } else if (structure[i] === ")") {
        const j = stack.pop();
        if (j !== undefined) {
          pairs.push([j, i]);
        }
      }
    }
    return pairs;
  };

  // Funkcja do przesunięcia sparowanych zasad bliżej siebie
  const adjustPairedPositions = (
    positions: NucleotidePosition[],
    basePairs: [number, number][]
  ) => {
    basePairs.forEach(([i, j]) => {
      if (positions[i] && positions[j]) {
        const midX = (positions[i].x + positions[j].x) / 2;
        const midY = (positions[i].y + positions[j].y) / 2;

        positions[i].x = midX - 10;
        positions[i].y = midY - 10;
        positions[j].x = midX + 10;
        positions[j].y = midY + 10;
      }
    });
  };

  // Inicjalizuj pozycje tylko raz przy pierwszym renderowaniu komponentu
  useEffect(() => {
    console.log("USE EFFECT - GENERATE POSITIONS");
    const initialPositions = generatePositions();
    const basePairs = getBasePairs();
    adjustPairedPositions(initialPositions, basePairs);
    setPositions(initialPositions); // Ustaw pozycje w stanie
  }, [sequence, structure]);

  // W momencie otrzymania tablicy lub jej modyfikacji obsluguje zmianę koloru obiektów
  useEffect(() => {
    if (positions.length === 0) return;

    // console.log("Updated SELECTED:", SELECTED);

    const newPositions = [...positions];

    SELECTED.forEach((id) => {
      if (newPositions[id]) {
        newPositions[id] = { ...newPositions[id], fill: "pink" };
      }
    });
    newPositions.forEach((pos, index) => {
      if (!SELECTED.includes(index))
        newPositions[index] = { ...newPositions[index], fill: "lightblue" };
    });

    setPositions(newPositions);
  }, [SELECTED, positions]);

  // Obsługa wybierania pojedynczych elementów
  const handleSingleSelecting = useCallback(
    (index: number, e: React.MouseEvent<SVGCircleElement, MouseEvent>) => {
      const pos = positions[index];
      if (pos) {
        if (pos.fill === "lightblue" && e.ctrlKey) {
          setSELECTED((prevSelected) => {
            if (!prevSelected.includes(index)) return [...prevSelected, index];
            return prevSelected;
          });
        }
        if (pos.fill === "pink" && e.shiftKey) {
          setSELECTED((prevSelected) => {
            if (prevSelected.includes(index))
              return prevSelected.filter((id) => id !== index);
            return prevSelected;
          });
        }
      }
    },
    [positions, setSELECTED]
  );

  // TODO: przeciąganie modelu
  // Rozpoczęcie przeciągania modelu
  // const handleDraggingMouseDown = useCallback(
  //   (index: number, e: React.MouseEvent<SVGCircleElement, MouseEvent>) => {
  //     const { clientX, clientY } = e;

  //     const pos = positions[index];
  //     if (pos) {
  //       const newPositions = [...positions];
  //       newPositions[index] = { ...pos };
  //       setPositions(newPositions);

  //       setDraggingIndex(index);
  //       setDragOffset({
  //         x: clientX - pos.x,
  //         y: clientY - pos.y,
  //       });
  //     }
  //   },
  //   [positions, setSELECTED]
  // );

  // // Zakończenie przeciągania modelu
  // const handleDraggingMouseUp = useCallback(() => {
  //   setDraggingIndex(null);
  //   setDragOffset(null);
  // }, []);

  // // Ruch przeciąganego elementu
  // const handleDraggingMouseMove = useCallback(
  //   (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
  //     if (draggingIndex !== null && dragOffset) {
  //       const { clientX, clientY } = e;
  //       const newPositions = [...positions];
  //       newPositions[draggingIndex] = {
  //         ...newPositions[draggingIndex],
  //         x: clientX - dragOffset.x,
  //         y: clientY - dragOffset.y,
  //       };
  //       setPositions(newPositions);
  //     }
  //   },
  //   [draggingIndex, dragOffset, positions]
  // );

  const handleMultipleSelectingMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      if (e.ctrlKey || e.shiftKey) {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();

        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        setCursorStart({ x: cursorX, y: cursorY });
        setIsSelecting(true);
        setCursorStop(null);
      }
    },
    []
  );

  const handleMultipleSelectingMouseUp = useCallback(
    (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      setIsSelecting(false);

      //calculate range of selected area
      if (cursorStart) {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();

        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const x_min = Math.min(cursorStart.x, cursorX);
        const x_max = Math.max(cursorStart.x, cursorX);

        const y_min = Math.min(cursorStart.y, cursorY);
        const y_max = Math.max(cursorStart.y, cursorY);

        const newSelected: number[] = [];
        positions.forEach((pos, index) => {
          if (
            pos.x >= x_min &&
            pos.x <= x_max &&
            pos.y >= y_min &&
            pos.y <= y_max
          ) {
            newSelected.push(index);
          }
        });

        if (e.ctrlKey)
          setSELECTED((prevSelected) => [...prevSelected, ...newSelected]);
        if (e.shiftKey) {
          newSelected.forEach((index) => {
            const newPositions = [...positions];
            const pos = newPositions[index];
            newPositions[index] = { ...pos, fill: "lightblue" };
            setPositions(newPositions);

            setSELECTED((prevSelected) => {
              if (prevSelected.includes(index))
                return prevSelected.filter((id) => id !== index);
              return prevSelected;
            });
          });
        }
      }

      setCursorStart(null);
      setCursorStop(null);
    },
    [positions, setSELECTED, cursorStart]
  );

  const handleMultipleSelecting = useCallback(
    (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      if ((e.ctrlKey || e.shiftKey) && isSelecting && cursorStart) {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();

        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        setCursorStop({ x: cursorX, y: cursorY });
      }
    },
    [isSelecting, cursorStart]
  );

  const renderSelectionArea = () => {
    if (cursorStart && cursorStop) {
      const avg_x = Math.min(cursorStart.x, cursorStop.x);
      const avg_y = Math.min(cursorStart.y, cursorStop.y);
      const width = Math.abs(cursorStop.x - cursorStart.x);
      const height = Math.abs(cursorStop.y - cursorStart.y);
      return (
        <rect
          x={avg_x}
          y={avg_y}
          width={width}
          height={height}
          fill="rgba(0, 0, 255, 0.3)"
        />
      );
    }
    return null;
  };

  const basePairs = getBasePairs();

  // Renderuj SVG tylko, gdy pozycje są gotowe
  if (positions.length === 0) {
    return null;
  }

  return (
    <svg
      width="auto"
      height="auto"
      style={{ border: "1px solid black" }}
      onMouseDown={handleMultipleSelectingMouseDown}
      // onMouseMove={handleMouseMove}
      onMouseMove={handleMultipleSelecting}
      onMouseUp={handleMultipleSelectingMouseUp}
      // onMouseUp={handleMouseUp}
      // onMouseLeave={handleMouseUp} // Zapobieganie przeciąganiu poza SVG
    >
      {positions.map((pos, index) => (
        <g key={index}>
          {/* Rysowanie nukleotydu */}
          <circle
            cx={pos?.x ?? 0}
            cy={pos?.y ?? 0}
            r={radius}
            fill={pos.fill || "lightblue"}
            onMouseDown={(e) => {
              handleSingleSelecting(index, e);
              // handleDraggingMouseDown(index, e);
            }}
            style={{ cursor: "pointer" }}
          />
          <text
            x={pos?.x ?? 0}
            y={pos?.y ?? 0}
            textAnchor="middle"
            dy=".3em"
            style={{ userSelect: "none" }}
          >
            {sequence[index - 1]}
          </text>
        </g>
      ))}

      {basePairs.map(([i, j], index) => (
        <line
          key={index}
          x1={positions[i]?.x ?? 0}
          y1={positions[i]?.y ?? 0}
          x2={positions[j]?.x ?? 0}
          y2={positions[j]?.y ?? 0}
          stroke="black"
          strokeWidth="2"
        />
      ))}
      {renderSelectionArea()}
    </svg>
  );
};

export default TwoDView;
