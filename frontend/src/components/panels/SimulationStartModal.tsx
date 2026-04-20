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
  const [restraintBackboneForce, setRestraintBackboneForce] = useState("100000");
  const [restraintGlobalForce, setRestraintGlobalForce] = useState("500");
  const [restraintBasePairsForce, setRestraintBasePairsForce] = useState("500");
  const [rmsdCutoff, setRmsdCutoff] = useState("0.4");
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
          <h2 className="text-xl font-bold text-gray-900">Start simulation</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Backbone restraint force
            </span>
            <input
              type="number"
              min="0"
              step="100"
              value={restraintBackboneForce}
              onChange={(e) => setRestraintBackboneForce(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              disabled={isSubmitting}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Global restraint force
            </span>
            <input
              type="number"
              min="0"
              step="100"
              value={restraintGlobalForce}
              onChange={(e) => setRestraintGlobalForce(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              disabled={isSubmitting}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Base pairs restraint force
            </span>
            <input
              type="number"
              min="0"
              step="100"
              value={restraintBasePairsForce}
              onChange={(e) => setRestraintBasePairsForce(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              disabled={isSubmitting}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              RMSD cutoff
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-moley-darkGreen px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Starting..." : "Start simulation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SimulationStartModal;
