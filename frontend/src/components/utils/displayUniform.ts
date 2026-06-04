export const formatNumberForDisplay = (value: string) => {
  if (value === "") {
    return "";
  }

  const normalizedValue = value.replace(/,/g, "");
  const parsedValue = Number(normalizedValue);

  if (Number.isNaN(parsedValue)) {
    return value;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(parsedValue);
};