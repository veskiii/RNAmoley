import React, { useState } from "react";
import { formatNumberForDisplay } from "../utils/displayUniform";

export type SimulationFormValues = {
  restraintBackboneForce: number;
  restraintGlobalForce: number;
  restraintBasePairsForce: number;
  rmsdCutoff: number;
};

type SimulationStartModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSubmit: (values: SimulationFormValues) => Promise<void>;
};

const normalizeNumberInput = (value: string) => value.replace(/,/g, "");

const parseSubmittedNumber = (value: string) => Number(normalizeNumberInput(value));

const SimulationStartModal: React.FC<SimulationStartModalProps> = ({
  isOpen,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [restraintBackboneForce, setRestraintBackboneForce] = useState(
    formatNumberForDisplay("500")
  );
  const [restraintGlobalForce, setRestraintGlobalForce] = useState(
    formatNumberForDisplay("100000")
  );
  const [restraintBasePairsForce, setRestraintBasePairsForce] = useState(
    formatNumberForDisplay("500")
  );
  const [rmsdCutoff, setRmsdCutoff] = useState(formatNumberForDisplay("0.4"));
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsedValues: SimulationFormValues = {
      restraintBackboneForce: parseSubmittedNumber(restraintBackboneForce),
      restraintGlobalForce: parseSubmittedNumber(restraintGlobalForce),
      restraintBasePairsForce: parseSubmittedNumber(restraintBasePairsForce),
      rmsdCutoff: parseSubmittedNumber(rmsdCutoff),
    };

    const hasInvalidValue = Object.values(parsedValues).some(
      (value) => Number.isNaN(value) || value < 0
    );

    if (hasInvalidValue) {
      setValidationError("All parameters must be numbers >= 0.");
      return;
    }

    setValidationError(null);
    await onSubmit(parsedValues);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Refinement parameters</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Backbone restraint force
            </span>
            <input
              type="text"
              inputMode="numeric"
              min="0"
              step="100"
              value={restraintBackboneForce}
              onChange={(e) =>
                setRestraintBackboneForce(normalizeNumberInput(e.target.value))
              }
              onBlur={(e) =>
                setRestraintBackboneForce(formatNumberForDisplay(e.target.value))
              }
              onFocus={(e) =>
                setRestraintBackboneForce(normalizeNumberInput(e.target.value))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              disabled={isSubmitting}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Global restraint force
            </span>
            <input
              type="text"
              inputMode="numeric"
              min="0"
              step="100"
              value={restraintGlobalForce}
              onChange={(e) =>
                setRestraintGlobalForce(normalizeNumberInput(e.target.value))
              }
              onBlur={(e) =>
                setRestraintGlobalForce(formatNumberForDisplay(e.target.value))
              }
              onFocus={(e) =>
                setRestraintGlobalForce(normalizeNumberInput(e.target.value))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              disabled={isSubmitting}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Base pairs restraint force
            </span>
            <input
              type="text"
              inputMode="numeric"
              min="0"
              step="100"
              value={restraintBasePairsForce}
              onChange={(e) =>
                setRestraintBasePairsForce(normalizeNumberInput(e.target.value))
              }
              onBlur={(e) =>
                setRestraintBasePairsForce(formatNumberForDisplay(e.target.value))
              }
              onFocus={(e) =>
                setRestraintBasePairsForce(normalizeNumberInput(e.target.value))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              disabled={isSubmitting}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              RMSD cutoff [Å]
            </span>
            <input
              type="text"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={rmsdCutoff}
              onChange={(e) => setRmsdCutoff(normalizeNumberInput(e.target.value))}
              onBlur={(e) => setRmsdCutoff(formatNumberForDisplay(e.target.value))}
              onFocus={(e) => setRmsdCutoff(normalizeNumberInput(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              disabled={isSubmitting}
            />
          </label>

          {(validationError || errorMessage) && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {validationError || errorMessage}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-moley-darkGreen px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Starting..." : "Run refinement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SimulationStartModal;
