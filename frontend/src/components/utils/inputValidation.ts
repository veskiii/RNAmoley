
export function isInputValid(
  rnaFile: File | null,
  pdbCode: string,
  radiobutton: string
): boolean {
  let countConditions = 0;
  if (radiobutton !== "None") countConditions++;
  if (rnaFile) countConditions++;
  if (pdbCode) {
    if (pdbCode.length === 4) countConditions++;
  }
  if (countConditions === 1) return true;
  return false;
}