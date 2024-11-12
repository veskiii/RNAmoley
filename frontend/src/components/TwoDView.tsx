import React, { useState, useCallback, useEffect, useRef } from "react";
import * as d3 from "d3-force";
import "d3-selection";
import "d3-drag";

interface TwoViewProps {
  sequence: string;
  structure: string;
  SELECTED: number[];
  setSELECTED: React.Dispatch<React.SetStateAction<number[]>>;
  nodeLabel: boolean;
  directionArrows: boolean;
  numbering: boolean;
  labelInterval: number;
  width: number;
  height: number;
}

interface NucleotidePosition {
  id: number;
  x: number;
  y: number;
  fill: string;
}

interface Link {
  source: number;
  target: number;
}

const TwoDView: React.FC<TwoViewProps> = ({
  sequence,
  structure,
  SELECTED,
  setSELECTED,
  nodeLabel,
  directionArrows,
  numbering,
  labelInterval,
  width,
  height,
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
  const simulationRef = useRef<d3.Simulation<NucleotidePosition, Link> | null>(
    null
  );
  let svg = document.getElementById("svg_id") as SVGElement | null;
  var mouseStartPosition = { x: 0, y: 0 };
  var mousePosition = { x: 0, y: 0 };
  var viewboxStartPosition = { x: 0, y: 0 };
  var viewboxPosition = { x: 0, y: 0 };
  var viewboxSize = { x: width, y: height };
  var viewboxScale = 1.0;
  var mouseDown = false;
  //const [nodeLabel, setNodeLabel] = useState(true);

  // Lista pozycji każdego nukleotydu
  const generatePositions = (): NucleotidePosition[] => {
    const positions: NucleotidePosition[] = [];
    const loops = findLoops();
    //const angleStep = (2 * Math.PI) / sequence.length;
    const centerX = width / 2;
    const centerY = height / 2;
    //const r = sequence.length * 10;
    let indeks = 0;

    loops.forEach((loop, loopIndex) => {
      const r = loop.length * 10; //const r = (loopIndex + 1) * 50;
      const angleStep = (2 * Math.PI) / loop.length; //const angleStep = (2 * Math.PI) / loop.length;
      console.log("LOOP:", loop, loopIndex);
      if (loop.length) {
        loop.forEach((nucleotide, index) => {
          const x = centerX + r * Math.cos(angleStep * index);
          const y = centerY + r * Math.sin(angleStep * index);
          positions.push({ id: indeks, x, y, fill: "#38bdf8" }); //blue
          indeks += 1;
          console.log("nts i indeks: ", nucleotide, indeks);
        });
      }
    });

    // for (let i = 0; i < sequence.length; i++) {
    //   const angle = i * angleStep;
    //   const x = centerX + r * Math.cos(angle);
    //   const y = centerY + r * Math.sin(angle);
    //   positions.push({ id: i + 1, x, y, fill: "lightblue" });
    // }
    return positions;
  };

  const getBasePairs = (): [number, number][] => {
    // const stack: number[] = [];
    // const pairs: [number, number][] = [];

    // for (let i = 0; i < structure.length; i++) {
    //   if (structure[i] === "(") {
    //     stack.push(i);
    //   } else if (structure[i] === ")") {
    //     const j = stack.pop();
    //     if (j !== undefined) {
    //       pairs.push([j, i]);
    //     }
    //   }
    // }
    // return pairs;
    const stack: number[] = [];
    const pairs: [number, number][] = [];
    for (let i = 0; i < structure.length; i++) {
      const char = structure[i];
      if (char === "(" || char === "[") {
        stack.push(i);
      } else if (char === ")" || char === "]") {
        if (stack.length) {
          const pairIndex = stack.pop()!;
          pairs.push([pairIndex, i]);
        }
      }
    }
    return pairs;
  };

  const connectNucleotides = (): [number, number][] => {
    const pairs: [number, number][] = [];

    for (let i = 0; i < structure.length; i++) {
      if (i < structure.length - 1) pairs.push([i, i + 1]);
    }
    return pairs;
  };

  const getLinks = (): Link[] => {
    const basePairs = getBasePairs();
    const connectedNucleotides = connectNucleotides();
    const links: Link[] = basePairs.map(([source, target]) => ({
      source,
      target,
    }));
    connectedNucleotides.forEach(([source, target]) => {
      links.push({ source, target });
    });
    return links;
  };

  const findLoops = (): number[][] => {
    const loops: number[][] = [];
    let currentLoop: number[] = [];

    for (let i = 0; i < structure.length; i++) {
      if (structure[i] === "(" || structure[i] === ")") {
        if (currentLoop.length) {
          loops.push(currentLoop);
          currentLoop = [];
        } else {
          currentLoop.push(i);
        }
      } else {
        currentLoop.push(i);
      }
    }
    if (currentLoop.length) {
      loops.push(currentLoop);
    }
    return loops;
  };

  // // Funkcja do przesunięcia sparowanych zasad bliżej siebie
  // const adjustPairedPositions = (
  //   positions: NucleotidePosition[],
  //   basePairs: [number, number][]
  // ) => {
  //   basePairs.forEach(([i, j]) => {
  //     if (positions[i] && positions[j]) {
  //       const midX = (positions[i].x + positions[j].x) / 2;
  //       const midY = (positions[i].y + positions[j].y) / 2;

  //       positions[i].x = midX - 10;
  //       positions[i].y = midY - 10;
  //       positions[j].x = midX + 10;
  //       positions[j].y = midY + 10;
  //     }
  //   });
  // };

  // // Inicjalizuj pozycje tylko raz przy pierwszym renderowaniu komponentu
  // useEffect(() => {
  //   console.log("USE EFFECT - GENERATE POSITIONS");
  //   const initialPositions = generatePositions();
  //   const basePairs = getBasePairs();
  //   adjustPairedPositions(initialPositions, basePairs);
  //   setPositions(initialPositions); // Ustaw pozycje w stanie
  //   console.log(width, height);
  // }, [sequence, structure]);
  sequence =
    "GGGCCUAUAGCUCAGGCGGUUAGAGCGCUUCGCUGAUAACGAAGAGGUCGGAGGUUCGAGUCCUCCUAGGCCCACCAGGCGACGAUCCGGCCAUCACCGGGGAGCCUUCGGAAGAACGGCGCCGCCGGAAACGGCGGCGCUCAGUAGAACCGAACGGGUGAGCCCGUCACAGCUC";
  structure =
    "((((((...((((.....[...)))).(((((.......))))).....(((((..]....))))).))))))((..(((..(..(((((......)))))).)))(((((....((((((((((((....))))))))))..))....)))))[[[))((((]]].....))))";

  useEffect(() => {
    console.log("inicjalizacja");
    console.log(sequence);
    console.log(structure);

    const angleStep = (2 * Math.PI) / sequence.length;
    const centerX = width / 2;
    const centerY = height / 2;
    const r = sequence.length * 10;

    const initialPositions: NucleotidePosition[] = sequence
      .split("")
      .map((pos, index) => {
        let colorName = "#38bdf8"; //blue
        if (SELECTED.includes(index)) {
          colorName = "#f97386";
        }
        return {
          id: index,
          x: centerX + r * Math.cos(angleStep * index),
          y: centerY + r * Math.sin(angleStep * index),
          fill: colorName,
        };
      });
    // const initialPositions = generatePositions();
    setPositions(initialPositions);

    const simulation = d3
      .forceSimulation(initialPositions)
      .force("charge", d3.forceManyBody().strength(-100))
      .force(
        "link",
        d3
          .forceLink(
            getLinks().map((link) => ({
              source: link.source,
              target: link.target,
            }))
          )
          .id((d: any) => d.id)
          .distance(60)
      )
      .force("collision", d3.forceCollide().radius(radius + 5))
      .force("center", d3.forceCenter(width / 2, height / 2));
    // .on("tick", () => {
    //   setPositions([...initialPositions]);
    // });

    // Ręczne wywołanie symulacji tylko raz
    for (let i = 0; i < 30; i++) {
      simulation.tick();
    }
    simulation.stop();

    simulationRef.current = simulation;
    document.addEventListener("keydown", handleCKeyDown);

    // svg?.addEventListener("mousemove", mousemove);
    // svg?.addEventListener("mousedown", mousedown);
    // console.log("inicjalizacja wheel", mousePosition.x);

    if (svg) {
      svg?.addEventListener("wheel", wheel);
      svg?.focus();
    }

    return () => {
      simulation.stop();
      document.removeEventListener("keydown", handleCKeyDown);
      if (svg) {
        svg?.removeEventListener("wheel", wheel);
      }
    };
  }, [sequence, structure, width, height]);

  // Wykonuje się po odświeżeniu widoku
  // W momencie otrzymania tablicy lub jej modyfikacji obsluguje zmianę koloru obiektów
  useEffect(() => {
    if (positions.length === 0) return;

    // console.log("Updated SELECTED:", SELECTED);

    // svg?.addEventListener("mousemove", mousemove);
    // svg?.addEventListener("mousedown", mousedown);
    // console.log("inicjalizacja wheel");

    if (svg) {
      svg?.addEventListener("wheel", wheel);
      svg?.focus();
    }

    const newPositions = positions.map((pos, index) => {
      console.log(index);
      if (SELECTED.includes(index)) {
        return { ...pos, fill: "#f97386" }; //pink
      }
      return { ...pos, fill: "#38bdf8" }; //blue
    });

    if (JSON.stringify(newPositions) !== JSON.stringify(positions)) {
      setPositions(newPositions);
    }
  }, [SELECTED, positions]);

  // Obsługa wybierania pojedynczych elementów
  const handleSingleSelecting = useCallback(
    (index: number, e: React.MouseEvent<SVGCircleElement, MouseEvent>) => {
      const pos = positions[index];
      if (pos) {
        //blue
        if (pos.fill === "#38bdf8") {
          setSELECTED((prevSelected) => {
            if (!prevSelected.includes(index)) return [...prevSelected, index];
            return prevSelected;
          });
        }
        //pink
        if (pos.fill === "#f97386") {
          setSELECTED((prevSelected) => {
            if (prevSelected.includes(index)) {
              return prevSelected.filter((id) => id !== index);
            }

            return prevSelected;
          });
        }
      }
    },
    [positions, setSELECTED]
  );

  // Rozpoczęcie przeciągania modelu
  const handleDraggingMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      if (simulationRef.current) simulationRef.current.stop();
      if (!e.shiftKey && !e.ctrlKey) {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();

        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        setDragOffset({
          x: cursorX,
          y: cursorY,
        });
      }
    },
    []
  );

  const handleCKeyDown = (e: KeyboardEvent) => {
    // Wznowienie symulacji - powoduje również, że model po przeciagnieciu wraca do swojej pozycji
    if (
      simulationRef.current &&
      simulationRef.current.stop() &&
      e.key === "c"
    ) {
      simulationRef.current.stop();
      simulationRef.current.restart();
    }
  };

  // Zakończenie przeciągania modelu
  const handleDraggingMouseUp = useCallback(() => {
    setDragOffset(null);
  }, []);

  // Ruch przeciąganego modelu
  const handleDraggingMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      if (dragOffset && !e.shiftKey && !e.ctrlKey) {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();

        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        // const newPositions = [...positions];
        // newPositions[draggingIndex] = {
        //   ...newPositions[draggingIndex],
        //   x: cursorX - dragOffset.x,
        //   y: cursorY - dragOffset.y,
        // };

        const newPositions = positions.map((pos) => ({
          ...pos,
          x: pos.x + cursorX - dragOffset.x,
          y: pos.y + cursorY - dragOffset.y,
        }));

        setPositions(newPositions);
        setDragOffset({ x: cursorX, y: cursorY });
        mousePosition.x = cursorX;
        mousePosition.y = cursorY;
      }
    },
    [dragOffset, positions]
  );

  const handleMultipleSelectingMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
      setDragOffset(null);
      if (!dragOffset && (e.shiftKey || e.ctrlKey)) {
        setDragOffset(null);
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
      if (!dragOffset && cursorStart && (e.ctrlKey || e.shiftKey)) {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();

        const cursorX = (e.clientX - rect.left) / viewboxScale;
        const cursorY = (e.clientY - rect.top) / viewboxScale;

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
            newPositions[index] = { ...pos, fill: "#38bdf8" }; //blue
            setPositions(newPositions);

            setSELECTED((prevSelected) => {
              if (prevSelected.includes(index)) {
                return prevSelected.filter((id) => id !== index);
              }

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
      if (
        (e.shiftKey || e.ctrlKey) &&
        !dragOffset &&
        isSelecting &&
        cursorStart &&
        e.button === 0
      ) {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();

        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        setCursorStop({ x: cursorX, y: cursorY });
      }
    },
    [isSelecting, cursorStart]
  );

  function setviewbox() {
    let shape = document.getElementById("svg_id") as HTMLElement;
    if (shape) {
      console.log("set viewbox");
      var vp = { x: 0, y: 0 };
      var vs = { x: 0, y: 0 };

      vp.x = viewboxPosition.x;
      vp.y = viewboxPosition.y;

      vs.x = viewboxSize.x * viewboxScale;
      vs.y = viewboxSize.y * viewboxScale;

      shape.setAttribute(
        "viewBox",
        vp.x + " " + vp.y + " " + vs.x + " " + vs.y
      );
    }
  }

  function mousedown(e: React.MouseEvent<SVGSVGElement, MouseEvent>) {
    console.log("mousedown");
    let shape = document.getElementById("svg_id") as HTMLElement;
    if (shape) {
      mouseStartPosition.x = e.pageX;
      mouseStartPosition.y = e.pageY;

      viewboxStartPosition.x = viewboxPosition.x;
      viewboxStartPosition.y = viewboxPosition.y;

      window.addEventListener("mouseup", mouseup);

      mouseDown = true;
    }
  }

  function mouseup(e: MouseEvent) {
    console.log("mouseup");
    let shape = document.getElementById("svg_id") as HTMLElement;
    if (shape) {
      window.removeEventListener("mouseup", mouseup);

      mouseDown = false;
    }
  }

  function mousemove(e: React.MouseEvent<SVGSVGElement, MouseEvent>) {
    console.log("mousemove");
    let shape = document.getElementById("svg_id") as HTMLElement;
    if (shape) {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();

      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      mousePosition.x = cursorX;
      mousePosition.y = cursorY;

      if (mouseDown) {
        viewboxPosition.x =
          viewboxStartPosition.x +
          (mouseStartPosition.x - e.pageX) * viewboxScale;
        viewboxPosition.y =
          viewboxStartPosition.y +
          (mouseStartPosition.y - e.pageY) * viewboxScale;

        setviewbox();
      }
    }
  }

  const wheel = (e: WheelEvent) => {
    let shape = document.getElementById("svg_id") as HTMLElement;
    if (shape) {
      var scale = e.deltaY < 0 ? 0.8 : 1.2;

      if (viewboxScale * scale < 8 && viewboxScale * scale > 1 / 256) {
        var mpos = {
          x: mousePosition.x * viewboxScale,
          y: mousePosition.y * viewboxScale,
        };
        var vpos = { x: viewboxPosition.x, y: viewboxPosition.y };
        var cpos = { x: mpos.x + vpos.x, y: mpos.y + vpos.y };

        viewboxPosition.x = (viewboxPosition.x - cpos.x) * scale + cpos.x;
        viewboxPosition.y = (viewboxPosition.y - cpos.y) * scale + cpos.y;
        viewboxScale *= scale;

        setviewbox();
      }
    }
  };

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

  // Renderuj SVG tylko, gdy pozycje są gotowe
  if (positions.length === 0) {
    return null;
  } else {
    console.log("POSITIONS");
    positions.forEach((pos, index) => {
      console.log(pos, index, sequence[index]);
    });
  }
  const basePairs = getBasePairs();
  const connectedNts = connectNucleotides();

  return (
    <svg
      id="svg_id"
      // tabIndex={0}
      width={width}
      height={height}
      //Czarna ramka pomaga zobaczyć rozmiar okna svg
      style={{ border: "1px solid white" }}
      onMouseDown={(e) => {
        handleMultipleSelectingMouseDown(e);
        handleDraggingMouseDown(e);
        mousedown(e);
      }}
      // onMouseMove={handleMouseMove}
      onMouseMove={(e) => {
        handleMultipleSelecting(e);
        handleDraggingMouseMove(e);
        mousemove(e);
      }}
      onMouseUp={(e) => {
        handleMultipleSelectingMouseUp(e);
        handleDraggingMouseUp();
      }}
      // onWheel={() => wheel}
      // onMouseUp={handleMouseUp}
      //onMouseLeave={() => handleDraggingMouseUp()} // Zapobieganie przeciąganiu poza SVG
    >
      {directionArrows && (
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="23"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>
      )}

      {basePairs.map(([i, j], index) => (
        <line
          key={index}
          x1={positions[i]?.x ?? 0}
          y1={positions[i]?.y ?? 0}
          x2={positions[j]?.x ?? 0}
          y2={positions[j]?.y ?? 0}
          stroke="red"
          strokeWidth="3"
        />
      ))}
      {connectedNts.map(([i, j], index) => (
        <line
          key={index}
          x1={positions[i]?.x ?? 0}
          y1={positions[i]?.y ?? 0}
          x2={positions[j]?.x ?? 0}
          y2={positions[j]?.y ?? 0}
          stroke="black"
          strokeWidth="2"
          markerEnd="url(#arrow)"
        />
      ))}
      {positions.map((pos, index) => (
        <g key={index}>
          {numbering && (
            <g id="numbering">
              {index % labelInterval === 0 && (
                <line
                  key={index}
                  x1={pos?.x}
                  y1={pos?.y}
                  x2={pos?.x + 40}
                  y2={pos?.y}
                  stroke="grey"
                  strokeWidth="2"
                />
              )}
              {index % labelInterval === 0 && (
                <circle
                  cx={pos?.x + 40}
                  cy={pos?.y}
                  r={radius}
                  fill={"white"}
                ></circle>
              )}
              {index % labelInterval === 0 && (
                <text
                  x={pos?.x + 40}
                  y={pos?.y}
                  textAnchor="middle"
                  dy=".3em"
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {pos.id}
                </text>
              )}
            </g>
          )}

          {/* Rysowanie nukleotydu */}
          <circle
            cx={pos?.x ?? 0}
            cy={pos?.y ?? 0}
            r={radius}
            fill={pos.fill || "38bdf8"} //blue
            onMouseDown={(e) => {
              handleSingleSelecting(index, e);

              // handleDraggingMouseDown(index, e);
            }}
            style={{ cursor: "pointer" }}
          />
          {nodeLabel && (
            <text
              x={pos?.x ?? 0}
              y={pos?.y ?? 0}
              textAnchor="middle"
              dy=".3em"
              style={{ userSelect: "none", pointerEvents: "none" }}
            >
              {sequence[index]}
            </text>
          )}
        </g>
      ))}

      {renderSelectionArea()}
    </svg>
  );
};

export default TwoDView;
