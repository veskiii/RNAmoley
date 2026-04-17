import React, { useState } from "react";

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

const SimulationStartModal: React.FC<SimulationStartModalProps> = ({
  isOpen,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [restraintBackboneForce, setRestraintBackboneForce] = useState("1.0");
  const [restraintGlobalForce, setRestraintGlobalForce] = useState("0.5");
  const [restraintBasePairsForce, setRestraintBasePairsForce] = useState("1.0");
  const [rmsdCutoff, setRmsdCutoff] = useState("3.0");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsedValues: SimulationFormValues = {
      restraintBackboneForce: Number(restraintBackboneForce),
      restraintGlobalForce: Number(restraintGlobalForce),
      restraintBasePairsForce: Number(restraintBasePairsForce),
      rmsdCutoff: Number(rmsdCutoff),
    };

    const hasInvalidValue = Object.values(parsedValues).some(
      (value) => Number.isNaN(value) || value < 0
    );

    if (hasInvalidValue) {
      setValidationError("Wszystkie parametry muszą być liczbami >= 0.");
      return;
    }

    setValidationError(null);
    await onSubmit(parsedValues);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Start symulacji</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed"
          >
            Zamknij
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Siła restraint backbone
            </span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={restraintBackboneForce}
              onChange={(e) => setRestraintBackboneForce(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              disabled={isSubmitting}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Siła restraint global
            </span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={restraintGlobalForce}
              onChange={(e) => setRestraintGlobalForce(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              disabled={isSubmitting}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Siła restraint base pairs
            </span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={restraintBasePairsForce}
              onChange={(e) => setRestraintBasePairsForce(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              disabled={isSubmitting}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Cutoff RMSD
            </span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={rmsdCutoff}
              onChange={(e) => setRmsdCutoff(e.target.value)}
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
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-moley-darkGreen px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Uruchamianie..." : "Start symulacji"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SimulationStartModal;
