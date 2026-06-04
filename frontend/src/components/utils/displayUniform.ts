export const formatNumberForDisplay = (value: string) => {
  if (value === "") {
    return "";
  }

  const normalizedValue = value.replace(/,/g, "");
  const parsedValue = Number(normalizedValue);

  if (Number.isNaN(parsedValue)) {
    return value;
  }

  const hasDecimal = normalizedValue.indexOf('.') !== -1;
  const options: Intl.NumberFormatOptions = hasDecimal
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { maximumFractionDigits: 2 };

  return new Intl.NumberFormat("en-US", options).format(parsedValue);
};